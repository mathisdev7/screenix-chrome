import type { EditorSettings, SpeedClip, TrimRange } from "@/shared/settings";

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

export function trimmedRange(settings: EditorSettings, duration: number): { start: number; end: number } {
  return trimBounds(settings.trim, duration);
}

function clipsWithin(clips: readonly SpeedClip[], start: number, end: number): SpeedClip[] {
  return clips
    .map((clip) => ({ ...clip, start: Math.max(clip.start, start), end: Math.min(clip.end, end) }))
    .filter((clip) => clip.end - clip.start > EPSILON && clip.rate > 0)
    .sort((a, b) => a.start - b.start);
}

export class TimeMap {
  readonly segments: readonly TimeSegment[];
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly outputDuration: number;

  constructor(start: number, end: number, clips: readonly SpeedClip[]) {
    const segments: TimeSegment[] = [];
    let source = start;
    let output = 0;
    const push = (until: number, rate: number) => {
      if (until - source <= EPSILON) return;
      segments.push({ sourceStart: source, sourceEnd: until, outputStart: output, rate });
      output += (until - source) / rate;
      source = until;
    };
    for (const clip of clipsWithin(clips, start, end)) {
      if (clip.start < source - EPSILON) continue;
      push(clip.start, 1);
      push(clip.end, clip.rate);
    }
    push(end, 1);
    if (segments.length === 0) segments.push({ sourceStart: start, sourceEnd: end, outputStart: 0, rate: 1 });
    this.segments = segments;
    this.sourceStart = start;
    this.sourceEnd = end;
    this.outputDuration = output;
  }

  static fromSettings(settings: EditorSettings, duration: number): TimeMap {
    return TimeMap.from(settings.trim, settings.speed, duration);
  }

  static from(trim: TrimRange, speed: readonly SpeedClip[], duration: number): TimeMap {
    const { start, end } = trimBounds(trim, duration);
    return new TimeMap(start, end, speed);
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
    const clamped = Math.min(Math.max(source, this.sourceStart), this.sourceEnd);
    const segment = this.segmentForSource(clamped);
    return segment.outputStart + (clamped - segment.sourceStart) / segment.rate;
  }

  rateAt(source: number): number {
    return this.segmentForSource(Math.min(Math.max(source, this.sourceStart), this.sourceEnd)).rate;
  }
}
