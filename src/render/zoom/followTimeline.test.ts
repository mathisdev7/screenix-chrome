import { describe, expect, test } from "bun:test";
import type { ZoomClip } from "@/shared/settings";
import { FollowTimeline } from "./followTimeline";

const portrait = { width: 0.3, height: 1 };

describe("follow timeline", () => {
  test("starts on the cursor and keeps the area inside the recording", () => {
    const timeline = FollowTimeline.build([{ t: 0, x: 0.95, y: 0.2 }, { t: 5, x: 0.95, y: 0.2 }], portrait, 5);
    expect(timeline.at(0)).toEqual({ x: expect.closeTo(0.85, 5), y: 0.5 });
    expect(timeline.at(4).x).toBeCloseTo(0.85, 5);
  });

  test("holds still while the cursor moves inside the dead zone", () => {
    const points = [{ t: 0, x: 0.4, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }, { t: 2, x: 0.45, y: 0.5 }];
    const timeline = FollowTimeline.build(points, portrait, 3);
    expect(timeline.at(0.5).x).toBeCloseTo(0.45, 4);
    expect(timeline.at(2.5).x).toBeCloseTo(0.45, 4);
  });

  test("pans smoothly to the cursor once it leaves the dead zone", () => {
    const points = [{ t: 0, x: 0.3, y: 0.5 }, { t: 1, x: 0.3, y: 0.5 }, { t: 1.01, x: 0.7, y: 0.5 }, { t: 5, x: 0.7, y: 0.5 }];
    const timeline = FollowTimeline.build(points, portrait, 5);
    expect(timeline.at(0.9).x).toBeCloseTo(0.3, 4);
    const panning = timeline.at(1.2).x;
    expect(panning).toBeGreaterThan(0.3);
    expect(panning).toBeLessThan(0.7);
    expect(timeline.at(4).x).toBeCloseTo(0.7, 3);
  });

  test("maps the cursor and manual zoom areas into the followed area", () => {
    const timeline = FollowTimeline.build([{ t: 0, x: 0.6, y: 0.5 }, { t: 5, x: 0.6, y: 0.5 }], portrait, 5);
    expect(timeline.windowPoints([{ t: 1, x: 0.75, y: 0.25 }])).toEqual([{ t: 1, x: expect.closeTo(1, 5), y: 0.25 }]);
    const manual: ZoomClip = { id: "a", start: 1, end: 3, scale: 2, mode: "manual", centerX: 0.55, centerY: 0.4, zoomIn: 0.5, zoomOut: 0.5 };
    expect(timeline.windowClips([manual])[0]).toMatchObject({ centerX: expect.closeTo(1 / 3, 5), centerY: expect.closeTo(0.4, 5) });
  });
});
