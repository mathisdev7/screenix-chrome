import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { PointerSample } from "@/shared/types";
import { clickSampleAt, clickTimes, decodeClickSample } from "./clickSounds";

const sample = (t: number, kind: PointerSample["kind"]): PointerSample => ({ t, kind, x: 0.5, y: 0.5, button: 0, tabId: 1, shape: "default" });

describe("click sounds", () => {
  test("play on every button press, in time order", () => {
    expect(clickTimes([sample(2, "down"), sample(0.5, "move"), sample(1, "down"), sample(1.1, "up")])).toEqual([1, 2]);
  });

  test("rotate through the sample bank", () => {
    expect([0, 1, 2, 3].map((index) => clickSampleAt(["a", "b", "c"], index))).toEqual(["a", "b", "c", "a"]);
  });

  test("decode the bundled samples to short, audible transients", () => {
    const file = readFileSync(new URL("../../public/sounds/click-0.wav", import.meta.url));
    const decoded = decodeClickSample(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const peak = decoded.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    expect(decoded.length).toBe(3120);
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThan(0.5);
  });
});
