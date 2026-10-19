import type { Size } from "./geometry";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const WATERMARK_URL = "/watermark.png";
const HEIGHT_RATIO = 0.12;
const BOTTOM_MARGIN_RATIO = 0.05;

let watermarkPromise: Promise<ImageBitmap> | null = null;

export function loadWatermark(): Promise<ImageBitmap> {
  watermarkPromise ??= fetch(WATERMARK_URL)
    .then((response) => response.blob())
    .then((blob) => createImageBitmap(blob));
  return watermarkPromise;
}

export function paintWatermark(ctx: Context2D, output: Size, watermark: ImageBitmap) {
  const height = Math.round(output.height * HEIGHT_RATIO);
  const width = Math.round((height * watermark.width) / watermark.height);
  const x = Math.floor((output.width - width) / 2);
  const y = output.height - height - Math.round(output.height * BOTTOM_MARGIN_RATIO);
  ctx.drawImage(watermark, x, y, width, height);
}
