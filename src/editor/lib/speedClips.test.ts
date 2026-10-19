import { describe, expect, test } from "bun:test";
import { addSpeedClip, moveSpeedClip, removeSpeedClip, resizeSpeedClip, setSpeedRate } from "./speedClips";

const bounds = { start: 0, end: 10 };

describe("speed clips", () => {
  test("adds a 2 second 2x clip at the playhead, shortened by the next clip", () => {
    const first = addSpeedClip([], 1, bounds, "a");
    expect(first).toEqual([{ id: "a", start: 1, end: 3, rate: 2 }]);
    const second = addSpeedClip(first!, 0, bounds, "b");
    expect(second?.[0]).toEqual({ id: "b", start: 0, end: 1, rate: 2 });
    expect(addSpeedClip(first!, 2, bounds, "c")).toBeNull();
    expect(addSpeedClip([], 9.95, bounds, "d")).toBeNull();
  });

  test("moves a clip without overlapping its neighbours or leaving the trim", () => {
    const clips = [{ id: "a", start: 1, end: 3, rate: 2 }, { id: "b", start: 5, end: 6, rate: 2 }];
    expect(moveSpeedClip(clips, "a", 4, bounds)[0]).toEqual({ id: "a", start: 3, end: 5, rate: 2 });
    expect(moveSpeedClip(clips, "a", -3, bounds)[0]).toEqual({ id: "a", start: 0, end: 2, rate: 2 });
    expect(moveSpeedClip(clips, "b", 20, bounds)[1]).toEqual({ id: "b", start: 9, end: 10, rate: 2 });
  });

  test("resizes edges up to the neighbours with a minimum length", () => {
    const clips = [{ id: "a", start: 1, end: 3, rate: 2 }, { id: "b", start: 5, end: 6, rate: 2 }];
    expect(resizeSpeedClip(clips, "a", "end", 8, bounds)[0].end).toBe(5);
    expect(resizeSpeedClip(clips, "a", "start", 2.99, bounds)[0].start).toBeCloseTo(2.9);
    expect(resizeSpeedClip(clips, "b", "start", 0, bounds)[1].start).toBe(3);
  });

  test("clamps the rate and removes clips", () => {
    const clips = [{ id: "a", start: 1, end: 3, rate: 2 }];
    expect(setSpeedRate(clips, "a", 10)[0].rate).toBe(10);
    expect(setSpeedRate(clips, "a", 50)[0].rate).toBe(16);
    expect(setSpeedRate(clips, "a", 0.1)[0].rate).toBe(0.25);
    expect(removeSpeedClip(clips, "a")).toEqual([]);
  });
});
