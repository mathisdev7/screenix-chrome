import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import type { Size } from "./geometry";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const TEXT = "Made with screenix.studio";
const FONT_FAMILY = "Screenix Watermark";
const FONT_WEIGHT = 600;
const FONT_SIZE_RATIO = 0.045;
const MAX_WIDTH_RATIO = 0.6;
const BOTTOM_MARGIN_RATIO = 0.05;
const TEXT_COLOR = "rgba(255, 255, 255, 0.92)";
const SHADOW_COLOR = "rgba(0, 0, 0, 0.5)";

function fontSet(): FontFaceSet {
  return typeof document === "undefined" ? (self as unknown as { fonts: FontFaceSet }).fonts : document.fonts;
}

let fontPromise: Promise<void> | null = null;

function loadFont(): Promise<void> {
  fontPromise ??= new FontFace(FONT_FAMILY, `url(${interUrl})`, { weight: "100 900" })
    .load()
    .then((font) => void fontSet().add(font))
    .catch(() => undefined);
  return fontPromise;
}

function fontFor(size: number): string {
  return `${FONT_WEIGHT} ${size}px "${FONT_FAMILY}", "Inter Variable", Inter, system-ui, sans-serif`;
}

export class Watermark {
  private cached: { key: string; image: OffscreenCanvas; x: number; y: number } | null = null;

  paint(ctx: Context2D, output: Size) {
    const key = `${output.width}x${output.height}`;
    if (this.cached?.key !== key) this.cached = { key, ...this.render(output) };
    const { image, x, y } = this.cached;
    ctx.drawImage(image, x, y);
  }

  private render(output: Size): { image: OffscreenCanvas; x: number; y: number } {
    const measure = new OffscreenCanvas(1, 1).getContext("2d");
    if (!measure) throw new Error("Could not create a drawing surface for the watermark.");
    let fontSize = output.height * FONT_SIZE_RATIO;
    measure.font = fontFor(fontSize);
    const maxWidth = output.width * MAX_WIDTH_RATIO;
    const measured = measure.measureText(TEXT).width;
    if (measured > maxWidth) fontSize *= maxWidth / measured;

    const blur = fontSize * 0.3;
    const offsetY = fontSize * 0.06;
    const padding = Math.ceil(blur * 2 + offsetY);
    measure.font = fontFor(fontSize);
    const { width: textWidth, actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = measure.measureText(TEXT);
    const image = new OffscreenCanvas(Math.ceil(textWidth) + padding * 2, Math.ceil(ascent + descent) + padding * 2);
    const ctx = image.getContext("2d");
    if (!ctx) throw new Error("Could not create a drawing surface for the watermark.");
    ctx.font = fontFor(fontSize);
    ctx.fillStyle = TEXT_COLOR;
    ctx.shadowColor = SHADOW_COLOR;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = offsetY;
    ctx.fillText(TEXT, padding, padding + ascent);

    const x = Math.round((output.width - image.width) / 2);
    const y = Math.round(output.height * (1 - BOTTOM_MARGIN_RATIO) - image.height + padding);
    return { image, x, y };
  }
}

export async function loadWatermark(): Promise<Watermark> {
  await loadFont();
  return new Watermark();
}

export function paintWatermark(ctx: Context2D, output: Size, watermark: Watermark) {
  watermark.paint(ctx, output);
}
