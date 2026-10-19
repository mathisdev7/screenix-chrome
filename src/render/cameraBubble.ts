import type { CameraSettings } from "@/shared/settings";
import { coverRect, roundedShapePath, type Rect, type Size } from "./geometry";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const MARGIN_RATIO = 0.04;
const SHADOW_ALPHA = 0.35;
const SHADOW_BLUR_RATIO = 0.12;
const SHADOW_OFFSET_RATIO = 0.04;

export function cameraBubbleRect(output: Size, settings: CameraSettings): Rect {
  const unit = Math.min(output.width, output.height);
  const size = settings.size * unit;
  const margin = MARGIN_RATIO * unit;
  return {
    x: settings.position.endsWith("left") ? margin : output.width - margin - size,
    y: settings.position.startsWith("top") ? margin : output.height - margin - size,
    width: size,
    height: size,
  };
}

function bubblePath(rect: Rect, settings: CameraSettings): Path2D {
  const radius = settings.roundness * rect.width;
  if (radius < rect.width / 2 - 0.5) return roundedShapePath(rect, radius, settings.squircle);
  const path = new Path2D();
  path.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, 0, Math.PI * 2);
  return path;
}

export function paintCameraBubble(ctx: Context2D, output: Size, settings: CameraSettings, frame: ImageBitmap) {
  const rect = cameraBubbleRect(output, settings);
  const path = bubblePath(rect, settings);

  ctx.save();
  if (settings.shadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${SHADOW_ALPHA * settings.shadow})`;
    ctx.shadowBlur = rect.width * SHADOW_BLUR_RATIO * settings.shadow;
    ctx.shadowOffsetY = rect.width * SHADOW_OFFSET_RATIO * settings.shadow;
  }
  ctx.fillStyle = "#000";
  ctx.fill(path);
  ctx.restore();

  ctx.save();
  ctx.clip(path);
  const image = coverRect(rect, frame);
  if (settings.mirror) {
    ctx.translate(rect.x * 2 + rect.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(frame, image.x, image.y, image.width, image.height);
  ctx.restore();
}
