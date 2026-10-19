import type { SpeedClip } from "@/shared/settings";
import { freeSpanAt, sortedSpans, type Bounds } from "./clipSpans";

export { moveSpan as moveSpeedClip, removeSpan as removeSpeedClip, resizeSpan as resizeSpeedClip, spanAt as speedClipAt } from "./clipSpans";
export type { Bounds } from "./clipSpans";

export const DEFAULT_SPEED_CLIP_SECONDS = 2;
export const DEFAULT_SPEED_RATE = 2;
export const MIN_SPEED_RATE = 0.25;
export const MAX_SPEED_RATE = 16;
export const SPEED_PRESETS = [0.5, 1.5, 2, 4, 8, 16] as const;

export function addSpeedClip(clips: readonly SpeedClip[], time: number, bounds: Bounds, id: string): SpeedClip[] | null {
  const span = freeSpanAt(clips, time, DEFAULT_SPEED_CLIP_SECONDS, bounds);
  if (!span) return null;
  return sortedSpans([...clips, { id, ...span, rate: DEFAULT_SPEED_RATE }]);
}

export function setSpeedRate(clips: readonly SpeedClip[], id: string, rate: number): SpeedClip[] {
  const clamped = Math.min(MAX_SPEED_RATE, Math.max(MIN_SPEED_RATE, rate));
  return clips.map((clip) => (clip.id === id ? { ...clip, rate: clamped } : clip));
}

export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}
