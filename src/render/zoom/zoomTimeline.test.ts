import { describe, expect, test } from "bun:test";
import type { ZoomClip } from "@/shared/settings";
import { ZoomTimeline } from "./zoomTimeline";

function clip(patch: Partial<ZoomClip>): ZoomClip {
  return { id: "a", start: 1, end: 4, scale: 2, mode: "auto", centerX: 0.5, centerY: 0.5, zoomIn: 1, zoomOut: 0.5, ...patch };
}

const still = [{ t: 0, x: 0.8, y: 0.2 }, { t: 10, x: 0.8, y: 0.2 }];

describe("zoom timeline", () => {
  test("is the identity without clips and outside them", () => {
    expect(ZoomTimeline.empty.at(2)).toEqual({ scale: 1, centerX: 0.5, centerY: 0.5 });
    const timeline = ZoomTimeline.build([clip({})], still, 10);
    expect(timeline.at(0.5).scale).toBe(1);
    expect(timeline.at(6).scale).toBe(1);
  });

  test("eases in, holds the full scale and zooms out after the clip", () => {
    const timeline = ZoomTimeline.build([clip({})], still, 10);
    expect(timeline.at(1.3).scale).toBeGreaterThan(1);
    expect(timeline.at(1.3).scale).toBeLessThan(2);
    expect(timeline.at(3).scale).toBeCloseTo(2, 3);
    expect(timeline.at(4.25).scale).toBeGreaterThan(1);
    expect(timeline.at(4.25).scale).toBeLessThan(2);
  });

  test("auto zoom centres on the cursor, kept inside the frame", () => {
    const view = ZoomTimeline.build([clip({})], still, 10).at(3);
    expect(view.centerX).toBeGreaterThan(0.6);
    expect(view.centerX).toBeLessThanOrEqual(0.75);
    expect(view.centerY).toBeGreaterThanOrEqual(0.25);
    expect(view.centerY).toBeLessThan(0.4);
  });

  test("auto zoom pans once the cursor leaves the area in view", () => {
    const moving = [{ t: 0, x: 0.35, y: 0.5 }, { t: 2.5, x: 0.35, y: 0.5 }, { t: 2.6, x: 0.65, y: 0.5 }, { t: 10, x: 0.65, y: 0.5 }];
    const timeline = ZoomTimeline.build([clip({ end: 6, scale: 3 })], moving, 10);
    expect(timeline.at(2.4).centerX).toBeCloseTo(0.35, 2);
    expect(timeline.at(5).centerX).toBeCloseTo(0.65, 2);
  });

  test("manual zoom holds the chosen area and connects to the next manual zoom", () => {
    const clips = [
      clip({ mode: "manual", centerX: 0.25, centerY: 0.25 }),
      clip({ id: "b", mode: "manual", start: 5, end: 8, centerX: 0.75, centerY: 0.75 }),
    ];
    const timeline = ZoomTimeline.build(clips, still, 10);
    expect(timeline.at(3)).toMatchObject({ scale: 2, centerX: 0.25, centerY: 0.25 });
    expect(timeline.at(4.5).scale).toBeCloseTo(2, 5);
    expect(timeline.at(4.5).centerX).toBeGreaterThan(0.25);
    expect(timeline.at(4.5).centerX).toBeLessThan(0.75);
    expect(timeline.at(4.95).centerX).toBeCloseTo(0.75, 2);
    expect(timeline.at(7)).toMatchObject({ scale: 2, centerX: 0.75, centerY: 0.75 });
  });
});
