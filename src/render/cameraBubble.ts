import type { CameraSettings } from "@/shared/settings";
import { coverRect, roundedShapePath, type Rect, type Size } from "./geometry";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const MARGIN_RATIO = 0.04;
const SHADOW_ALPHA = 0.35;
const SHADOW_BLUR_RATIO = 0.12;
const SHADOW_OFFSET_RATIO = 0.04;

interface BubbleArea {
  size: number;
  margin: number;
  travelX: number;
  travelY: number;
}

function bubbleArea(output: Size, settings: CameraSettings): BubbleArea {
  const unit = Math.min(output.width, output.height);
  const size = settings.size * unit;
  const margin = MARGIN_RATIO * unit;
  return { size, margin, travelX: Math.max(0, output.width - margin * 2 - size), travelY: Math.max(0, output.height - margin * 2 - size) };
}

export function cameraBubbleRect(output: Size, settings: CameraSettings): Rect {
  const { size, margin, travelX, travelY } = bubbleArea(output, settings);
  return { x: margin + settings.x * travelX, y: margin + settings.y * travelY, width: size, height: size };
}

export function cameraPositionAt(output: Size, settings: CameraSettings, left: number, top: number): { x: number; y: number } {
  const { margin, travelX, travelY } = bubbleArea(output, settings);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    x: travelX > 0 ? clamp((left - margin) / travelX) : 0.5,
    y: travelY > 0 ? clamp((top - margin) / travelY) : 0.5,
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
