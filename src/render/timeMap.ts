import type { CutClip, EditorSettings, SpeedClip, TrimRange } from "@/shared/settings";

export interface TimeSegment {
  sourceStart: number;
  sourceEnd: number;
  outputStart: number;
  rate: number;
}

const EPSILON = 1e-6;

export const MAX_AUDIBLE_RATE = 4;

export function trimBounds(trim: TrimRange, duration: number): { start: number; end: number } {
  const start = Math.max(0, Math.min(trim.start, duration));
  const end = Math.max(start, Math.min(trim.end ?? duration, duration));
  return { start, end };
}

function clipsWithin(clips: readonly SpeedClip[], start: number, end: number): SpeedClip[] {
  return clips
    .map((clip) => ({ ...clip, start: Math.max(clip.start, start), end: Math.min(clip.end, end) }))
    .filter((clip) => clip.end - clip.start > EPSILON && clip.rate > 0)
    .sort((a, b) => a.start - b.start);
}

function keptRanges(start: number, end: number, cuts: readonly CutClip[]): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let from = start;
  for (const cut of [...cuts].sort((a, b) => a.start - b.start)) {
    if (cut.start >= end) break;
    if (cut.end <= from) continue;
    if (cut.start > from) ranges.push({ start: from, end: cut.start });
    from = Math.max(from, cut.end);
  }
  if (end > from) ranges.push({ start: from, end });
  return ranges;
}

export class TimeMap {
  readonly segments: readonly TimeSegment[];
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly outputDuration: number;

  constructor(start: number, end: number, clips: readonly SpeedClip[], cuts: readonly CutClip[] = []) {
    const segments: TimeSegment[] = [];
    let output = 0;
    for (const kept of keptRanges(start, end, cuts)) {
      let source = kept.start;
      const push = (until: number, rate: number) => {
        if (until - source <= EPSILON) return;
        segments.push({ sourceStart: source, sourceEnd: until, outputStart: output, rate });
        output += (until - source) / rate;
        source = until;
      };
      for (const clip of clipsWithin(clips, kept.start, kept.end)) {
        if (clip.start < source - EPSILON) continue;
        push(clip.start, 1);
        push(clip.end, clip.rate);
      }
      push(kept.end, 1);
    }
    if (segments.length === 0) segments.push({ sourceStart: start, sourceEnd: start, outputStart: 0, rate: 1 });
    this.segments = segments;
    this.sourceStart = start;
    this.sourceEnd = end;
    this.outputDuration = output;
  }

  static fromSettings(settings: EditorSettings, duration: number): TimeMap {
    return TimeMap.from(settings.trim, settings.speed, settings.cuts, duration);
  }

  static from(trim: TrimRange, speed: readonly SpeedClip[], cuts: readonly CutClip[], duration: number): TimeMap {
    const { start, end } = trimBounds(trim, duration);
    return new TimeMap(start, end, speed, cuts);
  }

  private segmentForSource(source: number): TimeSegment {
    return this.segments.find((segment) => source < segment.sourceEnd) ?? this.segments[this.segments.length - 1];
  }

  private segmentForOutput(output: number): TimeSegment {
    let found = this.segments[0];
    for (const segment of this.segments) {
      if (segment.outputStart > output) break;
      found = segment;
    }
    return found;
  }

  sourceAt(output: number): number {
    const clamped = Math.min(Math.max(output, 0), this.outputDuration);
    const segment = this.segmentForOutput(clamped);
    return Math.min(segment.sourceEnd, segment.sourceStart + (clamped - segment.outputStart) * segment.rate);
  }

  outputAt(source: number): number {
    const segment = this.segmentForSource(source);
    const clamped = Math.min(Math.max(source, segment.sourceStart), segment.sourceEnd);
    return segment.outputStart + (clamped - segment.sourceStart) / segment.rate;
  }

  includes(source: number): boolean {
    return this.segments.some((segment) => source >= segment.sourceStart && source < segment.sourceEnd);
  }

  rateAt(source: number): number {
    return this.segmentForSource(Math.min(Math.max(source, this.sourceStart), this.sourceEnd)).rate;
  }
}
