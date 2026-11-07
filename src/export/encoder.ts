import type { Size } from "@/render/geometry";
import { AudioTrackEncoder, planAudio } from "./audioEncoding";
import { createMuxer, type Container, type Muxer, type MuxerVideoTrack } from "./muxer";
import { YuvReader } from "./yuvReader";

const BITS_PER_PIXEL_FRAME = 0.12;
const MAX_ENCODE_QUEUE = 4;
const MAX_READBACKS = 12;
const KEYFRAME_INTERVAL_SECONDS = 2;
const TRIAL_TIMEOUT_MS = 3000;

export type VideoFormat = "mp4-h264" | "webm-vp9";

export type EncoderPreference = "software" | "hardware";

export interface EncoderChoice {
  format: VideoFormat;
  encoder: EncoderPreference;
  latency?: LatencyMode;
}

interface FormatSpec {
  container: Container;
  codecs: readonly string[];
  muxerCodec: MuxerVideoTrack["codec"];
  quantizer: { key: "avc" | "vp9"; value: number };
}

const FORMATS: Record<VideoFormat, FormatSpec> = {
  "mp4-h264": {
    container: "mp4",
    codecs: ["avc1.640034", "avc1.4d0034"],
    muxerCodec: "avc",
    quantizer: { key: "avc", value: 20 },
  },
  "webm-vp9": {
    container: "webm",
    codecs: ["vp09.00.50.08", "vp09.00.41.08"],
    muxerCodec: "V_VP9",
    quantizer: { key: "vp9", value: 20 },
  },
};

const ACCELERATION: Record<EncoderPreference, HardwareAcceleration> = {
  software: "prefer-software",
  hardware: "prefer-hardware",
};

export const FORMAT_LABELS: Record<VideoFormat, string> = {
  "mp4-h264": "MP4 · H.264",
  "webm-vp9": "WebM · VP9",
};

export interface EncodedVideo {
  blob: Blob;
  format: VideoFormat;
  extension: FormatSpec["container"];
}

export interface EncoderSupport {
  available: boolean;
  constantQuality: boolean;
}

interface EncoderPlan {
  config: VideoEncoderConfig;
  frameOptions: VideoEncoderEncodeOptions;
}

function baseConfig(codec: string, spec: FormatSpec, choice: EncoderChoice, size: Size, fps: number): VideoEncoderConfig {
  return {
    codec,
    width: size.width,
    height: size.height,
    framerate: fps,
    hardwareAcceleration: ACCELERATION[choice.encoder],
    latencyMode: choice.latency ?? "quality",
    ...(spec.muxerCodec === "avc" ? { avc: { format: "avc" } } : {}),
  };
}

async function planEncoder(choice: EncoderChoice, size: Size, fps: number): Promise<EncoderPlan | null> {
  const spec = FORMATS[choice.format];
  for (const codec of spec.codecs) {
    const base = baseConfig(codec, spec, choice, size, fps);
    const constantQuality: VideoEncoderConfig = { ...base, bitrateMode: "quantizer" };
    if ((await VideoEncoder.isConfigSupported(constantQuality)).supported) {
      return { config: constantQuality, frameOptions: { [spec.quantizer.key]: { quantizer: spec.quantizer.value } } };
    }
    const targetBitrate: VideoEncoderConfig = { ...base, bitrate: Math.round(size.width * size.height * fps * BITS_PER_PIXEL_FRAME) };
    if ((await VideoEncoder.isConfigSupported(targetBitrate)).supported) return { config: targetBitrate, frameOptions: {} };
  }
  return null;
}

export async function encoderSupport(choice: EncoderChoice, size: Size, fps: number): Promise<EncoderSupport> {
  const plan = await planEncoder(choice, size, fps);
  return { available: plan !== null, constantQuality: plan?.config.bitrateMode === "quantizer" };
}

async function encodesFrame(plan: EncoderPlan, size: Size): Promise<boolean> {
  let produced = false;
  let failed = false;
  const encoder = new VideoEncoder({
    output: () => {
      produced = true;
    },
    error: () => {
      failed = true;
    },
  });
  const frame = new VideoFrame(new Uint8Array((size.width * size.height * 3) / 2), {
    format: "I420",
    codedWidth: size.width,
    codedHeight: size.height,
    timestamp: 0,
  });
  try {
    encoder.configure(plan.config);
    encoder.encode(frame, { ...plan.frameOptions, keyFrame: true });
    const flushed = await Promise.race([
      encoder.flush().then(() => true, () => false),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), TRIAL_TIMEOUT_MS)),
    ]);
    return flushed && produced && !failed;
  } catch {
    return false;
  } finally {
    frame.close();
    if (encoder.state !== "closed") encoder.close();
  }
}

