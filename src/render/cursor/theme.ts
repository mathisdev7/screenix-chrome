import { CURSOR_SHAPES, type CursorShape } from "@/shared/cursorShapes";

const RASTER_WIDTH = 256;

type Hotspot = readonly [number, number];

const BASE_HOTSPOT: Hotspot = [60 / 128, 54 / 128];

const HOTSPOTS: Record<CursorShape, Hotspot> = {
  default: BASE_HOTSPOT,
  hand: BASE_HOTSPOT,
  text: [63 / 128, 64 / 128],
  crosshair: [64 / 128, 64 / 128],
  "context-menu": [0.125, 0.125],
  help: [0.125, 0.125],
  progress: [0.125, 0.125],
  wait: [0.5, 0.46875],
  cell: [0.484375, 0.484375],
  "vertical-text": [0.515625, 0.484375],
  alias: [0.125, 0.125],
  copy: [0.125, 0.125],
  move: [0.5, 0.5],
  "no-drop": [0.484375, 0.484375],
  "not-allowed": [0.5, 0.46875],
  grab: [0.5, 0.5],
  grabbing: [0.5, 0.5],
  "e-resize": [0.859375, 0.484375],
  "n-resize": [0.515625, 0.140625],
  "ne-resize": [0.828125, 0.140625],
  "nw-resize": [0.171875, 0.140625],
  "s-resize": [0.515625, 0.859375],
  "se-resize": [0.8390625, 0.8390625],
  "sw-resize": [0.1609375, 0.8390625],
  "w-resize": [0.140625, 0.484375],
  "ew-resize": [0.515625, 0.484375],
  "ns-resize": [0.515625, 0.484375],
  "nesw-resize": [0.515635522228125, 0.4843681443000001],
  "nwse-resize": [0.515625, 0.484375],
  "col-resize": [0.515625, 0.484375],
  "row-resize": [0.515625, 0.484375],
  "all-scroll": [0.484375, 0.484375],
  "zoom-in": [0.484375, 0.484375],
  "zoom-out": [0.484375, 0.484375],
};

export interface CursorSprite {
  image: OffscreenCanvas;
  hotspot: Hotspot;
  aspect: number;
}

export type CursorSprites = Record<CursorShape, CursorSprite>;

export function cursorAssetUrl(shape: CursorShape): string {
  return `/cursors/${shape}.svg`;
}

async function loadSprite(shape: CursorShape): Promise<CursorSprite> {
  const image = new Image();
  image.src = cursorAssetUrl(shape);
  await image.decode();
  const aspect = image.naturalHeight / image.naturalWidth;
  const canvas = new OffscreenCanvas(RASTER_WIDTH, Math.round(RASTER_WIDTH * aspect));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { image: canvas, hotspot: HOTSPOTS[shape], aspect };
}

let spritesPromise: Promise<CursorSprites> | null = null;

export function loadCursorSprites(): Promise<CursorSprites> {
  spritesPromise ??= Promise.all(CURSOR_SHAPES.map(async (shape) => [shape, await loadSprite(shape)] as const))
    .then((entries) => Object.fromEntries(entries) as CursorSprites);
  return spritesPromise;
}
