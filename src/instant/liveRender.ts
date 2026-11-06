import { EXPORT_SAMPLE_RATE } from "@/export/audioEncoding";
import { VideoFileEncoder, type EncodedVideo } from "@/export/encoder";
import { BrowserPages, type BrowserPage } from "@/render/browserBar";
import { Compositor, type SceneInputs } from "@/render/compositor";
import { cursorStateAt } from "@/render/cursor/cursorState";
import type { CursorSprites } from "@/render/cursor/theme";
import type { ClickEvent } from "@/render/cursor/timeline";
import { FrameSequence } from "@/render/frameSequence";
import { alignedSizeWithin, frameRectFor, outputAspect, videoRectFor, type Size } from "@/render/geometry";
import { loadWallpaper } from "@/render/wallpapers";
import { loadWatermark, paintWatermark, type Watermark } from "@/render/watermark";
import { ZoomTimeline } from "@/render/zoom/zoomTimeline";
import { getCameraFramesAfter, getFramesAfter, getPointerBatchesAfter } from "@/shared/db";
import type { EditorSettings } from "@/shared/settings";
import type { AudioTrackKind, ProjectId } from "@/shared/types";
import { instantEncoderChoice } from "./instantEncoding";
import { LiveAudioMixer, type LiveAudioChunk } from "./liveAudioMixer";
import { LiveCursorTimeline, POINTER_LOOKAHEAD } from "./liveCursorTimeline";
import { LIVE_ZOOM_SCALE, LiveZoom } from "./liveZoom";

const FPS = 60;
const POLL_INTERVAL_MS = 200;
const ARRIVAL_SLACK = 0.6;
const PREFETCH_FRAMES = 6;
const MAX_HOLD_FRAMES = FPS / 10;
const CATCH_UP_SECONDS = 1;
const AUDIO_BLOCK_FRAMES = 4800;
const PROGRESS_EVERY_FRAMES = 10;
const FALLBACK_SOURCE: Size = { width: 1920, height: 1080 };
const MAX_OUTPUT_LONG_SIDE = 3840;
const POSTER_TIME = 1;
const POSTER_QUALITY = 0.85;
const WALLPAPER_TIMEOUT_MS = 5000;
const POSITION_STEPS = 4096;
const CLICK_EFFECT_WINDOW = 1;

export interface LiveRenderOptions {
  projectId: ProjectId;
  startedAt: number;
  settings: EditorSettings;
  watermarked: boolean;
  autoZoom: boolean;
  audioTracks: readonly AudioTrackKind[];
}

export interface LiveRenderResult {
  video: EncodedVideo;
  poster: Blob | null;
}

interface Output {
  size: Size;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  inputs: SceneInputs;
  compositor: Compositor;
  encoder: VideoFileEncoder;
  watermark: Watermark | null;
}

