import { SpringCursor } from "@/render/cursor/spring";
import {
  dropExitAfter,
  exitSamples,
  LEAVE_FADE,
  LEAVE_MERGE_GAP,
  nextClickIndex,
  SPRING_FPS,
  springConfigAt,
  type CursorTimeline,
  type VisibleSegment,
} from "@/render/cursor/timeline";
import type { PointerSample } from "@/shared/types";

const TARGET_LOOKAHEAD = 0.25;

export const POINTER_LOOKAHEAD = LEAVE_MERGE_GAP + 0.1;

interface LiveSegment {
  visible: VisibleSegment;
  samples: PointerSample[];
  spring: SpringCursor;
  tick: number;
  sampleIndex: number;
  clickIndex: number;
}

function insertByTime<T extends { t: number }>(items: T[], item: T) {
  let index = items.length;
  while (index > 0 && items[index - 1].t > item.t) index--;
  items.splice(index, 0, item);
}

function targetAt(samples: readonly PointerSample[], index: number, time: number): { x: number; y: number } {
  const a = samples[index];
  const b = samples[index + 1];
  if (!b || b.t <= a.t) return a;
  const from = Math.max(a.t, b.t - TARGET_LOOKAHEAD);
  const f = Math.max(0, Math.min(1, (time - from) / (b.t - from)));
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export class LiveCursorTimeline {
  readonly timeline: CursorTimeline = { raw: [], segments: [], clicks: [], shapeChanges: [] };
  private readonly segments: LiveSegment[] = [];
  private open: LiveSegment | null = null;
  private leftAt: number | null = null;

  constructor(private readonly speed: number) {}

  add(samples: readonly PointerSample[]) {
    for (const sample of [...samples].sort((a, b) => a.t - b.t)) this.addSample(sample);
  }

  advance(knownUntil: number) {
    if (this.leftAt !== null && knownUntil > this.leftAt + LEAVE_MERGE_GAP) this.closeAfterLeave(this.leftAt);
    for (const segment of this.segments) this.step(segment, knownUntil - TARGET_LOOKAHEAD);
  }

  finish(duration: number) {
    if (this.leftAt !== null) this.closeAfterLeave(this.leftAt);
    for (const segment of this.segments) this.step(segment, duration);
  }

  private addSample(sample: PointerSample) {
    if (sample.kind === "leave") {
      if (this.open) {
        for (const exit of exitSamples(this.open.samples, sample)) insertByTime(this.open.samples, exit);
        this.leftAt = sample.t;
      }
      return;
    }

    const { raw, clicks, shapeChanges } = this.timeline;
    const previousShape = raw.at(-1)?.shape;
    insertByTime(raw, { t: sample.t, x: sample.x, y: sample.y, shape: sample.shape });
    if (previousShape !== undefined && previousShape !== sample.shape) shapeChanges.push(sample.t);
    if (sample.kind === "down" || sample.kind === "up") {
      insertByTime(clicks, { t: sample.t, x: sample.x, y: sample.y, kind: sample.kind, button: sample.button });
    }

    if (this.open && this.leftAt !== null) {
      dropExitAfter(this.open.samples, sample.t);
      this.open.sampleIndex = Math.min(this.open.sampleIndex, this.open.samples.length - 1);
    }
    const previous = this.open?.samples.at(-1);
    if (previous && previous.tabId !== sample.tabId) this.close(sample.t, 0);
    else if (this.leftAt !== null && sample.t - this.leftAt > LEAVE_MERGE_GAP) this.closeAfterLeave(this.leftAt, sample.t);
    this.leftAt = null;

    if (this.open) insertByTime(this.open.samples, sample);
    else this.open = this.openSegment(sample);
  }

  private openSegment(first: PointerSample): LiveSegment {
    const spring = new SpringCursor();
    spring.setPosition(first.x, first.y);
    spring.setTarget(first.x, first.y);
    const visible: VisibleSegment = { start: first.t, end: Infinity, fadeOut: LEAVE_FADE, spring: [] };
    const segment: LiveSegment = { visible, samples: [first], spring, tick: 0, sampleIndex: 0, clickIndex: 0 };
    this.timeline.segments.push(visible);
    this.segments.push(segment);
    return segment;
  }

  private closeAfterLeave(leftAt: number, returnedAt = Infinity) {
    this.close(Math.min(leftAt + LEAVE_FADE, returnedAt), LEAVE_FADE);
  }

  private close(end: number, fadeOut: number) {
    if (this.open) {
      this.open.visible.end = end;
      this.open.visible.fadeOut = fadeOut;
    }
    this.open = null;
    this.leftAt = null;
  }

  private step(segment: LiveSegment, until: number) {
    const { visible, samples, spring } = segment;
    const { clicks } = this.timeline;
    const last = Math.min(until, visible.end);
    for (let t = visible.start + segment.tick / SPRING_FPS; t <= last; t = visible.start + segment.tick / SPRING_FPS) {
      while (segment.sampleIndex < samples.length - 1 && samples[segment.sampleIndex + 1].t <= t) segment.sampleIndex++;
      const target = targetAt(samples, segment.sampleIndex, t);
      segment.clickIndex = nextClickIndex(clicks, segment.clickIndex, t);
      spring.updateConfig(springConfigAt(t, clicks, segment.clickIndex, this.speed));
      spring.setTarget(target.x, target.y);
      const position = spring.step(1000 / SPRING_FPS);
      visible.spring.push({ t, x: position.x, y: position.y });
      segment.tick++;
    }
  }
}
