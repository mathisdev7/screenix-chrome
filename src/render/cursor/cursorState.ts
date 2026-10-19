import type { CursorShape } from "@/shared/cursorShapes";
import type { CursorSettings } from "@/shared/settings";
import {
  sampleShape,
  sampleTimeline,
  segmentAt,
  timelineDirection,
  timelineVelocity,
  type ClickEvent,
  type CursorTimeline,
  type VisibleSegment,
} from "./timeline";

const MOTION_SAMPLE_STEP = 1 / 60;
const ENTER_FADE = 0.15;
const IDLE_FADE = 0.25;
const IDLE_LOOKAHEAD = 0.3;
const IDLE_VELOCITY_THRESHOLD = 0.002;
const SHAPE_OUT_DURATION = 0.08;
const SHAPE_IN_DURATION = 0.1;
const SHAPE_MIN_SCALE = 0.82;
const DRAG_SCALE = 0.82;
const DRAG_TRANSITION_IN = 0.12;
const DRAG_TRANSITION_OUT = 0.18;
const DRAG_MIN_HOLD = 0.15;
const PRIMARY_BUTTON = 0;

export interface CursorFrameState {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  shape: CursorShape;
  scale: number;
  rotationDeg: number;
  opacity: number;
}

const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

function segmentOpacity(segment: VisibleSegment, time: number, isFirst: boolean): number {
  const enter = isFirst ? 1 : Math.min(1, (time - segment.start) / ENTER_FADE);
  const exit = Number.isFinite(segment.end) && segment.fadeOut > 0 ? Math.min(1, (segment.end - time) / segment.fadeOut) : 1;
  return Math.max(0, Math.min(enter, exit));
}

function isMovingAt(time: number, segment: VisibleSegment): boolean {
  return timelineVelocity(time, segment.spring, 0.15) > IDLE_VELOCITY_THRESHOLD;
}

function lastMoveTime(time: number, segment: VisibleSegment): number {
  const step = 1 / 60;
  for (let probe = time; probe >= segment.start; probe -= step) {
    if (isMovingAt(probe, segment) || isMovingAt(probe + IDLE_LOOKAHEAD, segment)) return probe;
  }
  return segment.start;
}

function idleOpacity(time: number, segment: VisibleSegment, settings: CursorSettings): number {
  if (!settings.hideWhenIdle) return 1;
  const idleFor = time - lastMoveTime(time, segment);
  if (idleFor <= settings.idleTimeout) return 1;
  return 1 - Math.min(1, (idleFor - settings.idleTimeout) / IDLE_FADE);
}

function clickScale(time: number, clicks: readonly ClickEvent[], intensity: number): number {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped <= 0) return 1;
  const duration = 0.25 + clamped * 0.2;
  const peak = clamped * 0.35;
  for (let i = clicks.length - 1; i >= 0; i--) {
    const click = clicks[i];
    if (click.kind === "up") continue;
    if (time >= click.t && time - click.t < duration) {
      const progress = (time - click.t) / duration;
      const ease = Math.sin(progress * Math.PI) * (1 - progress * 0.3);
      return Math.max(0.2, 1 - ease * peak);
    }
    if (click.t < time - duration) break;
  }
  return 1;
}

function dragScale(time: number, clicks: readonly ClickEvent[]): number {
  let lastDown: number | null = null;
  let lastUp: number | null = null;
  for (const click of clicks) {
    if (click.t > time) break;
    if (click.button !== PRIMARY_BUTTON) continue;
    if (click.kind === "up") lastUp = click.t;
    else lastDown = click.t;
  }
  if (lastDown === null) return 1;

  const held = lastUp === null || lastDown > lastUp;
  if (held) {
    const holdDuration = time - lastDown;
    if (holdDuration < DRAG_MIN_HOLD) return 1;
    const progress = Math.min(1, (holdDuration - DRAG_MIN_HOLD) / DRAG_TRANSITION_IN);
    return 1 + (DRAG_SCALE - 1) * progress;
  }

  if (lastUp === null || lastUp - lastDown < DRAG_MIN_HOLD) return 1;
  const elapsed = time - lastUp;
  if (elapsed < 0 || elapsed >= DRAG_TRANSITION_OUT) return 1;
  const heldProgress = Math.max(0, Math.min(1, (lastUp - lastDown - DRAG_MIN_HOLD) / DRAG_TRANSITION_IN));
  const releaseScale = 1 + (DRAG_SCALE - 1) * heldProgress;
  return releaseScale + (1 - releaseScale) * (elapsed / DRAG_TRANSITION_OUT);
}

function shapeTransitionScale(time: number, changes: readonly number[]): number {
  let lo = 0;
  let hi = changes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (changes[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  const next = changes[lo];
  const previous = lo > 0 ? changes[lo - 1] : undefined;
  let scale = 1;
  if (next !== undefined && time >= next - SHAPE_OUT_DURATION && time <= next) {
    const progress = (time - (next - SHAPE_OUT_DURATION)) / SHAPE_OUT_DURATION;
    scale = 1 - (1 - SHAPE_MIN_SCALE) * smoothstep(progress);
  }
  if (previous !== undefined && time < previous + SHAPE_IN_DURATION) {
    const progress = Math.max(0, (time - previous) / SHAPE_IN_DURATION);
    scale = Math.min(scale, SHAPE_MIN_SCALE + (1 - SHAPE_MIN_SCALE) * smoothstep(progress));
  }
  return scale;
}

function swayDegrees(time: number, segment: VisibleSegment, shape: CursorShape, sway: number): number {
  if (sway <= 0 || shape === "text") return 0;
  const direction = timelineDirection(time, segment.spring, 0.08);
  if (direction.speed <= 0.005) return 0;
  return Math.max(-1, Math.min(1, direction.dx * 50)) * sway * 20;
}

export function cursorStateAt(timeline: CursorTimeline, time: number, settings: CursorSettings): CursorFrameState | null {
  const segment = segmentAt(timeline, time);
  if (!segment) return null;

  const opacity = Math.min(
    segmentOpacity(segment, time, segment === timeline.segments[0]),
    idleOpacity(time, segment, settings),
  );
  if (opacity <= 0) return null;

  const position = sampleTimeline(time, segment.spring);
  const previous = sampleTimeline(Math.max(segment.start, time - MOTION_SAMPLE_STEP), segment.spring);
  const shape = settings.lockType ? "default" : sampleShape(time, timeline.raw);
  const drag = dragScale(time, timeline.clicks);
  const interaction = drag !== 1 ? drag : clickScale(time, timeline.clicks, settings.clickEffectIntensity);
  const shapeScale = settings.lockType ? 1 : shapeTransitionScale(time, timeline.shapeChanges);

  return {
    x: position.x,
    y: position.y,
    previousX: previous.x,
    previousY: previous.y,
    shape,
    scale: Math.min(interaction, shapeScale),
    rotationDeg: swayDegrees(time, segment, shape, settings.sway),
    opacity,
  };
}
