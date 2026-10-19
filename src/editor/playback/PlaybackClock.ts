export interface PlaybackSnapshot {
  time: number;
  playing: boolean;
}

type Listener = () => void;

export class PlaybackClock {
  private snapshot: PlaybackSnapshot = { time: 0, playing: false };
  private readonly listeners = new Set<Listener>();
  private anchorTime = 0;
  private anchorNow = 0;
  private frame: number | null = null;
  private range = { start: 0, end: 0 };

  readonly subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): PlaybackSnapshot => this.snapshot;

  get time(): number {
    return this.snapshot.time;
  }

  get playing(): boolean {
    return this.snapshot.playing;
  }

  setRange(start: number, end: number) {
    this.range = { start, end };
    const clamped = Math.min(Math.max(this.snapshot.time, start), end);
    if (clamped !== this.snapshot.time) this.seek(clamped);
  }

  play() {
    if (this.snapshot.playing) return;
    const time = this.snapshot.time >= this.range.end - 1e-3 ? this.range.start : this.snapshot.time;
    this.anchorTime = time;
    this.anchorNow = performance.now();
    this.emit({ time, playing: true });
    this.frame = requestAnimationFrame(this.tick);
  }

  pause() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.snapshot.playing) this.emit({ time: this.snapshot.time, playing: false });
  }

  toggle() {
    if (this.snapshot.playing) this.pause();
    else this.play();
  }

  seek(time: number) {
    const clamped = Math.min(Math.max(time, this.range.start), this.range.end);
    this.anchorTime = clamped;
    this.anchorNow = performance.now();
    this.emit({ time: clamped, playing: this.snapshot.playing });
  }

  private readonly tick = (now: number) => {
    const time = this.anchorTime + (now - this.anchorNow) / 1000;
    if (time >= this.range.end) {
      this.frame = null;
      this.emit({ time: this.range.end, playing: false });
      return;
    }
    this.emit({ time, playing: true });
    this.frame = requestAnimationFrame(this.tick);
  };

  private emit(snapshot: PlaybackSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
