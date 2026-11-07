import type { FrameRecord } from "@/shared/types";

const CACHE_SIZE = 16;

export class FrameSequence {
  private readonly cache = new Map<number, ImageBitmap>();
  private readonly pending = new Map<number, Promise<ImageBitmap>>();
  private pinned: number | null = null;
  private shown: ImageBitmap | null = null;

  private readonly frames: FrameRecord[];

  constructor(frames: readonly FrameRecord[], private readonly cacheSize = CACHE_SIZE) {
    this.frames = [...frames];
  }

  clone(cacheSize = this.cacheSize): FrameSequence {
    return new FrameSequence(this.frames, cacheSize);
  }

  append(records: readonly FrameRecord[]) {
    for (const record of records) {
      const last = this.frames.at(-1);
      if (!last || record.t >= last.t) this.frames.push(record);
    }
  }

  get length(): number {
    return this.frames.length;
  }

  indexAt(time: number): number {
    let lo = 0;
    let hi = this.frames.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (this.frames[mid].t <= time) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found === -1 && this.frames.length > 0 ? 0 : found;
  }

  timeOf(index: number): number {
    return this.frames[index]?.t ?? 0;
  }

  cached(index: number): ImageBitmap | undefined {
    const bitmap = this.cache.get(index);
    if (bitmap) {
      this.cache.delete(index);
      this.cache.set(index, bitmap);
    }
    return bitmap;
  }

  pin(index: number) {
    this.pinned = index;
  }

  decode(index: number): Promise<ImageBitmap> {
    const cached = this.cached(index);
    if (cached) return Promise.resolve(cached);
    let pending = this.pending.get(index);
    if (!pending) {
      pending = createImageBitmap(this.frames[index].blob).then((bitmap) => {
        this.pending.delete(index);
        this.cache.set(index, bitmap);
        this.evict();
        return bitmap;
      });
      this.pending.set(index, pending);
    }
    return pending;
  }

  frameForDisplay(time: number, prefetchCount: number, onDecoded: () => void): ImageBitmap | null {
    const index = this.indexAt(time);
    if (index < 0) return this.shown;
    const cached = this.cached(index);
    if (cached) {
      this.pin(index);
      this.shown = cached;
    } else {
      void this.decode(index).then(onDecoded);
    }
    if (prefetchCount > 0) this.prefetch(index + 1, prefetchCount);
    return this.shown;
  }

  prefetch(fromIndex: number, count: number) {
    const end = Math.min(this.frames.length, fromIndex + count);
    for (let index = Math.max(0, fromIndex); index < end; index++) {
      if (!this.cache.has(index)) void this.decode(index);
    }
  }

  dispose() {
    for (const bitmap of this.cache.values()) bitmap.close();
    this.cache.clear();
  }

  private evict() {
    for (const [index, bitmap] of this.cache) {
      if (this.cache.size <= this.cacheSize) return;
      if (index === this.pinned) continue;
      this.cache.delete(index);
      bitmap.close();
    }
  }
}
