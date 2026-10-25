import type { ZoomClip } from "@/shared/settings";
import { sampleTimeline, type TimelinePoint } from "../cursor/timeline";
import { clamp, clamp01, easeInOutCubic, easeOutCubic, easeOutSoftZoom, lerp } from "./easing";

export interface ZoomView {
  scale: number;
  centerX: number;
  centerY: number;
}

export interface ZoomSource {
  at(time: number): ZoomView;
}

export interface Point {
  x: number;
  y: number;
}

interface Spring {
  stiffness: number;
  damping: number;
  mass: number;
  restDelta: number;
  restSpeed: number;
}

interface ConnectedPair {
  current: ZoomClip;
  next: ZoomClip;
  from: number;
  to: number;
}

export interface Bucket extends Point {
  start: number;
}

interface AutoClip {
  clip: ZoomClip;
  buckets: Bucket[];
}

export const IDENTITY_VIEW: ZoomView = { scale: 1, centerX: 0.5, centerY: 0.5 };

const CONNECTED_GAP = 1.5;
const CONNECTED_PAN = 1;
const SPRING_SUBSTEP = 1 / 240;
export const DEADZONE_SPRING: Spring = { stiffness: 200, damping: 40, mass: 2.25, restDelta: 0.0002, restSpeed: 0.01 };

function focusBounds(scale: number) {
  const margin = 1 / (2 * scale);
  return { min: margin, max: 1 - margin };
}

function clampFocus(value: number, scale: number): number {
  const { min, max } = focusBounds(scale);
  return clamp(value, min, max);
}

function easeIntoBoundary(normalized: number): number {
  const t = clamp01(normalized);
  return -t * t * t + 2 * t * t;
}

function softenAxis(value: number, scale: number): number {
  const { min, max } = focusBounds(scale);
  const softness = Math.min(0.12, (max - min) * 0.35);
  const clamped = clamp(value, min, max);
  if (softness <= 0 || max <= min) return clamped;
  if (clamped < min + softness) return min + softness * easeIntoBoundary((clamped - min) / softness);
  if (clamped > max - softness) return max - softness * easeIntoBoundary((max - clamped) / softness);
  return clamped;
}

export function soften(point: Point, scale: number): Point {
  return { x: softenAxis(point.x, scale), y: softenAxis(point.y, scale) };
}

export function stepSpring(position: number, velocity: number, target: number, dt: number, spring: Spring): [number, number] {
  if (Math.abs(target - position) <= spring.restDelta && Math.abs(velocity) <= spring.restSpeed) return [target, 0];
  let p = position;
  let v = velocity;
  for (let remaining = dt; remaining > 0; remaining -= SPRING_SUBSTEP) {
    const h = Math.min(remaining, SPRING_SUBSTEP);
    v += ((-spring.stiffness * (p - target) - spring.damping * v) / spring.mass) * h;
    p += v * h;
  }
  return [p, v];
}

function clipLength(clip: ZoomClip): number {
  return Math.max(clip.end - clip.start, 1e-4);
}

export function zoomInDuration(clip: ZoomClip): number {
  return Math.min(clip.zoomIn, clipLength(clip) * 0.5);
}

export function zoomOutDuration(clip: ZoomClip): number {
  return Math.min(clip.zoomOut, clipLength(clip) * 0.5);
}

export function regionStrength(clip: ZoomClip, time: number): number {
  const out = zoomOutDuration(clip);
  if (time < clip.start || time > clip.end + out) return 0;
  const zoomIn = zoomInDuration(clip);
  const elapsed = time - clip.start;
  if (elapsed < zoomIn) return easeOutSoftZoom(elapsed / zoomIn);
  if (time <= clip.end) return 1;
  const progress = clamp01((time - clip.end) / out);
  return 1 - (clip.mode === "auto" ? easeOutCubic(progress) : easeInOutCubic(progress));
}

export function connectedPairs(clips: readonly ZoomClip[]): ConnectedPair[] {
  const manual = clips.filter((clip) => clip.mode === "manual").sort((a, b) => a.start - b.start);
  const pairs: ConnectedPair[] = [];
  for (let i = 0; i < manual.length - 1; i++) {
    if (manual[i + 1].start - manual[i].end > CONNECTED_GAP) continue;
    pairs.push({ current: manual[i], next: manual[i + 1], from: manual[i].end, to: manual[i].end + CONNECTED_PAN });
  }
  return pairs;
}

export function compose(zoomScale: number, focus: Point, strength: number): ZoomView {
  const scale = 1 + (zoomScale - 1) * strength;
  if (scale <= 1 + Number.EPSILON) return IDENTITY_VIEW;
  return { scale, centerX: lerp(0.5, focus.x, strength), centerY: lerp(0.5, focus.y, strength) };
}

function manualScale(clip: ZoomClip): number {
  return Math.max(1, clip.scale);
}

function manualFocus(clip: ZoomClip): Point {
  const scale = manualScale(clip);
  return { x: clampFocus(clip.centerX, scale), y: clampFocus(clip.centerY, scale) };
}

