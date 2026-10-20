import { FULL_CROP, type CropRect } from "@/shared/settings";

export type CropHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const MIN_CROP_SIZE = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function dragCrop(start: CropRect, handle: CropHandle, dx: number, dy: number): CropRect {
  if (handle === "move") {
    return { ...start, x: clamp(start.x + dx, 0, 1 - start.width), y: clamp(start.y + dy, 0, 1 - start.height) };
  }
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle.includes("w")) left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
  if (handle.includes("e")) right = clamp(right + dx, left + MIN_CROP_SIZE, 1);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function isFullCrop(crop: CropRect): boolean {
  return crop.x === FULL_CROP.x && crop.y === FULL_CROP.y && crop.width === FULL_CROP.width && crop.height === FULL_CROP.height;
}
