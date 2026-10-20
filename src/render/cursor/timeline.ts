import type { CursorShape } from "@/shared/cursorShapes";
import type { PointerSample } from "@/shared/types";
import { CLICK_SPRING_CONFIG, DRAG_SPRING_CONFIG, SpringCursor, scaledDefaultSpringConfig, type SpringConfig } from "./spring";

export const SPRING_FPS = 120;
const CLICK_WINDOW = 0.175;
const MAX_INTERP_GAP = 0.5;
const SETTLE_TAIL = 2;
const PRIMARY_BUTTON = 0;
export const LEAVE_MERGE_GAP = 1;
export const LEAVE_HOLD = 0.35;
export const LEAVE_FADE = 0.2;

export interface TimelinePoint {
  t: number;
  x: number;
  y: number;
}

export interface RawPoint extends TimelinePoint {
  shape: CursorShape;
}

export interface ClickEvent extends TimelinePoint {
  kind: "down" | "up";
  button: number;
}

export interface VisibleSegment {
  start: number;
  end: number;
  fadeOut: number;
  spring: TimelinePoint[];
}

export interface CursorTimeline {
  raw: RawPoint[];
  segments: VisibleSegment[];
  clicks: ClickEvent[];
  shapeChanges: number[];
}

function lastIndexAtOrBefore<T extends { t: number }>(items: readonly T[], time: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (items[mid].t <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function sampleTimeline(time: number, timeline: readonly TimelinePoint[]): { x: number; y: number } {
  if (timeline.length === 0) return { x: 0.5, y: 0.5 };
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  if (time <= first.t) return { x: first.x, y: first.y };
  if (time >= last.t) return { x: last.x, y: last.y };

  const index = lastIndexAtOrBefore(timeline, time);
  const a = timeline[index];
  const b = timeline[Math.min(index + 1, timeline.length - 1)];
  if (a === b || b.t <= a.t) return { x: a.x, y: a.y };

  const gapBefore = time - a.t;
  const gapAfter = b.t - time;
  if (gapBefore > MAX_INTERP_GAP && gapAfter > MAX_INTERP_GAP) {
    return gapBefore <= gapAfter ? { x: a.x, y: a.y } : { x: b.x, y: b.y };
  }
  const f = (time - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function sampleShape(time: number, raw: readonly RawPoint[]): CursorShape {
  const index = lastIndexAtOrBefore(raw, time);
  return index >= 0 ? raw[index].shape : raw[0]?.shape ?? "default";
}

export function timelineVelocity(time: number, timeline: readonly TimelinePoint[], windowSec = 0.25): number {
  const a = sampleTimeline(time - windowSec, timeline);
  const b = sampleTimeline(time, timeline);
  return Math.hypot(b.x - a.x, b.y - a.y) / windowSec;
}

export function timelineDirection(time: number, timeline: readonly TimelinePoint[], windowSec = 0.1) {
  const a = sampleTimeline(time - windowSec, timeline);
  const b = sampleTimeline(time, timeline);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { dx, dy, speed: Math.hypot(dx, dy) / windowSec };
}

export function isDraggingAt(time: number, clicks: readonly ClickEvent[]): boolean {
  let down = false;
  for (const click of clicks) {
    if (click.t > time) break;
    if (click.button === PRIMARY_BUTTON) down = click.kind === "down";
  }
  return down;
}

function isNearClick(time: number, clicks: readonly ClickEvent[], startIndex: number): boolean {
  for (let i = startIndex; i < clicks.length && clicks[i].t <= time + CLICK_WINDOW; i++) {
    if (clicks[i].kind === "down" && Math.abs(time - clicks[i].t) <= CLICK_WINDOW) return true;
  }
  return false;
}

export function nextClickIndex(clicks: readonly ClickEvent[], clickIndex: number, time: number): number {
  let index = clickIndex;
  while (index < clicks.length - 1 && clicks[index].t < time - CLICK_WINDOW) index++;
  return index;
}

export function springConfigAt(time: number, clicks: readonly ClickEvent[], clickIndex: number, speed: number): SpringConfig {
  if (isDraggingAt(time, clicks)) return DRAG_SPRING_CONFIG;
  if (isNearClick(time, clicks, clickIndex)) return CLICK_SPRING_CONFIG;
  return scaledDefaultSpringConfig(speed);
}

function springTimeline(samples: readonly TimelinePoint[], clicks: readonly ClickEvent[], endT: number, speed: number): TimelinePoint[] {
  if (samples.length < 2) return [...samples];

  const spring = new SpringCursor();
  spring.setPosition(samples[0].x, samples[0].y);
  spring.setTarget(samples[0].x, samples[0].y);

  const frameDt = 1000 / SPRING_FPS;
  const startT = samples[0].t;
  const lastSampleT = samples[samples.length - 1].t;
  const totalFrames = Math.ceil((endT - startT) * SPRING_FPS);
  const out: TimelinePoint[] = [];
  let sampleIndex = 0;
  let clickIndex = 0;

  for (let frame = 0; frame <= totalFrames; frame++) {
    const t = startT + frame / SPRING_FPS;
    while (sampleIndex < samples.length - 1 && samples[sampleIndex + 1].t <= t) sampleIndex++;

    const a = samples[sampleIndex];
    const b = samples[Math.min(sampleIndex + 1, samples.length - 1)];
    const f = a === b || b.t <= a.t ? 0 : Math.min(1, (t - a.t) / (b.t - a.t));
    const targetX = a.x + (b.x - a.x) * f;
    const targetY = a.y + (b.y - a.y) * f;

    clickIndex = nextClickIndex(clicks, clickIndex, t);
    spring.updateConfig(springConfigAt(t, clicks, clickIndex, speed));
    spring.setTarget(targetX, targetY);
    const position = spring.step(frameDt);
    out.push({ t, x: position.x, y: position.y });
    if (t > lastSampleT && spring.isAtRest) break;
  }
  return out;
}

interface SegmentDraft {
  samples: PointerSample[];
  end: number;
  fadeOut: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function edgeSample(leave: PointerSample): PointerSample {
  return { ...leave, kind: "move", x: clamp01(leave.x), y: clamp01(leave.y) };
}

function splitIntoSegments(samples: readonly PointerSample[]): SegmentDraft[] {
  const segments: SegmentDraft[] = [];
  let current: PointerSample[] = [];
  let leftAt: number | null = null;

  const close = (end: number, fadeOut: number) => {
    if (current.length > 0) segments.push({ samples: current, end, fadeOut });
    current = [];
    leftAt = null;
  };

  for (const sample of samples) {
    if (sample.kind === "leave") {
      if (current.length > 0) {
        current.push(edgeSample(sample));
        leftAt = sample.t;
      }
      continue;
    }
    const previous = current[current.length - 1];
    if (previous && previous.tabId !== sample.tabId) close(sample.t, 0);
    else if (leftAt !== null && sample.t - leftAt > LEAVE_MERGE_GAP) close(Math.min(leftAt + LEAVE_HOLD + LEAVE_FADE, sample.t), LEAVE_FADE);
    leftAt = null;
    current.push(sample);
  }
  close(leftAt === null ? Infinity : leftAt + LEAVE_HOLD + LEAVE_FADE, LEAVE_FADE);
  return segments;
}

function collectShapeChanges(raw: readonly RawPoint[]): number[] {
  const changes: number[] = [];
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].shape !== raw[i - 1].shape) changes.push(raw[i].t);
  }
  return changes;
}

export function buildCursorTimeline(samples: readonly PointerSample[], speed: number): CursorTimeline {
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const positional = sorted.filter((sample) => sample.kind !== "leave");
  const raw: RawPoint[] = positional.map(({ t, x, y, shape }) => ({ t, x, y, shape }));
  const clicks: ClickEvent[] = positional
    .filter((sample): sample is PointerSample & { kind: "down" | "up" } => sample.kind === "down" || sample.kind === "up")
    .map(({ t, x, y, kind, button }) => ({ t, x, y, kind, button }));

  const segments = splitIntoSegments(sorted).map(({ samples: segment, end, fadeOut }): VisibleSegment => ({
    start: segment[0].t,
    end,
    fadeOut,
    spring: springTimeline(segment, clicks, Math.min(end, segment[segment.length - 1].t + SETTLE_TAIL), speed),
  }));

  return { raw, segments, clicks, shapeChanges: collectShapeChanges(raw) };
}

export function segmentAt(timeline: CursorTimeline, time: number): VisibleSegment | null {
  for (const segment of timeline.segments) {
    if (time >= segment.start && time < segment.end) return segment;
  }
  return null;
}
