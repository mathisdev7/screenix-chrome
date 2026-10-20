import type { ZoomClip } from "@/shared/settings";
import type { PointerSample } from "@/shared/types";
import { freeSpanAt, sortedSpans, type Bounds } from "./clipSpans";

export { moveSpan as moveZoomClip, removeSpan as removeZoomClip, resizeSpan as resizeZoomClip, spanAt as zoomClipAt } from "./clipSpans";

export const MIN_ZOOM_SCALE = 1;
export const MAX_ZOOM_SCALE = 4;
export const DEFAULT_ZOOM_SCALE = 1.5;
export const MIN_ZOOM_TRANSITION = 0.1;
export const MAX_ZOOM_TRANSITION = 2;
const DEFAULT_ZOOM_CLIP_SECONDS = 1.5;
const DEFAULT_ZOOM_IN = 1.15;
const DEFAULT_ZOOM_OUT = 0.7;
const CLICK_LEAD = 0.6;
const CLICK_HOLD = 2.2;
const MERGE_GAP = 1.8;
const END_MARGIN = 0.6;
const MIN_TAIL = 0.9;

function newZoomClip(id: string, start: number, end: number): ZoomClip {
  return {
    id,
    start,
    end,
    scale: DEFAULT_ZOOM_SCALE,
    mode: "auto",
    centerX: 0.5,
    centerY: 0.5,
    zoomIn: DEFAULT_ZOOM_IN,
    zoomOut: DEFAULT_ZOOM_OUT,
  };
}

export function addZoomClip(clips: readonly ZoomClip[], time: number, bounds: Bounds, id: string): ZoomClip[] | null {
  const span = freeSpanAt(clips, time, DEFAULT_ZOOM_CLIP_SECONDS, bounds);
  if (!span) return null;
  return sortedSpans([...clips, newZoomClip(id, span.start, span.end)]);
}

export function autoZoomClips(pointer: readonly PointerSample[], duration: number, createId: () => string): ZoomClip[] {
  const clicks = pointer
    .filter((sample) => sample.kind === "down" && Number.isFinite(sample.t) && sample.t >= 0 && sample.t < duration - MIN_TAIL)
    .map((sample) => sample.t)
    .sort((a, b) => a - b);
  const ranges: Bounds[] = [];
  for (const click of clicks) {
    const start = Math.max(click - CLICK_LEAD, 0.001);
    const end = Math.min(click + CLICK_HOLD, duration - END_MARGIN);
    if (end <= start) continue;
    const previous = ranges.at(-1);
    if (previous && previous.end + MERGE_GAP >= start) previous.end = end;
    else ranges.push({ start, end });
  }
  return ranges.map((range) => newZoomClip(createId(), range.start, range.end));
}

function clampCenter(value: number, scale: number): number {
  const half = 0.5 / Math.max(1, scale);
  return Math.max(half, Math.min(1 - half, value));
}

function clampTransition(value: number): number {
  return Math.max(MIN_ZOOM_TRANSITION, Math.min(MAX_ZOOM_TRANSITION, value));
}

export function updateZoomClip(clips: readonly ZoomClip[], id: string, patch: Partial<Omit<ZoomClip, "id" | "start" | "end">>): ZoomClip[] {
  return clips.map((clip) => {
    if (clip.id !== id) return clip;
    const next = { ...clip, ...patch };
    const scale = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, next.scale));
    return {
      ...next,
      scale,
      centerX: clampCenter(next.centerX, scale),
      centerY: clampCenter(next.centerY, scale),
      zoomIn: clampTransition(next.zoomIn),
      zoomOut: clampTransition(next.zoomOut),
    };
  });
}

export function formatScale(scale: number): string {
  return `${scale.toFixed(1)}×`;
}
