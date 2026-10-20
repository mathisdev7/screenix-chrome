import { Compositor, type SceneInputs } from "@/render/compositor";
import { encoderSizeForShortSide, outputAspect, type Size } from "@/render/geometry";
import type { ProjectMedia } from "@/render/projectMedia";
import { TimeMap } from "@/render/timeMap";
import { loadWatermark, paintWatermark } from "@/render/watermark";
import type { EditorSettings } from "@/shared/settings";
import { EXPORT_SAMPLE_RATE } from "./audioEncoding";
import { AudioMixer } from "./audioMixer";
import { VideoFileEncoder, type EncodedVideo, type EncoderPreference, type VideoFormat } from "./encoder";

const PREFETCH_FRAMES = 6;
const AUDIO_BLOCK_FRAMES = 4800;

export type ExportResolution = "720" | "1080" | "1440" | "2160" | "source";

export type ExportFrameRate = 30 | 60 | 120;

export interface ExportOptions {
  resolution: ExportResolution;
  fps: ExportFrameRate;
  format: VideoFormat;
  encoder: EncoderPreference;
}

export function exportSize(settings: EditorSettings, source: Size, resolution: ExportResolution): Size {
  const aspect = outputAspect(settings, source);
  const shortSide = resolution === "source" ? Math.min(source.width, source.height) : Number(resolution);
  return encoderSizeForShortSide(aspect, shortSide);
}

export async function exportVideo(
  media: ProjectMedia,
  inputs: SceneInputs,
  options: ExportOptions,
  watermarked: boolean,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<EncodedVideo> {
  const size = exportSize(inputs.settings, media.source, options.resolution);
  const map = TimeMap.fromSettings(inputs.settings, media.project.duration);
  const frameCount = Math.max(1, Math.ceil(map.outputDuration * options.fps));
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not create a drawing surface for the export.");

  const compositor = new Compositor(inputs);
  const watermark = watermarked ? await loadWatermark() : null;
  const frames = media.frames.clone();
  const camera = inputs.settings.camera.enabled ? media.camera?.clone() ?? null : null;
  const mixer = new AudioMixer(media.audio, inputs.settings.audio, map);
  const totalAudioFrames = Math.round((frameCount / options.fps) * EXPORT_SAMPLE_RATE);
  let audioFrame = 0;
  const encoder = await VideoFileEncoder.create(size, options.fps, options, mixer.hasAudio);
  try {
    for (let index = 0; index < frameCount; index++) {
      if (signal.aborted) throw new DOMException("Export canceled", "AbortError");
      const time = map.sourceAt(index / options.fps);
      const frameIndex = frames.indexAt(time);
      const frame = frameIndex >= 0 ? await frames.decode(frameIndex) : null;
      frames.pin(frameIndex);
      frames.prefetch(frameIndex + 1, PREFETCH_FRAMES);
      const cameraIndex = camera?.indexAt(time) ?? -1;
      const cameraFrame = camera && cameraIndex >= 0 ? await camera.decode(cameraIndex) : null;
      camera?.pin(cameraIndex);
      compositor.render(ctx, size, time, frame, cameraFrame);
      if (watermark) paintWatermark(ctx, size, watermark);
      await encoder.addFrame(canvas, index);
      const audioTarget = mixer.hasAudio ? Math.min(totalAudioFrames, Math.round(((index + 1) / options.fps) * EXPORT_SAMPLE_RATE)) : 0;
      while (audioFrame < audioTarget) {
        const count = Math.min(AUDIO_BLOCK_FRAMES, audioTarget - audioFrame);
        await encoder.addAudio(mixer.read(audioFrame, count), count, audioFrame);
        audioFrame += count;
      }
      onProgress((index + 1) / frameCount);
    }
    return await encoder.finish();
  } catch (error) {
    encoder.cancel();
    throw error;
  } finally {
    frames.dispose();
    camera?.dispose();
  }
}
