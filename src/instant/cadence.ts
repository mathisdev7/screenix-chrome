const SLOWEST_STRIDE = 2;
const STEP_DOWN_LAG = 1.5;
const STEP_UP_LAG = 0.5;
const CALM_UPDATES = 5;

export class Cadence {
  private current = 1;
  private lastLag = 0;
  private calm = 0;

  get stride(): number {
    return this.current;
  }

  update(lag: number) {
    const growing = lag > this.lastLag;
    this.lastLag = lag;
    if (lag > STEP_DOWN_LAG && growing) {
      this.current = Math.min(SLOWEST_STRIDE, this.current + 1);
      this.calm = 0;
    } else if (lag < STEP_UP_LAG) {
      this.calm++;
      if (this.calm >= CALM_UPDATES && this.current > 1) {
        this.current--;
        this.calm = 0;
      }
    } else {
      this.calm = 0;
    }
  }

  skips(index: number): boolean {
    return index % this.current !== 0;
  }
}
