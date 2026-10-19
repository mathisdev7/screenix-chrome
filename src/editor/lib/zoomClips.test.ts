import { describe, expect, test } from "bun:test";
import type { PointerSample } from "@/shared/types";
import { addZoomClip, autoZoomClips, updateZoomClip } from "./zoomClips";

function click(t: number): PointerSample {
  return { t, x: 0.5, y: 0.5, kind: "down", button: 0, shape: "default", tabId: 1 };
}

describe("zoom clips", () => {
  test("new zooms default to Auto", () => {
    const [clip] = addZoomClip([], 1, { start: 0, end: 10 }, "a")!;
    expect(clip).toMatchObject({ id: "a", start: 1, end: 2.5, mode: "auto", scale: 1.5 });
    expect(addZoomClip([clip], 2, { start: 0, end: 10 }, "b")).toBeNull();
  });

  test("auto zoom adds an Auto zoom per click and merges nearby clicks", () => {
    let id = 0;
    const clips = autoZoomClips([click(2), click(4), click(12), { ...click(13), kind: "up" }, click(19.5)], 20, () => `z${id++}`);
    expect(clips.map(({ start, end, mode }) => ({ start, end, mode }))).toEqual([
      { start: 1.7, end: 6.5, mode: "auto" },
      { start: 11.7, end: 14.5, mode: "auto" },
    ]);
  });

  test("keeps the scale, transitions and manual area in range", () => {
    const [clip] = addZoomClip([], 0, { start: 0, end: 10 }, "a")!;
    const [updated] = updateZoomClip([clip], "a", { scale: 9, zoomIn: 0, centerX: 0, centerY: 1 });
    expect(updated).toMatchObject({ scale: 4, zoomIn: 0.1, centerX: 0.125, centerY: 0.875 });
  });
});
