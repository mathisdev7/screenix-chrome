const TICK_STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
const MIN_TICK_SPACING_PX = 64;

export function tickStep(pixelsPerSecond: number): number {
  return TICK_STEPS.find((step) => step * pixelsPerSecond >= MIN_TICK_SPACING_PX) ?? TICK_STEPS[TICK_STEPS.length - 1];
}

export function tickTimes(duration: number, step: number): number[] {
  const count = Math.floor(duration / step + 1e-6);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  return step >= 0.5 ? 1 : 2;
}

export function formatTick(seconds: number, step: number): string {
  const decimals = decimalsFor(step);
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds - minutes * 60).toFixed(decimals);
  return `${minutes}:${rest.padStart(decimals > 0 ? decimals + 3 : 2, "0")}`;
}
