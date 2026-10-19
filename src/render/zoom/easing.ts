export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function bezierAxis(a1: number, a2: number, t: number): number {
  const u = 1 - t;
  return 3 * a1 * u * u * t + 3 * a2 * u * t * t + t * t * t;
}

function bezierAxisDerivative(a1: number, a2: number, t: number): number {
  const u = 1 - t;
  return 3 * a1 * u * u + 6 * (a2 - a1) * u * t + 3 * (1 - a2) * t * t;
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  const target = clamp01(t);
  let solved = target;
  for (let i = 0; i < 8; i++) {
    const error = bezierAxis(x1, x2, solved) - target;
    const slope = bezierAxisDerivative(x1, x2, solved);
    if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break;
    solved -= error / slope;
  }
  let lower = 0;
  let upper = 1;
  solved = clamp01(solved);
  for (let i = 0; i < 10; i++) {
    const x = bezierAxis(x1, x2, solved);
    if (Math.abs(x - target) < 1e-6) break;
    if (x < target) lower = solved;
    else upper = solved;
    solved = (lower + upper) / 2;
  }
  return bezierAxis(y1, y2, solved);
}

export function easeOutSoftZoom(t: number): number {
  return cubicBezier(0.16, 1, 0.3, 1, t);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3);
}
