import type { SpeedClip } from "@/shared/settings";

export const MIN_SPEED_CLIP_SECONDS = 0.1;
export const DEFAULT_SPEED_CLIP_SECONDS = 2;
export const DEFAULT_SPEED_RATE = 2;
export const MIN_SPEED_RATE = 0.25;
export const MAX_SPEED_RATE = 16;
export const SPEED_PRESETS = [0.5, 1.5, 2, 4, 8, 16] as const;

export interface Bounds {
  start: number;
  end: number;
}

function sorted(clips: readonly SpeedClip[]): SpeedClip[] {
  return [...clips].sort((a, b) => a.start - b.start);
}

function neighbours(clips: readonly SpeedClip[], id: string, bounds: Bounds): { min: number; max: number } {
  const others = clips.filter((clip) => clip.id !== id);
  const self = clips.find((clip) => clip.id === id);
  if (!self) return { min: bounds.start, max: bounds.end };
  const min = Math.max(bounds.start, ...others.filter((clip) => clip.end <= self.start + 1e-6).map((clip) => clip.end));
  const max = Math.min(bounds.end, ...others.filter((clip) => clip.start >= self.end - 1e-6).map((clip) => clip.start));
  return { min, max };
}

export function speedClipAt(clips: readonly SpeedClip[], time: number): SpeedClip | undefined {
  return clips.find((clip) => time >= clip.start && time < clip.end);
}

export function addSpeedClip(clips: readonly SpeedClip[], time: number, bounds: Bounds, id: string): SpeedClip[] | null {
  const start = Math.min(Math.max(time, bounds.start), bounds.end);
  if (speedClipAt(clips, start)) return null;
  const nextStart = Math.min(bounds.end, ...clips.filter((clip) => clip.start >= start).map((clip) => clip.start));
  const end = Math.min(start + DEFAULT_SPEED_CLIP_SECONDS, nextStart);
  if (end - start < MIN_SPEED_CLIP_SECONDS) return null;
  return sorted([...clips, { id, start, end, rate: DEFAULT_SPEED_RATE }]);
}

export function moveSpeedClip(clips: readonly SpeedClip[], id: string, start: number, bounds: Bounds): SpeedClip[] {
  const clip = clips.find((item) => item.id === id);
  if (!clip) return [...clips];
  const length = clip.end - clip.start;
  const { min, max } = neighbours(clips, id, bounds);
  const clamped = Math.min(Math.max(start, min), Math.max(min, max - length));
  return sorted(clips.map((item) => (item.id === id ? { ...item, start: clamped, end: clamped + Math.min(length, max - min) } : item)));
}

export function resizeSpeedClip(clips: readonly SpeedClip[], id: string, edge: "start" | "end", time: number, bounds: Bounds): SpeedClip[] {
  const { min, max } = neighbours(clips, id, bounds);
  return sorted(
    clips.map((clip) => {
      if (clip.id !== id) return clip;
      if (edge === "start") return { ...clip, start: Math.min(Math.max(time, min), clip.end - MIN_SPEED_CLIP_SECONDS) };
      return { ...clip, end: Math.max(Math.min(time, max), clip.start + MIN_SPEED_CLIP_SECONDS) };
    }),
  );
}

export function setSpeedRate(clips: readonly SpeedClip[], id: string, rate: number): SpeedClip[] {
  const clamped = Math.min(MAX_SPEED_RATE, Math.max(MIN_SPEED_RATE, rate));
  return clips.map((clip) => (clip.id === id ? { ...clip, rate: clamped } : clip));
}

export function removeSpeedClip(clips: readonly SpeedClip[], id: string): SpeedClip[] {
  return clips.filter((clip) => clip.id !== id);
}

export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}
