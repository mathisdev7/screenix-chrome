import { describe, expect, test } from "bun:test";
import { TimeMap } from "./timeMap";

const clip = (start: number, end: number, rate: number) => ({ id: `${start}`, start, end, rate });

describe("TimeMap", () => {
  test("without speed clips output time equals trimmed source time", () => {
    const map = new TimeMap(2, 10, []);
    expect(map.outputDuration).toBeCloseTo(8);
    expect(map.sourceAt(3)).toBeCloseTo(5);
    expect(map.outputAt(5)).toBeCloseTo(3);
  });

  test("a 2x clip halves its share of the output", () => {
    const map = new TimeMap(0, 10, [clip(2, 6, 2)]);
    expect(map.outputDuration).toBeCloseTo(8);
    expect(map.sourceAt(2)).toBeCloseTo(2);
    expect(map.sourceAt(3)).toBeCloseTo(4);
    expect(map.sourceAt(4)).toBeCloseTo(6);
    expect(map.sourceAt(5)).toBeCloseTo(7);
    expect(map.outputAt(6)).toBeCloseTo(4);
    expect(map.rateAt(3)).toBe(2);
    expect(map.rateAt(7)).toBe(1);
  });

  test("clips are clamped to the trim range and overlapping clips are ignored", () => {
    const map = new TimeMap(1, 9, [clip(0, 3, 4), clip(2, 5, 2), clip(7, 12, 0.5)]);
    expect(map.segments.map((segment) => [segment.sourceStart, segment.sourceEnd, segment.rate])).toEqual([
      [1, 3, 4],
      [3, 7, 1],
      [7, 9, 0.5],
    ]);
    expect(map.outputDuration).toBeCloseTo(0.5 + 4 + 4);
  });

  test("round trips between output and source time", () => {
    const map = new TimeMap(0, 20, [clip(3, 8, 3), clip(12, 14, 0.5)]);
    for (let output = 0; output <= map.outputDuration; output += 0.37) {
      expect(map.outputAt(map.sourceAt(output))).toBeCloseTo(output, 6);
    }
  });
});
