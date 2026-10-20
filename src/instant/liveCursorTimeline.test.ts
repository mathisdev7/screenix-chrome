import { describe, expect, test } from "bun:test";
import { buildCursorTimeline, sampleTimeline } from "@/render/cursor/timeline";
import type { PointerSample } from "@/shared/types";
import { LiveCursorTimeline, POINTER_LOOKAHEAD } from "./liveCursorTimeline";

function sample(t: number, x: number, y: number, overrides: Partial<PointerSample> = {}): PointerSample {
  return { t, x, y, kind: "move", button: 0, shape: "default", tabId: 1, ...overrides };
}

function sweep(from: number, to: number, start: number, duration: number): PointerSample[] {
  const steps = Math.round(duration * 120);
  return Array.from({ length: steps + 1 }, (_, i) => sample(start + (duration * i) / steps, from + ((to - from) * i) / steps, 0.5));
}

function streamed(samples: readonly PointerSample[], duration: number, batchSeconds = 0.1): LiveCursorTimeline {
  const live = new LiveCursorTimeline(0.5);
  const steps = Math.ceil(duration / batchSeconds);
  for (let step = 0; step < steps; step++) {
    live.add(samples.filter((s) => s.t >= step * batchSeconds && s.t < (step + 1) * batchSeconds));
    live.advance((step + 1) * batchSeconds);
  }
  live.add(samples.filter((s) => s.t >= steps * batchSeconds));
  live.finish(duration);
  return live;
}

describe("LiveCursorTimeline", () => {
  test("matches the editor timeline for continuous motion", () => {
    const samples = [...sweep(0.1, 0.9, 0, 0.6), ...sweep(0.9, 0.3, 0.6, 0.4)];
    const batch = buildCursorTimeline(samples, 0.5).segments[0].spring;
    const live = streamed(samples, 2).timeline.segments[0].spring;
    for (let t = 0; t <= 1; t += 1 / 60) {
      expect(sampleTimeline(t, live).x).toBeCloseTo(sampleTimeline(t, batch).x, 6);
    }
  });

  test("gives the same result however the samples are batched", () => {
    const samples = [...sweep(0.2, 0.8, 0.2, 0.5), sample(0.8, 0.8, 0.5, { kind: "down" }), sample(0.9, 0.8, 0.5, { kind: "up" }), ...sweep(0.8, 0.1, 1.5, 0.5)];
    const a = streamed(samples, 3, 0.05).timeline;
    const b = streamed(samples, 3, 0.4).timeline;
    expect(a.clicks).toEqual(b.clicks);
    for (let t = 0.2; t <= 3; t += 0.05) {
      expect(sampleTimeline(t, a.segments[0].spring)).toEqual(sampleTimeline(t, b.segments[0].spring));
    }
  });

  test("holds the cursor still while the pointer rests", () => {
    const samples = [...sweep(0.2, 0.4, 0, 0.3), ...sweep(0.4, 0.6, 3, 0.3)];
    const spring = streamed(samples, 4).timeline.segments[0].spring;
    expect(sampleTimeline(1, spring).x).toBeCloseTo(0.4, 4);
    expect(sampleTimeline(2.5, spring).x).toBeCloseTo(0.4, 4);
    expect(sampleTimeline(3.29, spring).x).toBeGreaterThan(0.45);
  });

  test("ends a segment like the editor when the pointer leaves for a while", () => {
    const samples = [
      ...sweep(0.2, 0.4, 0, 0.3),
      sample(0.4, 0.4, -0.01, { kind: "leave" }),
      ...sweep(0.6, 0.8, 2, 0.3),
    ];
    const batch = buildCursorTimeline(samples, 0.5).segments;
    const live = streamed(samples, 3).timeline.segments;
    expect(live.map(({ start, end, fadeOut }) => ({ start, end, fadeOut }))).toEqual(batch.map(({ start, end, fadeOut }) => ({ start, end, fadeOut })));
  });

  test("closes a left segment once enough time has passed without a return", () => {
    const live = new LiveCursorTimeline(0.5);
    live.add([...sweep(0.2, 0.4, 0, 0.3), sample(0.4, 0.4, -0.01, { kind: "leave" })]);
    live.advance(0.4 + POINTER_LOOKAHEAD);
    expect(live.timeline.segments[0].end).toBeCloseTo(0.95, 6);
  });

  test("starts a new segment on another tab", () => {
    const live = new LiveCursorTimeline(0.5);
    live.add([...sweep(0.2, 0.4, 0, 0.3), ...sweep(0.5, 0.6, 0.5, 0.2).map((s) => ({ ...s, tabId: 2 }))]);
    live.finish(1);
    expect(live.timeline.segments).toHaveLength(2);
    expect(live.timeline.segments[0].end).toBeCloseTo(0.5, 6);
  });
});
