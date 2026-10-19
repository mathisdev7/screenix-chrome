export const MIN_CLIP_SECONDS = 0.1;

export interface Bounds {
  start: number;
  end: number;
}

export interface Span {
  id: string;
  start: number;
  end: number;
}

export function sortedSpans<T extends Span>(clips: readonly T[]): T[] {
  return [...clips].sort((a, b) => a.start - b.start);
}

function neighbours(clips: readonly Span[], id: string, bounds: Bounds): { min: number; max: number } {
  const others = clips.filter((clip) => clip.id !== id);
  const self = clips.find((clip) => clip.id === id);
  if (!self) return { min: bounds.start, max: bounds.end };
  const min = Math.max(bounds.start, ...others.filter((clip) => clip.end <= self.start + 1e-6).map((clip) => clip.end));
  const max = Math.min(bounds.end, ...others.filter((clip) => clip.start >= self.end - 1e-6).map((clip) => clip.start));
  return { min, max };
}

export function spanAt<T extends Span>(clips: readonly T[], time: number): T | undefined {
  return clips.find((clip) => time >= clip.start && time < clip.end);
}

export function freeSpanAt(clips: readonly Span[], time: number, length: number, bounds: Bounds): Bounds | null {
  const start = Math.min(Math.max(time, bounds.start), bounds.end);
  if (spanAt(clips, start)) return null;
  const nextStart = Math.min(bounds.end, ...clips.filter((clip) => clip.start >= start).map((clip) => clip.start));
  const end = Math.min(start + length, nextStart);
  return end - start < MIN_CLIP_SECONDS ? null : { start, end };
}

export function moveSpan<T extends Span>(clips: readonly T[], id: string, start: number, bounds: Bounds): T[] {
  const clip = clips.find((item) => item.id === id);
  if (!clip) return [...clips];
  const length = clip.end - clip.start;
  const { min, max } = neighbours(clips, id, bounds);
  const clamped = Math.min(Math.max(start, min), Math.max(min, max - length));
  return sortedSpans(clips.map((item) => (item.id === id ? { ...item, start: clamped, end: clamped + Math.min(length, max - min) } : item)));
}

export function resizeSpan<T extends Span>(clips: readonly T[], id: string, edge: "start" | "end", time: number, bounds: Bounds): T[] {
  const { min, max } = neighbours(clips, id, bounds);
  return sortedSpans(
    clips.map((clip) => {
      if (clip.id !== id) return clip;
      if (edge === "start") return { ...clip, start: Math.min(Math.max(time, min), clip.end - MIN_CLIP_SECONDS) };
      return { ...clip, end: Math.max(Math.min(time, max), clip.start + MIN_CLIP_SECONDS) };
    }),
  );
}

export function removeSpan<T extends Span>(clips: readonly T[], id: string): T[] {
  return clips.filter((clip) => clip.id !== id);
}