function manualView(clips: readonly ZoomClip[], pairs: readonly ConnectedPair[], time: number): ZoomView {
  for (const pair of pairs) {
    if (time >= pair.from && time <= pair.to) {
      const progress = easeOutSoftZoom((time - pair.from) / Math.max(0.001, pair.to - pair.from));
      const a = manualFocus(pair.current);
      const b = manualFocus(pair.next);
      const scale = lerp(manualScale(pair.current), manualScale(pair.next), progress);
      return compose(scale, { x: lerp(a.x, b.x, progress), y: lerp(a.y, b.y, progress) }, 1);
    }
    if (time > pair.to && time < pair.next.start) return compose(manualScale(pair.next), manualFocus(pair.next), 1);
  }

  let best: { clip: ZoomClip; strength: number } | null = null;
  for (const clip of clips) {
    const outgoing = pairs.find((pair) => pair.current.id === clip.id);
    if (outgoing && time > clip.end) continue;
    const incoming = pairs.find((pair) => pair.next.id === clip.id);
    if (incoming && time < incoming.to) continue;
    let strength = regionStrength(clip, time);
    if (strength > 0 && outgoing && time >= clip.end) strength = 1;
    if (strength > 0 && incoming && time <= clip.start + zoomInDuration(clip)) strength = 1;
    if (strength > 0 && (!best || strength > best.strength)) best = { clip, strength };
  }
  if (!best) return IDENTITY_VIEW;
  return compose(manualScale(best.clip), manualFocus(best.clip), best.strength);
}

export function deadzoneBuckets(points: readonly TimelinePoint[], areaX: number, areaY: number, start = -Infinity, end = Infinity): Bucket[] {
  const buckets: Bucket[] = [];
  let current: { start: number; minX: number; maxX: number; minY: number; maxY: number } | null = null;
  const flush = () => {
    if (current) buckets.push({ start: current.start, x: (current.minX + current.maxX) / 2, y: (current.minY + current.maxY) / 2 });
  };
  for (const point of points) {
    if (point.t < start || point.t > end) continue;
    if (current) {
      const minX = Math.min(current.minX, point.x);
      const maxX = Math.max(current.maxX, point.x);
      const minY = Math.min(current.minY, point.y);
      const maxY = Math.max(current.maxY, point.y);
      if (maxX - minX <= areaX && maxY - minY <= areaY) {
        current = { start: current.start, minX, maxX, minY, maxY };
        continue;
      }
      flush();
    }
    current = { start: point.t, minX: point.x, maxX: point.x, minY: point.y, maxY: point.y };
  }
  flush();
  return buckets;
}

function clipBuckets(points: readonly TimelinePoint[], clip: ZoomClip): Bucket[] {
  const visible = 1 / Math.max(1, clip.scale);
  return deadzoneBuckets(points, visible * 0.5, visible * 0.7, clip.start, clip.end);
}

export function bucketAt(buckets: readonly Bucket[], time: number): Bucket {
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (buckets[mid].start <= time) lo = mid;
    else hi = mid - 1;
  }
  return buckets[lo];
}

export class ZoomCamera {
  private readonly auto: AutoClip[];
  private readonly manual: ZoomClip[];
  private readonly pairs: ConnectedPair[];
  private deadzone = { x: 0.5, y: 0.5, vx: 0, vy: 0, initialized: false };

  constructor(clips: readonly ZoomClip[], private readonly points: readonly TimelinePoint[]) {
    this.auto = clips.filter((clip) => clip.mode === "auto").map((clip) => ({ clip, buckets: clipBuckets(points, clip) }));
    this.manual = clips.filter((clip) => clip.mode === "manual");
    this.pairs = connectedPairs(clips);
  }

  step(time: number, dt: number): ZoomView {
    let active: { auto: AutoClip; strength: number } | null = null;
    for (const auto of this.auto) {
      const strength = regionStrength(auto.clip, time);
      if (strength > 0 && (!active || strength > active.strength)) active = { auto, strength };
    }
    if (active) return this.deadzoneView(active.auto, active.strength, time, dt);
    if (this.deadzone.initialized) {
      this.deadzone.initialized = false;
      return IDENTITY_VIEW;
    }
    return manualView(this.manual, this.pairs, time);
  }

  private focusAt({ clip, buckets }: AutoClip, time: number): Point {
    if (buckets.length > 0) return bucketAt(buckets, time);
    return this.points.length > 0 ? sampleTimeline(time, this.points) : { x: clip.centerX, y: clip.centerY };
  }

  private deadzoneView(auto: AutoClip, strength: number, time: number, dt: number): ZoomView {
    const { clip } = auto;
    const state = this.deadzone;
    const zoomScale = Math.max(1, clip.scale);
    const scale = 1 + (zoomScale - 1) * strength;
    const softScale = Math.max(1.0001, scale);
    const zoomInEnd = clip.start + zoomInDuration(clip);
    const initial = this.focusAt(auto, clip.start);
    let rawTarget = initial;
    if (time >= zoomInEnd) {
      rawTarget = time <= clip.end || !state.initialized ? this.focusAt(auto, Math.min(time, clip.end)) : { x: state.x, y: state.y };
    }
    const target = soften(rawTarget, softScale);

    if (!state.initialized) {
      const start = soften(initial, softScale);
      this.deadzone = { x: start.x, y: start.y, vx: 0, vy: 0, initialized: true };
    }

    const next = this.deadzone;
    if (time < zoomInEnd) {
      this.deadzone = { x: target.x, y: target.y, vx: 0, vy: 0, initialized: true };
    } else if (time <= clip.end) {
      const [x, vx] = stepSpring(next.x, next.vx, target.x, dt, DEADZONE_SPRING);
      const [y, vy] = stepSpring(next.y, next.vy, target.y, dt, DEADZONE_SPRING);
      this.deadzone = { x, y, vx, vy, initialized: true };
    } else {
      this.deadzone = { ...next, vx: 0, vy: 0 };
    }

    return compose(zoomScale, soften(this.deadzone, softScale), strength);
  }
}