function outputSize(source: Size, settings: EditorSettings): Size {
  const height = source.width / outputAspect(settings, source);
  const scale = Math.min(1, MAX_OUTPUT_LONG_SIDE / Math.max(source.width, height));
  return alignedSizeWithin({ width: source.width * scale, height: height * scale });
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

function hasRecentClick(clicks: readonly ClickEvent[], time: number): boolean {
  for (let index = clicks.length - 1; index >= 0 && clicks[index].t > time - CLICK_EFFECT_WINDOW; index--) {
    if (clicks[index].kind === "down" && clicks[index].t <= time) return true;
  }
  return false;
}

export class LiveRender {
  private readonly frames = new FrameSequence([]);
  private readonly camera = new FrameSequence([]);
  private readonly cursor: LiveCursorTimeline;
  private readonly audio: LiveAudioMixer;
  private readonly zoom: LiveZoom | null;
  private readonly lastSeq = { frames: -1, camera: -1, pointer: -1 };
  private readonly pages: BrowserPage[] = [];
  private browser = BrowserPages.empty;
  private output: Output | null = null;
  private nextFrame = 0;
  private audioFrame = 0;
  private lastKey = "";
  private lastEmitted = -Infinity;
  private poster: Blob | null = null;
  private duration: number | null = null;
  private wake: (() => void) | null = null;

  constructor(
    private readonly options: LiveRenderOptions,
    private readonly loadSprites: (width: number) => Promise<CursorSprites>,
    private readonly onProgress: (progress: number) => void,
  ) {
    this.cursor = new LiveCursorTimeline(options.settings.cursor.speed);
    this.audio = new LiveAudioMixer(options.audioTracks, options.settings.audio);
    this.zoom = options.autoZoom ? new LiveZoom(this.cursor.timeline.clicks, this.cursor.timeline.raw) : null;
  }

  addAudio(chunk: LiveAudioChunk) {
    this.audio.add(chunk);
  }

  addPage(page: BrowserPage) {
    const index = this.pages.findLastIndex((existing) => existing.t <= page.t);
    this.pages.splice(index + 1, 0, page);
    this.browser = new BrowserPages([...this.pages]);
    const output = this.output;
    if (!output) return;
    output.inputs = { ...output.inputs, browser: this.browser };
    output.compositor.update(output.inputs);
  }

  finish(duration: number) {
    this.duration = duration;
    this.wake?.();
  }

  async run(): Promise<LiveRenderResult> {
    try {
      for (;;) {
        const duration = this.duration;
        await this.poll();
        if (duration !== null) return await this.complete(duration);
        const knownUntil = (Date.now() - this.options.startedAt) / 1000 - ARRIVAL_SLACK;
        this.cursor.advance(knownUntil);
        await this.renderUntil(knownUntil - POINTER_LOOKAHEAD);
        await this.encodeAudio(this.audio.availableFrames());
        await this.sleep();
      }
    } catch (error) {
      this.output?.encoder.cancel();
      throw error;
    } finally {
      this.frames.dispose();
      this.camera.dispose();
    }
  }

  private async complete(duration: number): Promise<LiveRenderResult> {
    this.cursor.finish(duration);
    this.zoom?.finish(duration);
    const frameCount = Math.max(1, Math.ceil(duration * FPS));
    const output = this.output ?? await this.createOutput();
    this.output = output;
    for (; this.nextFrame < frameCount; this.nextFrame++) {
      await this.renderFrame(output, this.nextFrame, duration, this.nextFrame === frameCount - 1);
      if (this.nextFrame % PROGRESS_EVERY_FRAMES === 0) this.onProgress(this.nextFrame / frameCount);
    }
    await this.encodeAudio(Math.round((frameCount / FPS) * EXPORT_SAMPLE_RATE));
    const video = await output.encoder.finish();
    return { video, poster: this.poster };
  }

  private async poll() {
    const { projectId } = this.options;
    const [frames, camera, pointer] = await Promise.all([
      getFramesAfter(projectId, this.lastSeq.frames),
      getCameraFramesAfter(projectId, this.lastSeq.camera),
      getPointerBatchesAfter(projectId, this.lastSeq.pointer),
    ]);
    this.lastSeq.frames = frames.at(-1)?.seq ?? this.lastSeq.frames;
    this.lastSeq.camera = camera.at(-1)?.seq ?? this.lastSeq.camera;
    this.lastSeq.pointer = pointer.at(-1)?.seq ?? this.lastSeq.pointer;
    this.frames.append(frames.sort((a, b) => a.t - b.t));
    this.camera.append(camera.sort((a, b) => a.t - b.t));
    this.cursor.add(pointer.flatMap((batch) => batch.samples));
  }

  private sleep(): Promise<void> {
    if (this.duration !== null) return Promise.resolve();
    return new Promise((resolve) => {
      this.wake = resolve;
      setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }

  private async renderUntil(time: number) {
    if (time < 0 || this.frames.length === 0) return;
    const output = this.output ?? await this.createOutput();
    this.output = output;
    for (; this.nextFrame / FPS <= time; this.nextFrame++) await this.renderFrame(output, this.nextFrame, time, false);
  }

  private async createOutput(): Promise<Output> {
    const { settings, watermarked, projectId } = this.options;
    const { background } = settings;
    const source = this.frames.length > 0 ? await this.frameSize(this.frames.length - 1) : FALLBACK_SOURCE;
    const size = outputSize(source, settings);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not create a drawing surface for the instant video.");

    const frameWidth = frameRectFor(videoRectFor(size, source, background), source, background).width;
    const wallpaper = background.enabled && background.kind === "image"
      ? withTimeout(loadWallpaper(background.wallpaper, projectId).catch(() => null), WALLPAPER_TIMEOUT_MS, null)
      : null;
    const [{ sprites, zoomSprites }, wallpaperImage, watermark, choice] = await Promise.all([
      this.cursorSprites((settings.cursor.size / 100) * frameWidth),
      wallpaper,
      watermarked ? loadWatermark() : null,
      instantEncoderChoice(size, FPS),
    ]);
    const encoder = await VideoFileEncoder.create(size, FPS, choice, this.audio.hasAudio);
    const inputs: SceneInputs = {
      settings,
      source,
      timeline: this.cursor.timeline,
      zoom: this.zoom ?? ZoomTimeline.empty,
      sprites,
      zoomSprites,
      wallpaper: wallpaperImage,
      browser: this.browser,
    };
    return { size, canvas, ctx, inputs, compositor: new Compositor(inputs), encoder, watermark };
  }

  private async cursorSprites(width: number): Promise<{ sprites: CursorSprites; zoomSprites: CursorSprites | null }> {
    const sprites = await this.loadSprites(width);
    const zoomSprites = this.zoom ? await this.loadSprites(width * LIVE_ZOOM_SCALE) : null;
    return { sprites, zoomSprites };
  }

  private async frameSize(index: number): Promise<Size> {
    const { width, height } = await this.frames.decode(index);
    return { width, height };
  }

  private async renderFrame(output: Output, index: number, target: number, last: boolean) {
    const time = index / FPS;
    const catchingUp = target - time > CATCH_UP_SECONDS;
    if (catchingUp && index % 2 === 1 && !last) return;
    const frameIndex = this.frames.indexAt(time);
    const frame = frameIndex >= 0 ? await this.frames.decode(frameIndex) : null;
    this.frames.pin(frameIndex);
    this.frames.prefetch(frameIndex + 1, PREFETCH_FRAMES);
    const cameraIndex = this.options.settings.camera.enabled ? this.camera.indexAt(time) : -1;
    const cameraFrame = cameraIndex >= 0 ? await this.camera.decode(cameraIndex) : null;
    this.camera.pin(cameraIndex);
    if (cameraIndex >= 0) this.camera.prefetch(cameraIndex + 1, PREFETCH_FRAMES);

    const key = this.frameKey(time, frameIndex, cameraIndex, this.pages.findLastIndex((page) => page.t <= time));
    const unchanged = !last && key === this.lastKey;
    if (unchanged && index - this.lastEmitted < MAX_HOLD_FRAMES) return;
    if (!unchanged) {
      output.compositor.render(output.ctx, output.size, time, frame, cameraFrame);
      if (output.watermark) paintWatermark(output.ctx, output.size, output.watermark);
    }
    await output.encoder.addFrame(output.canvas, index);
    this.lastKey = key;
    this.lastEmitted = index;
    if (!this.poster && (time >= POSTER_TIME || last)) {
      this.poster = await output.canvas.convertToBlob({ type: "image/jpeg", quality: POSTER_QUALITY });
    }
  }

  private frameKey(time: number, frameIndex: number, cameraIndex: number, pageIndex: number): string {
    const { cursor } = this.options.settings;
    const effect = cursor.clickEffect !== "none" && hasRecentClick(this.cursor.timeline.clicks, time) ? time : "";
    const zoom = this.zoom?.at(time);
    const view = zoom ? [zoom.scale.toFixed(4), Math.round(zoom.centerX * POSITION_STEPS), Math.round(zoom.centerY * POSITION_STEPS)] : [];
    const state = cursorStateAt(this.cursor.timeline, time, cursor);
    if (!state) return [frameIndex, cameraIndex, pageIndex, effect, ...view].join("|");
    const position = [state.x, state.y, state.previousX, state.previousY].map((value) => Math.round(value * POSITION_STEPS));
    return [
      frameIndex,
      cameraIndex,
      pageIndex,
      effect,
      ...view,
      ...position,
      state.shape,
      state.scale.toFixed(3),
      state.rotationDeg.toFixed(2),
      state.opacity.toFixed(3),
    ].join("|");
  }

  private async encodeAudio(until: number) {
    const encoder = this.output?.encoder;
    if (!encoder || !this.audio.hasAudio) return;
    while (this.audioFrame < until) {
      const count = Math.min(AUDIO_BLOCK_FRAMES, until - this.audioFrame);
      await encoder.addAudio(this.audio.read(this.audioFrame, count), count, this.audioFrame);
      this.audioFrame += count;
    }
  }
}
