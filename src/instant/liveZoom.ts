import type { ClickEvent, TimelinePoint } from "@/render/cursor/timeline";
import { clamp01, easeInOutCubic, easeOutCubic } from "@/render/zoom/easing";
import { DEADZONE_SPRING, IDENTITY_VIEW, soften, stepSpring, type ZoomSource, type ZoomView } from "@/render/zoom/zoomCamera";
import { POINTER_LOOKAHEAD } from "./liveCursorTimeline";

export const LIVE_ZOOM_SCALE = 1.5;

const STEPS_PER_SECOND = 120;
const STEP = 1 / STEPS_PER_SECOND;
const ZOOM_IN_LEAD = 0.45;
const STAY_LEAD = POINTER_LOOKAHEAD - 0.2;
const HOLD = 2.2;
const END_MARGIN = 1;
const MIN_ZOOMED = 0.6;
const SAFE_AREA = 0.7;
const ZOOM_OUT = 0.7;
const SNAP_STRENGTH = 0.05;

interface Point {
  x: number;
  y: number;
}

interface Transition {
  from: number;
  to: number;
  start: number;
  duration: number;
}

function strengthAt({ from, to, start, duration }: Transition, time: number): number {
  const progress = clamp01((time - start) / duration);
  return from + (to - from) * (to > from ? easeInOutCubic(progress) : easeOutCubic(progress));
}

function pivotFor(center: number): number {
  return (LIVE_ZOOM_SCALE * center - 0.5) / (LIVE_ZOOM_SCALE - 1);
}

function zoomTowards(focus: Point, strength: number): ZoomView {
  if (strength <= 0) return IDENTITY_VIEW;
  const center = soften(focus, LIVE_ZOOM_SCALE);
  const scale = LIVE_ZOOM_SCALE ** strength;
  const along = (value: number) => {
    const pivot = pivotFor(value);
    return pivot - (pivot - 0.5) / scale;
  };
  return { scale, centerX: along(center.x), centerY: along(center.y) };
}

export class LiveZoom implements ZoomSource {
  private tick = 0;
  private zoomed = false;
  private strength = 0;
  private transition: Transition = { from: 0, to: 0, start: 0, duration: 1 };
  private focus = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  private target: Point = { x: 0.5, y: 0.5 };
  private clickIndex = 0;
  private pointIndex = 0;
  private end = Infinity;
  private view: ZoomView = IDENTITY_VIEW;

  constructor(private readonly clicks: readonly ClickEvent[], private readonly points: readonly TimelinePoint[]) {}

  finish(duration: number) {
    this.end = duration - END_MARGIN;
  }

  at(time: number): ZoomView {
    while ((this.tick + 1) * STEP <= time + 1e-9) {
      this.tick++;
      this.step(this.tick * STEP);
    }
    return this.view;
  }

  private step(time: number) {
    const { upcoming, recent } = this.clicksAround(time);
    const imminent = upcoming && upcoming.t <= time + ZOOM_IN_LEAD ? upcoming : null;
    const anchor = imminent ?? this.pointerAt(time);
    const zoomed = time < this.end && (recent || imminent !== null || (this.zoomed && upcoming !== null));
    if (zoomed && !this.zoomed && this.strength < SNAP_STRENGTH) {
      this.target = anchor;
      this.focus = { x: anchor.x, y: anchor.y, vx: 0, vy: 0 };
    } else if (zoomed && !this.inView(anchor)) {
      this.target = anchor;
    }
    if (zoomed !== this.zoomed) {
      const to = zoomed ? 1 : 0;
      const duration = zoomed ? Math.max(STEP, (imminent?.t ?? time + ZOOM_IN_LEAD) - time) : ZOOM_OUT;
      this.transition = { from: this.strength, to, start: time, duration: duration * Math.max(0.3, Math.abs(to - this.strength)) };
    }
    this.zoomed = zoomed;

    this.strength = strengthAt(this.transition, time);
    const [x, vx] = stepSpring(this.focus.x, this.focus.vx, this.target.x, STEP, DEADZONE_SPRING);
    const [y, vy] = stepSpring(this.focus.y, this.focus.vy, this.target.y, STEP, DEADZONE_SPRING);
    this.focus = { x, y, vx, vy };

    this.view = zoomTowards(this.focus, this.strength);
  }

  private clicksAround(time: number): { upcoming: ClickEvent | null; recent: boolean } {
    while (this.clickIndex < this.clicks.length && this.clicks[this.clickIndex].t < time - HOLD) this.clickIndex++;
    let recent = false;
    for (let index = this.clickIndex; index < this.clicks.length; index++) {
      const click = this.clicks[index];
      if (click.t > time + STAY_LEAD) break;
      if (click.kind !== "down" || click.t > this.end - MIN_ZOOMED) continue;
      if (click.t > time) return { upcoming: click, recent };
      recent = true;
    }
    return { upcoming: null, recent };
  }

  private pointerAt(time: number): Point {
    if (this.points.length === 0) return this.target;
    while (this.pointIndex < this.points.length - 1 && this.points[this.pointIndex + 1].t <= time) this.pointIndex++;
    return this.points[this.pointIndex];
  }

  private inView(point: Point): boolean {
    const center = soften(this.target, LIVE_ZOOM_SCALE);
    const reach = (SAFE_AREA * 0.5) / LIVE_ZOOM_SCALE;
    return Math.abs(point.x - center.x) <= reach && Math.abs(point.y - center.y) <= reach;
  }
}
