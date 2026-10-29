import { Compositor, type SceneInputs } from "@/render/compositor";
import { encoderSizeForShortSide, outputAspect } from "@/render/geometry";
import type { ProjectMedia } from "@/render/projectMedia";
import { TimeMap } from "@/render/timeMap";

const THUMBNAIL_SHORT_SIDE = 720;
const THUMBNAIL_QUALITY = 0.82;

export async function renderThumbnail(media: ProjectMedia, inputs: SceneInputs): Promise<Blob | null> {
  const size = encoderSizeForShortSide(outputAspect(inputs.settings, media.source), THUMBNAIL_SHORT_SIDE);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  const start = TimeMap.fromSettings(inputs.settings, media.project.duration).sourceAt(0);
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
