import type { BackgroundSettings } from "@/shared/settings";
import { coverRect, type Size } from "./geometry";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function cssLinearGradient(ctx: Context2D, size: Size, angleDeg: number, from: string, to: string): CanvasGradient {
  const angle = (angleDeg * Math.PI) / 180;
  const dirX = Math.sin(angle);
  const dirY = -Math.cos(angle);
  const halfLength = (Math.abs(size.width * dirX) + Math.abs(size.height * dirY)) / 2;
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  const gradient = ctx.createLinearGradient(
    centerX - dirX * halfLength,
    centerY - dirY * halfLength,
    centerX + dirX * halfLength,
    centerY + dirY * halfLength,
  );
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
}

export function paintBackground(ctx: Context2D, size: Size, settings: BackgroundSettings, wallpaper: ImageBitmap | null) {
  if (settings.kind === "image" && wallpaper) {
    const rect = coverRect({ x: 0, y: 0, ...size }, wallpaper);
    ctx.drawImage(wallpaper, rect.x, rect.y, rect.width, rect.height);
    return;
  }
  ctx.fillStyle = settings.kind === "gradient"
    ? cssLinearGradient(ctx, size, settings.gradientAngle, settings.color, settings.gradientEndColor)
    : settings.color;
  ctx.fillRect(0, 0, size.width, size.height);
}

export class BackgroundLayer {
  private canvas: OffscreenCanvas | null = null;
  private key = "";
  private wallpaper: ImageBitmap | null = null;

  get(size: Size, settings: BackgroundSettings, wallpaper: ImageBitmap | null): OffscreenCanvas {
    const key = JSON.stringify([size.width, size.height, settings.kind, settings.color, settings.gradientEndColor, settings.gradientAngle]);
    if (this.canvas && key === this.key && wallpaper === this.wallpaper) return this.canvas;
    this.canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = this.canvas.getContext("2d");
    if (ctx) paintBackground(ctx, size, settings, wallpaper);
    this.key = key;
    this.wallpaper = wallpaper;
    return this.canvas;
  }
}
