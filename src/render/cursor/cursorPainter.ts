import { spriteImageAt, type CursorSprite } from "./theme";

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

function clampMotion(motionX: number, motionY: number, pixelScale: number, displayWidth: number, displayHeight: number): Motion {
  const length = Math.hypot(motionX, motionY);
  const uvLength = Math.hypot(motionX / displayWidth, motionY / displayHeight);
  const factor = Math.min(1, (480 * pixelScale) / Math.max(length, 1e-6), 4 / Math.max(uvLength, 1e-6));
  const blurred = length * factor >= 0.5 * pixelScale && uvLength * factor >= 0.005;
  if (!blurred) return { x: 0, y: 0, samples: 1 };
  const samples = Math.min(MAX_BLUR_SAMPLES, Math.max(2, Math.ceil(length * factor) + 1));
  return { x: motionX * factor, y: motionY * factor, samples };
}

export class CursorPainter {
  private readonly layer = new OffscreenCanvas(1, 1);
  private readonly layerContext = this.layer.getContext("2d");

  paint(ctx: Context2D, paint: CursorPaint) {
    const { sprite, scale, opacity, width } = paint;
    if (opacity <= 0 || width <= 0 || scale <= 0 || !this.layerContext) return;

    const transform = ctx.getTransform();
    const deviceScale = Math.hypot(transform.a, transform.b);
    const displayWidth = width * scale * deviceScale;
    const displayHeight = displayWidth * sprite.aspect;
    const image = spriteImageAt(sprite, displayWidth);
    const hotspotX = sprite.hotspot[0] * displayWidth;
    const hotspotY = sprite.hotspot[1] * displayWidth;
    const pivot = transform.transformPoint({ x: paint.x + sprite.hotspot[0] * width, y: paint.y + sprite.hotspot[1] * width });
    const shadowBlur = paint.shadowBlur * deviceScale;

    const resting = paint.rotationDeg === 0 && Math.hypot(paint.motionX, paint.motionY) < RESTING_MOTION;
    if (resting && Math.abs(image.width / displayWidth - 1) <= PIXEL_EXACT_SIZE_TOLERANCE) {
      const x = Math.round(pivot.x - sprite.hotspot[0] * image.width);
      const y = Math.round(pivot.y - sprite.hotspot[1] * image.width);
      drawWithShadow(ctx, paint, shadowBlur, image, x, y);
      return;
    }

    const motion = clampMotion(paint.motionX * deviceScale, paint.motionY * deviceScale, paint.pixelScale * deviceScale, displayWidth, displayHeight);
    const angle = (paint.rotationDeg * Math.PI) / 180;
    const reach = Math.hypot(displayWidth, displayHeight) + Math.hypot(motion.x, motion.y) + BOUNDS_MARGIN;
    const left = Math.floor(pivot.x - reach);
    const top = Math.floor(pivot.y - reach);
    const size = Math.ceil(reach * 2);
    if (this.layer.width !== size || this.layer.height !== size) {
      this.layer.width = size;
      this.layer.height = size;
    }

    const layer = this.layerContext;
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, size, size);
    layer.imageSmoothingQuality = "high";
    layer.translate(pivot.x - left, pivot.y - top);
    layer.rotate(angle);
    layer.globalCompositeOperation = motion.samples > 1 ? "lighter" : "source-over";
    layer.globalAlpha = 1 / motion.samples;
    for (let sample = 0; sample < motion.samples; sample++) {
      const progress = motion.samples > 1 ? sample / (motion.samples - 1) : 0;
      layer.drawImage(image, -hotspotX - motion.x * progress, -hotspotY - motion.y * progress, displayWidth, displayHeight);
    }

    drawWithShadow(ctx, paint, shadowBlur, this.layer, left, top);
  }
}

function drawWithShadow(ctx: Context2D, paint: CursorPaint, shadowBlur: number, image: CanvasImageSource, x: number, y: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = paint.opacity;
  if (shadowBlur > 0) {
    ctx.shadowColor = paint.shadowColor;
    ctx.shadowBlur = shadowBlur;
  }
  ctx.drawImage(image, x, y);
  ctx.restore();
}
