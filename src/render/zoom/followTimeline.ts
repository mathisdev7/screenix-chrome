import type { ZoomClip } from "@/shared/settings";
import type { TimelinePoint } from "../cursor/timeline";
import type { Size } from "../geometry";
import { clamp, lerp } from "./easing";
import { bucketAt, DEADZONE_SPRING, deadzoneBuckets, stepSpring, zoomInDuration, type Point } from "./zoomCamera";

const SAMPLE_RATE = 120;
const STRIDE = 2;

export interface FollowSource {
  at(time: number): Point;
}

export class FollowTimeline implements FollowSource {
  private constructor(private readonly samples: Float32Array, private readonly visible: Size) {}

  static build(points: readonly TimelinePoint[], visible: Size, duration: number): FollowTimeline {
    const buckets = deadzoneBuckets(points, visible.width * 0.5, visible.height * 0.7);
    const count = Math.ceil(duration * SAMPLE_RATE) + 2;
    const samples = new Float32Array(count * STRIDE);
    const dt = 1 / SAMPLE_RATE;
    const keepInside = (value: number, size: number) => clamp(value, size / 2, 1 - size / 2);
    const first = buckets[0] ?? { x: 0.5, y: 0.5 };
    let x = first.x;
    let y = first.y;
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < count; i++) {
      const target = buckets.length > 0 ? bucketAt(buckets, i * dt) : first;
      [x, vx] = stepSpring(x, vx, target.x, dt, DEADZONE_SPRING);
      [y, vy] = stepSpring(y, vy, target.y, dt, DEADZONE_SPRING);
      samples.set([keepInside(x, visible.width), keepInside(y, visible.height)], i * STRIDE);
    }
    return new FollowTimeline(samples, visible);
  }

  at(time: number): Point {
    const count = this.samples.length / STRIDE;
    const position = clamp(time * SAMPLE_RATE, 0, count - 1);
    const index = Math.floor(position);
    const next = Math.min(count - 1, index + 1);
    const fraction = position - index;
    const read = (offset: number) => lerp(this.samples[index * STRIDE + offset], this.samples[next * STRIDE + offset], fraction);
    return { x: read(0), y: read(1) };
  }

  toWindow(point: Point, time: number): Point {
    const focus = this.at(time);
    return {
      x: (point.x - focus.x) / this.visible.width + 0.5,
      y: (point.y - focus.y) / this.visible.height + 0.5,
    };
  }

  windowPoints(points: readonly TimelinePoint[]): TimelinePoint[] {
    return points.map((point) => ({ t: point.t, ...this.toWindow(point, point.t) }));
  }

  windowClips(clips: readonly ZoomClip[]): ZoomClip[] {
    return clips.map((clip) => {
      if (clip.mode !== "manual") return clip;
      const center = this.toWindow({ x: clip.centerX, y: clip.centerY }, clip.start + zoomInDuration(clip));
      return { ...clip, centerX: clamp(center.x, 0, 1), centerY: clamp(center.y, 0, 1) };
    });
  }
}
