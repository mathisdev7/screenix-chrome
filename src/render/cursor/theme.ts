import { CURSOR_SHAPES, type CursorShape } from "@/shared/cursorShapes";
import type { CursorThemeId } from "@/shared/cursorThemes";
import HOTSPOTS from "./themeHotspots.json";

const RASTER_WIDTH = 256;
const MAX_RASTERS_PER_SPRITE = 6;

const PNG_SHAPES = new Set<CursorShape>(["default", "text", "hand", "crosshair"]);

type Hotspot = readonly [number, number];

export interface CursorSprite {
  image: OffscreenCanvas | ImageBitmap;
  hotspot: Hotspot;
  aspect: number;
  source?: HTMLImageElement;
}

export type CursorSprites = Record<CursorShape, CursorSprite>;

export function cursorAssetUrl(theme: CursorThemeId, shape: CursorShape): string {
  if (theme === "macos_tahoe") return `/cursors/${shape}.svg`;
  const extension = theme === "macos_dark" && PNG_SHAPES.has(shape) ? "png" : "svg";
  return `/cursors/themes/${theme}/${shape}.${extension}`;
}

function rasterize(source: HTMLImageElement, width: number, aspect: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, Math.max(1, Math.round(width * aspect)));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

async function loadSprite(theme: CursorThemeId, shape: CursorShape, width: number): Promise<CursorSprite> {
  const source = new Image();
  source.src = cursorAssetUrl(theme, shape);
  await source.decode();
  const aspect = source.naturalHeight / source.naturalWidth;
  const [x, y] = HOTSPOTS[theme][shape];
  return { image: rasterize(source, width, aspect), hotspot: [x, y], aspect, source };
}

async function loadSprites(theme: CursorThemeId, width: number): Promise<CursorSprites> {
  const entries = await Promise.all(CURSOR_SHAPES.map(async (shape) => [shape, await loadSprite(theme, shape, width)] as const));
  return Object.fromEntries(entries) as CursorSprites;
}

export async function rasterizeCursorSprites(theme: CursorThemeId, width: number): Promise<CursorSprites> {
  const sprites = await loadSprites(theme, Math.max(1, Math.round(width)));
  for (const sprite of Object.values(sprites)) {
    if (sprite.image instanceof OffscreenCanvas) sprite.image = sprite.image.transferToImageBitmap();
    delete sprite.source;
  }
  return sprites;
}

const spritePromises = new Map<CursorThemeId, Promise<CursorSprites>>();

export function loadCursorSprites(theme: CursorThemeId): Promise<CursorSprites> {
  let promise = spritePromises.get(theme);
  if (!promise) {
    promise = loadSprites(theme, RASTER_WIDTH);
    spritePromises.set(theme, promise);
  }
  return promise;
}

const rasters = new WeakMap<CursorSprite, Map<number, OffscreenCanvas>>();

export function spriteImageAt(sprite: CursorSprite, width: number): OffscreenCanvas | ImageBitmap {
  if (!sprite.source) return sprite.image;
  const pixels = Math.max(1, Math.round(width));
  let sizes = rasters.get(sprite);
  if (!sizes) {
    sizes = new Map();
    rasters.set(sprite, sizes);
  }
  const image = sizes.get(pixels) ?? rasterize(sprite.source, pixels, sprite.aspect);
  sizes.delete(pixels);
  sizes.set(pixels, image);
  for (const size of sizes.keys()) {
    if (sizes.size <= MAX_RASTERS_PER_SPRITE) break;
    sizes.delete(size);
  }
  return image;
}
