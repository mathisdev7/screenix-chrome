import { describe, expect, test } from "bun:test";
import type { ClickEvent, TimelinePoint } from "@/render/cursor/timeline";
import { LIVE_ZOOM_SCALE, LiveZoom } from "./liveZoom";
import { POINTER_LOOKAHEAD } from "./liveCursorTimeline";

function press(t: number, x: number, y: number): ClickEvent[] {
  return [{ t, x, y, kind: "down", button: 0 }, { t: t + 0.1, x, y, kind: "up", button: 0 }];
}

function still(x: number, y: number, duration: number): TimelinePoint[] {
  return Array.from({ length: Math.round(duration * 10) + 1 }, (_, i) => ({ t: i / 10, x, y }));
}

function scales(zoom: LiveZoom, until: number): number[] {
  return Array.from({ length: Math.round(until * 60) + 1 }, (_, i) => zoom.at(i / 60).scale);
}

describe("LiveZoom", () => {
  test("stays still without clicks", () => {
    const zoom = new LiveZoom([], still(0.3, 0.3, 5));
    expect(scales(zoom, 5).every((scale) => scale === 1)).toBe(true);
  });

  test("zooms in before the click, toward it, and back out after the hold", () => {
    const zoom = new LiveZoom(press(2, 0.8, 0.7), still(0.8, 0.7, 8));
    expect(zoom.at(1.3).scale).toBe(1);
    expect(zoom.at(2).scale).toBeGreaterThan(1.4);
    const view = zoom.at(3);
    expect(view.scale).toBeCloseTo(LIVE_ZOOM_SCALE, 3);
    expect(view.centerX).toBeGreaterThan(0.6);
    expect(view.centerY).toBeGreaterThan(0.6);
    expect(zoom.at(6).scale).toBe(1);
  });

  test("zooms about a fixed point, so the clicked spot moves steadily into place", () => {
    const zoom = new LiveZoom(press(2, 0.85, 0.2), still(0.85, 0.2, 6));
    const onScreen = Array.from({ length: 61 }, (_, i) => {
      const view = zoom.at(1.3 + i / 60);
      return { x: 0.5 + view.scale * (0.85 - view.centerX), y: 0.5 + view.scale * (0.2 - view.centerY) };
    });
    for (let i = 1; i < onScreen.length; i++) {
      expect(onScreen[i].x).toBeLessThanOrEqual(onScreen[i - 1].x + 1e-9);
      expect(onScreen[i].y).toBeGreaterThanOrEqual(onScreen[i - 1].y - 1e-9);
    }
  });

  test("stays zoomed between clicks close together", () => {
    const zoom = new LiveZoom([...press(1, 0.5, 0.5), ...press(4, 0.5, 0.5)], still(0.5, 0.5, 8));
    const during = scales(zoom, 5).slice(Math.round(1.5 * 60), 4 * 60);
    expect(Math.min(...during)).toBeGreaterThan(LIVE_ZOOM_SCALE - 0.01);
  });

  test("pans to the next click when it is out of view", () => {
    const zoom = new LiveZoom([...press(1, 0.2, 0.5), ...press(2.5, 0.8, 0.5)], still(0.2, 0.5, 6));
    expect(zoom.at(1.8).centerX).toBeLessThan(0.4);
    expect(zoom.at(2.5).centerX).toBeGreaterThan(0.6);
  });

  test("gives the same result when clicks arrive within the pointer lookahead", () => {
    const clicks = [...press(1, 0.2, 0.3), ...press(3, 0.9, 0.8), ...press(4, 0.4, 0.9)];
    const points = still(0.5, 0.5, 8);
    const complete = scales(new LiveZoom(clicks, points), 8);
    const known: ClickEvent[] = [];
    const live = new LiveZoom(known, points);
    const streamed = Array.from({ length: 8 * 60 + 1 }, (_, i) => {
      known.push(...clicks.filter((click) => click.t <= i / 60 + POINTER_LOOKAHEAD && !known.includes(click)));
      return live.at(i / 60).scale;
    });
    expect(streamed).toEqual(complete);
  });

  test("zooms out before the end and ignores clicks too close to it", () => {
    const zoom = new LiveZoom([...press(1, 0.5, 0.5), ...press(4.7, 0.5, 0.5)], still(0.5, 0.5, 5));
    zoom.finish(5);
    const all = scales(zoom, 5);
    expect(all.at(-1)).toBeLessThan(1.01);
    expect(Math.max(...all.slice(Math.round(4.2 * 60)))).toBeLessThan(1.02);
  });
});
