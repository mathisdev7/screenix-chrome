import type { CursorSprite } from "./theme";

const MAX_BLUR_SAMPLES = 21;
const BOUNDS_MARGIN = 2;
const PIXEL_EXACT_SIZE_TOLERANCE = 0.02;
const RESTING_MOTION = 0.01;

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
  shadowBlur: number;
  shadowColor: string;
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
    if (this.paintPixelExact(ctx, paint, pivotX, pivotY)) return;
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
    layer.imageSmoothingQuality = "high";
    layer.translate(pivotX - left, pivotY - top);
    layer.rotate(angle);
    layer.globalCompositeOperation = motion.samples > 1 ? "lighter" : "source-over";
    layer.globalAlpha = 1 / motion.samples;
    for (let sample = 0; sample < motion.samples; sample++) {
      const progress = motion.samples > 1 ? sample / (motion.samples - 1) : 0;
      layer.drawImage(sprite.image, -hotspotX - motion.x * progress, -hotspotY - motion.y * progress, displayWidth, displayHeight);
    }

    drawWithShadow(ctx, paint, this.layer, left, top);
  }

  private paintPixelExact(ctx: Context2D, paint: CursorPaint, pivotX: number, pivotY: number): boolean {
    const { sprite } = paint;
    const transform = ctx.getTransform();
    const imageWidth = sprite.image.width;
    const resting = paint.rotationDeg === 0 && Math.hypot(paint.motionX, paint.motionY) < RESTING_MOTION;
    const unscaled = transform.a === 1 && transform.d === 1 && transform.b === 0 && transform.c === 0;
    if (!resting || !unscaled || Math.abs(imageWidth / (paint.width * paint.scale) - 1) > PIXEL_EXACT_SIZE_TOLERANCE) return false;
    const x = Math.round(pivotX - sprite.hotspot[0] * imageWidth + transform.e) - transform.e;
    const y = Math.round(pivotY - sprite.hotspot[1] * imageWidth + transform.f) - transform.f;
    drawWithShadow(ctx, paint, sprite.image, x, y);
    return true;
  }
}

function drawWithShadow(ctx: Context2D, paint: CursorPaint, image: CanvasImageSource, x: number, y: number) {
  ctx.save();
  ctx.globalAlpha = paint.opacity;
  if (paint.shadowBlur > 0) {
    ctx.shadowColor = paint.shadowColor;
    ctx.shadowBlur = paint.shadowBlur;
  }
  ctx.drawImage(image, x, y);
  ctx.restore();
}
