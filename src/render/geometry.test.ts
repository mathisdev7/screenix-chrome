import { describe, expect, test } from "bun:test";
import { DEFAULT_BACKGROUND_SETTINGS } from "@/shared/settings";
import { aspectValue, encoderSizeForShortSide, frameRectFor, videoRectFor } from "./geometry";

const source = { width: 2688, height: 1400 };

describe("geometry", () => {
  test("source aspect follows the recording", () => {
    expect(aspectValue("source", source)).toBeCloseTo(2688 / 1400);
    expect(aspectValue("9:16", source)).toBeCloseTo(9 / 16);
  });

  test("export sizes fit the encoder block grid and keep standard heights", () => {
    expect(encoderSizeForShortSide(16 / 9, 1080)).toEqual({ width: 1920, height: 1080 });
    expect(encoderSizeForShortSide(2200 / 1080, 1080)).toEqual({ width: 2208, height: 1080 });
    const portrait = encoderSizeForShortSide(9 / 16, 1080);
    expect(portrait.width % 16).toBe(0);
    expect(portrait.height % 8).toBe(0);
  });

  test("screen scale pads the video inside a background", () => {
    const output = { width: 1920, height: 1000 };
    const video = videoRectFor(output, source, DEFAULT_BACKGROUND_SETTINGS);
    expect(video.width).toBeCloseTo(1920 * 0.85);
    expect(video.x).toBeCloseTo((1920 - video.width) / 2);
  });

  test("without a background the recording covers the frame", () => {
    const output = { width: 1080, height: 1920 };
    const settings = { ...DEFAULT_BACKGROUND_SETTINGS, enabled: false };
    const video = videoRectFor(output, source, settings);
    const frame = frameRectFor(video, source, settings);
    expect(video).toEqual({ x: 0, y: 0, ...output });
    expect(frame.height).toBeCloseTo(1920);
    expect(frame.width).toBeGreaterThan(1080);
  });

  test("frames slightly taller than the recording fill the video and crop the bottom", () => {
    const video = { x: 100, y: 50, width: 1600, height: 833 };
    const taller = frameRectFor(video, { width: 2192, height: 1180 }, DEFAULT_BACKGROUND_SETTINGS);
    expect(taller.width).toBeCloseTo(1600);
    expect(taller.y).toBe(50);
    expect(taller.height).toBeGreaterThan(833);
  });

  test("very different frames are letterboxed instead of cropped", () => {
    const video = { x: 0, y: 0, width: 1600, height: 900 };
    const portrait = frameRectFor(video, { width: 900, height: 1600 }, DEFAULT_BACKGROUND_SETTINGS);
    expect(portrait.height).toBeCloseTo(900);
    expect(portrait.width).toBeLessThan(1600);
  });
});
