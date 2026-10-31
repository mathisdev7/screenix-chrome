import { describe, expect, test } from "bun:test";
import type { PointerSample } from "@/shared/types";
import { DEFAULT_CURSOR_SETTINGS } from "@/shared/settings";
import { cursorStateAt } from "./cursorState";
import { buildCursorTimeline, sampleTimeline, segmentAt } from "./timeline";

function sample(t: number, x: number, y: number, overrides: Partial<PointerSample> = {}): PointerSample {
  return { t, x, y, kind: "move", button: 0, shape: "default", tabId: 1, ...overrides };
}

function upwardSweep(from: number, start: number, duration: number): PointerSample[] {
  const steps = 60;
  return Array.from({ length: steps + 1 }, (_, i) => sample(start + (duration * i) / steps, 0.5, from - (from * i) / steps));
}

function horizontalSweep(from: number, to: number, start = 0, duration = 0.5): PointerSample[] {
  const steps = 60;
  return Array.from({ length: steps + 1 }, (_, i) => sample(start + (duration * i) / steps, from + ((to - from) * i) / steps, 0.5));
}

describe("buildCursorTimeline", () => {
  test("spring lags behind fast motion and settles on the final position", () => {
    const timeline = buildCursorTimeline(horizontalSweep(0.1, 0.9), 0.5);
    const [segment] = timeline.segments;
    const midway = sampleTimeline(0.25, segment.spring);
    expect(midway.x).toBeLessThan(0.5);
    expect(midway.x).toBeGreaterThan(0.1);
    const settled = sampleTimeline(segment.spring.at(-1)!.t, segment.spring);
    expect(settled.x).toBeCloseTo(0.9, 3);
  });

  test("a faster speed tracks the pointer more closely", () => {
    const slow = buildCursorTimeline(horizontalSweep(0.1, 0.9), 0).segments[0].spring;
    const fast = buildCursorTimeline(horizontalSweep(0.1, 0.9), 1).segments[0].spring;
    expect(sampleTimeline(0.25, fast).x).toBeGreaterThan(sampleTimeline(0.25, slow).x);
  });

  test("leaving the page for a while fades the cursor out as it leaves", () => {
    const samples = [
      ...upwardSweep(0.6, 0, 0.3),
      sample(0.31, 0.5, -0.01, { kind: "leave" }),
      ...horizontalSweep(0.6, 0.8, 2, 0.3),
    ];
    const timeline = buildCursorTimeline(samples, 0.5);
    expect(timeline.segments).toHaveLength(2);
    expect(timeline.segments[0].end).toBeCloseTo(0.51, 6);
    expect(segmentAt(timeline, 0.6)).toBeNull();
    expect(segmentAt(timeline, 2.1)?.start).toBe(2);
  });

  test("the cursor keeps moving out of the page instead of stopping at the edge", () => {
    const samples = [...upwardSweep(0.6, 0, 0.3), sample(0.31, 0.5, -0.01, { kind: "leave" })];
    const [segment] = buildCursorTimeline(samples, 0.5).segments;
    const atLeave = sampleTimeline(0.31, segment.spring).y;
    const fading = sampleTimeline(0.41, segment.spring).y;
    const gone = sampleTimeline(0.5, segment.spring).y;
    expect(fading).toBeLessThan(atLeave - 0.03);
    expect(gone).toBeLessThan(fading - 0.02);
    expect(gone).toBeLessThan(0);
  });

  test("a quick return drops the exit motion", () => {
    const samples = [
      ...upwardSweep(0.6, 0, 0.3),
      sample(0.31, 0.5, -0.01, { kind: "leave" }),
      sample(0.4, 0.5, 0.05),
      sample(0.45, 0.5, 0.1),
    ];
    const timeline = buildCursorTimeline(samples, 0.5);
    expect(timeline.segments).toHaveLength(1);
    const { spring } = timeline.segments[0];
    expect(sampleTimeline(spring.at(-1)!.t, spring).y).toBeCloseTo(0.1, 3);
    expect(Math.min(...spring.map((point) => point.y))).toBeGreaterThan(-0.05);
  });

  test("leaving from inside the page, as into an iframe, holds where the pointer left", () => {
    const samples = [...horizontalSweep(0.2, 0.4, 0, 0.3), sample(0.31, 0.4, 0.5, { kind: "leave" })];
    const [segment] = buildCursorTimeline(samples, 0.5).segments;
    expect(segment.end).toBeCloseTo(0.51, 6);
    expect(sampleTimeline(segment.spring.at(-1)!.t, segment.spring).x).toBeCloseTo(0.4, 2);
  });

  test("a quick exit and return keeps the cursor continuous", () => {
    const samples = [
      ...horizontalSweep(0.2, 0.4, 0, 0.3),
      sample(0.4, 0.4, 0, { kind: "leave" }),
      ...horizontalSweep(0.5, 0.8, 0.8, 0.3),
    ];
    const timeline = buildCursorTimeline(samples, 0.5);
    expect(timeline.segments).toHaveLength(1);
    expect(segmentAt(timeline, 0.6)).not.toBeNull();
  });

  test("switching tabs starts a new segment", () => {
    const samples = [sample(0, 0.2, 0.2), sample(0.1, 0.3, 0.2), sample(0.5, 0.5, 0.5, { tabId: 2 }), sample(0.6, 0.6, 0.5, { tabId: 2 })];
    expect(buildCursorTimeline(samples, 0.5).segments).toHaveLength(2);
  });

  test("collects clicks and shape changes", () => {
    const samples = [
      sample(0, 0.5, 0.5),
      sample(0.1, 0.5, 0.5, { kind: "down", shape: "hand" }),
      sample(0.2, 0.5, 0.5, { kind: "up", shape: "hand" }),
      sample(0.3, 0.6, 0.5, { shape: "text" }),
    ];
    const timeline = buildCursorTimeline(samples, 0.5);
    expect(timeline.clicks.map((click) => click.kind)).toEqual(["down", "up"]);
    expect(timeline.shapeChanges).toEqual([0.1, 0.3]);
  });
});

describe("cursorStateAt", () => {
  test("shrinks the cursor right after a click", () => {
    const samples = [sample(0, 0.5, 0.5), sample(1, 0.5, 0.5, { kind: "down" }), sample(1.05, 0.5, 0.5, { kind: "up" }), sample(2, 0.5, 0.5)];
    const timeline = buildCursorTimeline(samples, 0.5);
    const atClick = cursorStateAt(timeline, 1.15, DEFAULT_CURSOR_SETTINGS);
    const later = cursorStateAt(timeline, 1.9, DEFAULT_CURSOR_SETTINGS);
    expect(atClick?.scale).toBeLessThan(1);
    expect(later?.scale).toBe(1);
  });

  test("fades out when idle if enabled", () => {
    const samples = [...horizontalSweep(0.2, 0.4, 0, 0.3), sample(5, 0.4, 0.5)];
    const timeline = buildCursorTimeline(samples, 0.5);
    const settings = { ...DEFAULT_CURSOR_SETTINGS, hideWhenIdle: true, idleTimeout: 0.5 };
    expect(cursorStateAt(timeline, 0.35, settings)?.opacity).toBe(1);
    expect(cursorStateAt(timeline, 3, settings)).toBeNull();
  });

  test("returns nothing before the pointer first enters the page", () => {
    const timeline = buildCursorTimeline(horizontalSweep(0.2, 0.4, 1), 0.5);
    expect(cursorStateAt(timeline, 0.5, DEFAULT_CURSOR_SETTINGS)).toBeNull();
  });
});
