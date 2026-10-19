import { TimeMap } from "@/render/timeMap";

export interface PlaybackSnapshot {
  time: number;
  playing: boolean;
}

type Listener = () => void;

const END_TOLERANCE_SECONDS = 1e-3;

export class PlaybackClock {
  private snapshot: PlaybackSnapshot = { time: 0, playing: false };
  private readonly listeners = new Set<Listener>();
  private anchorOutput = 0;
  private anchorNow = 0;
  private frame: number | null = null;
  private timeMap = new TimeMap(0, 0, []);

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

  get map(): TimeMap {
    return this.timeMap;
  }

  setTimeMap(map: TimeMap) {
    this.timeMap = map;
    this.seek(this.snapshot.time);
  }

  play() {
    if (this.snapshot.playing) return;
    const atEnd = this.timeMap.outputAt(this.snapshot.time) >= this.timeMap.outputDuration - END_TOLERANCE_SECONDS;
    const time = atEnd ? this.timeMap.sourceStart : this.snapshot.time;
    this.anchor(time);
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
    const clamped = Math.min(Math.max(time, this.timeMap.sourceStart), this.timeMap.sourceEnd);
    this.anchor(clamped);
    this.emit({ time: clamped, playing: this.snapshot.playing });
  }

  private anchor(time: number) {
    this.anchorOutput = this.timeMap.outputAt(time);
    this.anchorNow = performance.now();
  }

  private readonly tick = (now: number) => {
    const output = this.anchorOutput + (now - this.anchorNow) / 1000;
    if (output >= this.timeMap.outputDuration) {
      this.frame = null;
      this.emit({ time: this.timeMap.sourceEnd, playing: false });
      return;
    }
    this.emit({ time: this.timeMap.sourceAt(output), playing: true });
    this.frame = requestAnimationFrame(this.tick);
  };

  private emit(snapshot: PlaybackSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
