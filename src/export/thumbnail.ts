import { Compositor, type SceneInputs } from "@/render/compositor";
import { aspectValue, encoderSizeForShortSide } from "@/render/geometry";
import type { ProjectMedia } from "@/render/projectMedia";
import { trimmedRange } from "./exportVideo";

const THUMBNAIL_SHORT_SIDE = 720;
const THUMBNAIL_QUALITY = 0.82;

export async function renderThumbnail(media: ProjectMedia, inputs: SceneInputs): Promise<Blob | null> {
  const size = encoderSizeForShortSide(aspectValue(inputs.settings.aspectRatio, media.source), THUMBNAIL_SHORT_SIDE);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  const { start } = trimmedRange(inputs.settings, media.project.duration);
  const frames = media.frames.clone();
  const camera = inputs.settings.camera.enabled ? media.camera?.clone() ?? null : null;
  try {
    const frameIndex = frames.indexAt(start);
    const cameraIndex = camera?.indexAt(start) ?? -1;
    const frame = frameIndex >= 0 ? await frames.decode(frameIndex) : null;
    const cameraFrame = camera && cameraIndex >= 0 ? await camera.decode(cameraIndex) : null;
    new Compositor(inputs).render(ctx, size, start, frame, cameraFrame);
    return await canvas.convertToBlob({ type: "image/jpeg", quality: THUMBNAIL_QUALITY });
  } finally {
    frames.dispose();
    camera?.dispose();
  }
}
