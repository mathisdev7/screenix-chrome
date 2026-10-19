import { CURSOR_SHAPES, type CursorShape } from "@/shared/cursorShapes";
import type { CursorThemeId } from "@/shared/cursorThemes";
import HOTSPOTS from "./themeHotspots.json";

const RASTER_WIDTH = 256;

const PNG_SHAPES = new Set<CursorShape>(["default", "text", "hand", "crosshair"]);

type Hotspot = readonly [number, number];

export interface CursorSprite {
  image: OffscreenCanvas;
  hotspot: Hotspot;
  aspect: number;
}

export type CursorSprites = Record<CursorShape, CursorSprite>;

export function cursorAssetUrl(theme: CursorThemeId, shape: CursorShape): string {
  if (theme === "macos_tahoe") return `/cursors/${shape}.svg`;
  const extension = theme === "macos_dark" && PNG_SHAPES.has(shape) ? "png" : "svg";
  return `/cursors/themes/${theme}/${shape}.${extension}`;
}

async function loadSprite(theme: CursorThemeId, shape: CursorShape): Promise<CursorSprite> {
  const image = new Image();
  image.src = cursorAssetUrl(theme, shape);
  await image.decode();
  const aspect = image.naturalHeight / image.naturalWidth;
  const canvas = new OffscreenCanvas(RASTER_WIDTH, Math.round(RASTER_WIDTH * aspect));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const [x, y] = HOTSPOTS[theme][shape];
  return { image: canvas, hotspot: [x, y], aspect };
}

const spritePromises = new Map<CursorThemeId, Promise<CursorSprites>>();

export function loadCursorSprites(theme: CursorThemeId): Promise<CursorSprites> {
  let promise = spritePromises.get(theme);
  if (!promise) {
    promise = Promise.all(CURSOR_SHAPES.map(async (shape) => [shape, await loadSprite(theme, shape)] as const))
      .then((entries) => Object.fromEntries(entries) as CursorSprites);
    spritePromises.set(theme, promise);
  }
  return promise;
}
