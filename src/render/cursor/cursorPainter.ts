import type { CursorSprite } from "./theme";

const MAX_BLUR_SAMPLES = 21;
const BOUNDS_MARGIN = 2;

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export interface CursorPaint {
  sprite: CursorSprite;
  x: number;
  y: number;
  width: number;
  scale: number;
  rotationDeg: number;
  motionX: number;
  motionY: number;
  pixelScale: number;
  opacity: number;
  shadowFilter: string;
}

interface Motion {
  x: number;
  y: number;
  samples: number;
}

function clampMotion(paint: CursorPaint, displayWidth: number, displayHeight: number): Motion {
  const length = Math.hypot(paint.motionX, paint.motionY);
  const uvLength = Math.hypot(paint.motionX / displayWidth, paint.motionY / displayHeight);
  const factor = Math.min(1, (480 * paint.pixelScale) / Math.max(length, 1e-6), 4 / Math.max(uvLength, 1e-6));
  const blurred = length * factor >= 0.5 * paint.pixelScale && uvLength * factor >= 0.005;
  if (!blurred) return { x: 0, y: 0, samples: 1 };
  const samples = Math.min(MAX_BLUR_SAMPLES, Math.max(2, Math.ceil(length * factor) + 1));
  return { x: paint.motionX * factor, y: paint.motionY * factor, samples };
}

export class CursorPainter {
  private readonly layer = new OffscreenCanvas(1, 1);
  private readonly layerContext = this.layer.getContext("2d");

  paint(ctx: Context2D, paint: CursorPaint) {
    const { sprite, scale, opacity, width } = paint;
    if (opacity <= 0 || width <= 0 || scale <= 0 || !this.layerContext) return;

    const displayWidth = width * scale;
    const displayHeight = displayWidth * sprite.aspect;
    const hotspotX = sprite.hotspot[0] * width * scale;
    const hotspotY = sprite.hotspot[1] * width * scale;
    const pivotX = paint.x + sprite.hotspot[0] * width;
    const pivotY = paint.y + sprite.hotspot[1] * width;
    const motion = clampMotion(paint, displayWidth, displayHeight);
    const angle = (paint.rotationDeg * Math.PI) / 180;

    const reach = Math.hypot(displayWidth, displayHeight) + Math.hypot(motion.x, motion.y) + BOUNDS_MARGIN;
    const left = Math.floor(pivotX - reach);
    const top = Math.floor(pivotY - reach);
    const size = Math.ceil(reach * 2);
    if (this.layer.width !== size || this.layer.height !== size) {
      this.layer.width = size;
      this.layer.height = size;
    }

    const layer = this.layerContext;
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, size, size);
    layer.translate(pivotX - left, pivotY - top);
    layer.rotate(angle);
    layer.globalCompositeOperation = motion.samples > 1 ? "lighter" : "source-over";
    layer.globalAlpha = 1 / motion.samples;
    for (let sample = 0; sample < motion.samples; sample++) {
      const progress = motion.samples > 1 ? sample / (motion.samples - 1) : 0;
      layer.drawImage(sprite.image, -hotspotX - motion.x * progress, -hotspotY - motion.y * progress, displayWidth, displayHeight);
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.filter = paint.shadowFilter || "none";
    ctx.drawImage(this.layer, left, top);
    ctx.restore();
  }
}
