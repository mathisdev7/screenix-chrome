import { describe, expect, test } from "bun:test";
import { Cadence } from "./cadence";

function strides(lags: number[]): number[] {
  const cadence = new Cadence();
  return lags.map((lag) => {
    cadence.update(lag);
    return cadence.stride;
  });
}

describe("Cadence", () => {
  test("renders every frame while the renderer keeps up", () => {
    expect(strides([0.2, 0.3, 0.25, 0.4, 1.2, 0.3])).toEqual([1, 1, 1, 1, 1, 1]);
  });

  test("renders every other frame while the lag keeps growing, never fewer", () => {
    expect(strides([1, 1.6, 2.2, 3, 4, 5, 6])).toEqual([1, 2, 2, 2, 2, 2, 2]);
  });

  test("holds the stride while a large lag shrinks", () => {
    expect(strides([1, 1.6, 2, 1.8, 1.6])).toEqual([1, 2, 2, 2, 2]);
  });

  test("returns to every frame once the lag has stayed small", () => {
    expect(strides([1, 1.6, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3])).toEqual([1, 2, 2, 2, 2, 2, 1, 1]);
  });

  test("skips the frames between strides", () => {
    const cadence = new Cadence();
    cadence.update(1);
    cadence.update(2);
    expect([0, 1, 2, 3, 4].map((index) => cadence.skips(index))).toEqual([false, true, false, true, false]);
  });
});