export async function encoderWorks(choice: EncoderChoice, size: Size, fps: number): Promise<boolean> {
  const plan = await planEncoder(choice, size, fps);
  return plan !== null && encodesFrame(plan, size);
}

export const H264_ENCODERS: readonly EncoderChoice[] = [
  { format: "mp4-h264", encoder: "hardware" },
  { format: "mp4-h264", encoder: "software" },
];

export async function firstWorkingEncoder(candidates: readonly EncoderChoice[], size: Size, fps: number): Promise<EncoderChoice | null> {
  for (const choice of candidates) {
    if (await encoderWorks(choice, size, fps)) return choice;
  }
  return null;
}

export async function preferredEncoder(format: VideoFormat, size: Size, fps: number): Promise<EncoderPreference> {
  return (await encoderWorks({ format, encoder: "hardware" }, size, fps)) ? "hardware" : "software";
}

export class VideoFileEncoder {
  private readonly encoder: VideoEncoder;
  private readonly frameOptions: VideoEncoderEncodeOptions;
  private readonly keyframeInterval: number;
  private lastKeyframe = -Infinity;
  private error: Error | null = null;
  private readonly readbacks: { index: number; frame: Promise<VideoFrame> }[] = [];

  private constructor(
    plan: EncoderPlan,
    private readonly muxer: Muxer,
    private readonly audio: AudioTrackEncoder | null,
    private readonly format: VideoFormat,
    private readonly fps: number,
    private readonly reader: YuvReader | null,
  ) {
    this.frameOptions = plan.frameOptions;
    this.keyframeInterval = Math.round(fps * KEYFRAME_INTERVAL_SECONDS);
    this.encoder = new VideoEncoder({
      output: (chunk, metadata) => this.muxer.addVideoChunk(chunk, metadata),
      error: (error) => {
        this.error = error;
      },
    });
    this.encoder.configure(plan.config);
  }

  static async create(size: Size, fps: number, choice: EncoderChoice, withAudio: boolean): Promise<VideoFileEncoder> {
    const plan = await planEncoder(choice, size, fps);
    if (!plan) {
      throw new Error(`The ${choice.encoder} ${FORMAT_LABELS[choice.format]} encoder isn't available at this size. Try another format or a lower resolution.`);
    }
    const spec = FORMATS[choice.format];
    const audioPlan = withAudio ? await planAudio(spec.container) : null;
    if (withAudio && !audioPlan) throw new Error(`This browser can't encode audio for ${FORMAT_LABELS[choice.format]}. Try another format.`);
    const muxer = createMuxer(spec.container, { codec: spec.muxerCodec, size, fps }, audioPlan?.track ?? null);
    const audio = audioPlan ? new AudioTrackEncoder(audioPlan, muxer) : null;
    const reader = choice.encoder === "software" ? await YuvReader.create(size) : null;
    return new VideoFileEncoder(plan, muxer, audio, choice.format, fps, reader);
  }

  async addFrame(canvas: OffscreenCanvas, index: number) {
    if (this.error) throw this.error;
    const timestamp = Math.round((index * 1_000_000) / this.fps);
    const duration = Math.round(1_000_000 / this.fps);
    if (!this.reader) return this.encode(index, new VideoFrame(canvas, { timestamp, duration }));
    this.readbacks.push({ index, frame: this.reader.read(canvas, timestamp, duration) });
    while (this.readbacks.length > MAX_READBACKS) await this.encodeNext();
  }

  private async encodeNext() {
    const next = this.readbacks.shift();
    if (next) await this.encode(next.index, await next.frame);
  }

  private async encode(index: number, frame: VideoFrame) {
    while (this.encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
      await new Promise((resolve) => this.encoder.addEventListener("dequeue", resolve, { once: true }));
    }
    const keyFrame = index - this.lastKeyframe >= this.keyframeInterval;
    if (keyFrame) this.lastKeyframe = index;
    this.encoder.encode(frame, { ...this.frameOptions, keyFrame });
    frame.close();
  }

  async addAudio(planar: Float32Array<ArrayBuffer>, frameCount: number, startFrame: number) {
    await this.audio?.addSamples(planar, frameCount, startFrame);
  }

  async finish(): Promise<EncodedVideo> {
    while (this.readbacks.length > 0) await this.encodeNext();
    await Promise.all([this.encoder.flush(), this.audio?.flush()]);
    if (this.error) throw this.error;
    this.encoder.close();
    this.reader?.dispose();
    return { blob: this.muxer.finish(), format: this.format, extension: FORMATS[this.format].container };
  }

  cancel() {
    if (this.encoder.state !== "closed") this.encoder.close();
    this.audio?.cancel();
    for (const { frame } of this.readbacks.splice(0)) void frame.then((pending) => pending.close(), () => undefined);
    this.reader?.dispose();
  }
}
