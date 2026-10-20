import { describe, expect, test } from "bun:test";
import { FULL_CROP } from "@/shared/settings";
import { dragCrop, isFullCrop, MIN_CROP_SIZE } from "./cropRect";

describe("dragCrop", () => {
  test("moves the crop and keeps it inside the recording", () => {
    const crop = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
    const moved = dragCrop(crop, "move", 0.2, -0.05);
    expect(moved.x).toBeCloseTo(0.3);
    expect(moved.y).toBeCloseTo(0.05);
    expect(moved.width).toBe(0.5);
    expect(dragCrop(crop, "move", 1, 1)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });

  test("resizes from a corner without moving the opposite edges", () => {
    expect(dragCrop(FULL_CROP, "nw", 0.25, 0.1)).toEqual({ x: 0.25, y: 0.1, width: 0.75, height: 0.9 });
    expect(dragCrop(FULL_CROP, "e", -0.4, 0.3)).toEqual({ x: 0, y: 0, width: 0.6, height: 1 });
  });

  test("never shrinks below the minimum size or past the recording", () => {
    const crop = dragCrop(FULL_CROP, "se", -2, -2);
    expect(crop.width).toBeCloseTo(MIN_CROP_SIZE);
    expect(crop.height).toBeCloseTo(MIN_CROP_SIZE);
    expect(dragCrop(FULL_CROP, "w", -0.5, 0)).toEqual(FULL_CROP);
  });
});

test("isFullCrop", () => {
  expect(isFullCrop(FULL_CROP)).toBe(true);
  expect(isFullCrop({ ...FULL_CROP, width: 0.9 })).toBe(false);
});
