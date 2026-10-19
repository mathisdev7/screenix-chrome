import type { ZoomClip } from "@/shared/settings";
import type { TimelinePoint } from "../cursor/timeline";
import { clamp, lerp } from "./easing";
import { connectedPairs, IDENTITY_VIEW, ZoomCamera, zoomOutDuration, type ZoomView } from "./zoomCamera";

const SAMPLE_RATE = 120;
const STRIDE = 3;

interface Window {
  start: number;
  end: number;
}

function activeWindows(clips: readonly ZoomClip[]): Window[] {
  const windows = [
    ...clips.map((clip) => ({ start: clip.start, end: clip.end + zoomOutDuration(clip) })),
    ...connectedPairs(clips).map((pair) => ({ start: pair.from, end: pair.next.start })),
  ].sort((a, b) => a.start - b.start);
  const merged: Window[] = [];
  for (const window of windows) {
    const last = merged.at(-1);
    if (last && window.start <= last.end + 1 / SAMPLE_RATE) last.end = Math.max(last.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}

export class ZoomTimeline {
  static readonly empty = new ZoomTimeline(new Float32Array(0));

  private constructor(private readonly samples: Float32Array) {}

  static build(clips: readonly ZoomClip[], points: readonly TimelinePoint[], duration: number): ZoomTimeline {
    if (clips.length === 0) return ZoomTimeline.empty;
    const end = Math.max(duration, ...clips.map((clip) => clip.end + zoomOutDuration(clip)));
    const count = Math.ceil(end * SAMPLE_RATE) + 2;
    const samples = new Float32Array(count * STRIDE);
    for (let i = 0; i < count; i++) samples.set([IDENTITY_VIEW.scale, IDENTITY_VIEW.centerX, IDENTITY_VIEW.centerY], i * STRIDE);

    const dt = 1 / SAMPLE_RATE;
    for (const window of activeWindows(clips)) {
      const camera = new ZoomCamera(clips.filter((clip) => clip.end + zoomOutDuration(clip) >= window.start && clip.start <= window.end), points);
      const first = Math.max(0, Math.floor(window.start * SAMPLE_RATE));
      const last = Math.min(count - 1, Math.ceil(window.end * SAMPLE_RATE) + 1);
      for (let i = first; i <= last; i++) {
        const view = camera.step(i * dt, dt);
        samples.set([view.scale, view.centerX, view.centerY], i * STRIDE);
      }
    }
    return new ZoomTimeline(samples);
  }

  at(time: number): ZoomView {
    const count = this.samples.length / STRIDE;
    if (count === 0) return IDENTITY_VIEW;
    const position = clamp(time * SAMPLE_RATE, 0, count - 1);
    const index = Math.floor(position);
    const next = Math.min(count - 1, index + 1);
    const fraction = position - index;
    const read = (offset: number) => lerp(this.samples[index * STRIDE + offset], this.samples[next * STRIDE + offset], fraction);
    return { scale: read(0), centerX: read(1), centerY: read(2) };
  }
}
