import type { Size } from "@/render/geometry";

const VERTEX_SHADER = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D source;
uniform ivec2 size;
uniform vec3 yWeights;
uniform vec3 uWeights;
uniform vec3 vWeights;
out vec4 color;

vec3 rgbAt(int x, int y) {
  return texelFetch(source, ivec2(x, y), 0).rgb;
}

float lumaAt(int x, int y) {
  return floor(16.0 + 219.0 * dot(yWeights, rgbAt(x, y)) + 0.5);
}

float chromaAt(vec3 weights, int x, int y) {
  vec3 average = (rgbAt(x, y) + rgbAt(x + 1, y) + rgbAt(x, y + 1) + rgbAt(x + 1, y + 1)) / 4.0;
  return floor(128.0 + 224.0 * dot(weights, average) + 0.5);
}

float byteAt(int column, int row) {
  int width = size.x;
  int height = size.y;
  if (row < height) return lumaAt(column, row);
  int chromaRow = row - height;
  int quarter = height / 4;
  bool isV = chromaRow >= quarter;
  int offset = (isV ? chromaRow - quarter : chromaRow) * width + column;
  int halfWidth = width / 2;
  int x = (offset % halfWidth) * 2;
  int y = (offset / halfWidth) * 2;
  return chromaAt(isV ? vWeights : uWeights, x, y);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int column = texel.x * 4;
  color = vec4(
    byteAt(column, texel.y),
    byteAt(column + 1, texel.y),
    byteAt(column + 2, texel.y),
    byteAt(column + 3, texel.y)
  ) / 255.0;
}`;

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render driver/i;
const COLOR_SPACE: VideoColorSpaceInit = { primaries: "bt709", transfer: "iec61966-2-1", matrix: "bt709", fullRange: false };
const WEIGHTS = {
  y: [0.2126, 0.7152, 0.0722],
  u: [-0.2126 / 1.8556, -0.7152 / 1.8556, 0.5],
  v: [0.5, -0.7152 / 1.5748, -0.0722 / 1.5748],
} as const;

function isSoftwareRenderer(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return SOFTWARE_RENDERER.test(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function link(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

const taskChannel = new MessageChannel();
const waitingForTask: (() => void)[] = [];
taskChannel.port1.onmessage = () => waitingForTask.shift()?.();

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    waitingForTask.push(resolve);
    taskChannel.port2.postMessage(null);
  });
}

export class YuvConverter {
  private readonly idle: WebGLBuffer[] = [];
  private readonly byteLength: number;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly size: Size,
    private readonly texture: WebGLTexture,
  ) {
    this.byteLength = (size.width * size.height * 3) / 2;
  }

  static create(size: Size): YuvConverter | null {
    if (size.width % 8 !== 0 || size.height % 4 !== 0) return null;
    const canvas = new OffscreenCanvas(size.width / 4, (size.height * 3) / 2);
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl || isSoftwareRenderer(gl)) return null;
    const program = link(gl);
    if (!program) return null;

    gl.useProgram(program);
    gl.uniform2i(gl.getUniformLocation(program, "size"), size.width, size.height);
    gl.uniform3fv(gl.getUniformLocation(program, "yWeights"), WEIGHTS.y);
    gl.uniform3fv(gl.getUniformLocation(program, "uWeights"), WEIGHTS.u);
    gl.uniform3fv(gl.getUniformLocation(program, "vWeights"), WEIGHTS.v);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer());
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return new YuvConverter(gl, size, texture);
  }

  async convert(source: TexImageSource, timestamp: number, duration: number): Promise<VideoFrame> {
    const { gl } = this;
    const buffer = this.idle.pop() ?? this.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, this.size.width / 4, (this.size.height * 3) / 2, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();

    while (sync && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) await nextTask();
    gl.deleteSync(sync);
    const data = new Uint8Array(this.byteLength);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
    this.idle.push(buffer);
    return new VideoFrame(data, {
      format: "I420",
      codedWidth: this.size.width,
      codedHeight: this.size.height,
      timestamp,
      duration,
      colorSpace: COLOR_SPACE,
    });
  }

  private createBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.PIXEL_PACK_BUFFER, buffer);
    this.gl.bufferData(this.gl.PIXEL_PACK_BUFFER, this.byteLength, this.gl.STREAM_READ);
    return buffer;
  }
}
