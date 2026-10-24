export type Point = readonly [number, number];

export type Paint = "fill" | "accent" | "outline" | "lens";

interface PrimBase {
  layer?: "shape" | "detail";
  paint?: Paint;
}

export interface PolyPrim extends PrimBase {
  kind: "poly";
  points: Point[];
  round?: number;
  tipRound?: number;
}

export interface CirclePrim extends PrimBase {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
}

export interface RingPrim extends PrimBase {
  kind: "ring";
  cx: number;
  cy: number;
  r: number;
  width: number;
  start?: number;
  end?: number;
}

export interface LinePrim extends PrimBase {
  kind: "line";
  points: Point[];
  width: number;
}

export type Prim = PolyPrim | CirclePrim | RingPrim | LinePrim;

export interface Glyph {
  prims: Prim[];
  hotspot: Point;
}

export const CENTER: Point = [16, 16];

function mapPoint([x, y]: Point, fn: (x: number, y: number) => Point): Point {
  return fn(x, y);
}

function mapPrim(prim: Prim, fn: (x: number, y: number) => Point, factor = 1): Prim {
  switch (prim.kind) {
    case "poly":
      return { ...prim, points: prim.points.map((p) => mapPoint(p, fn)), round: prim.round === undefined ? undefined : prim.round * factor };
    case "circle": {
      const [cx, cy] = fn(prim.cx, prim.cy);
      return { ...prim, cx, cy, r: prim.r * factor };
    }
    case "ring": {
      const [cx, cy] = fn(prim.cx, prim.cy);
      return { ...prim, cx, cy, r: prim.r * factor, width: prim.width * factor };
    }
    case "line":
      return { ...prim, points: prim.points.map((p) => mapPoint(p, fn)), width: prim.width * factor };
  }
}

export function translate(prims: Prim[], dx: number, dy: number): Prim[] {
  return prims.map((prim) => mapPrim(prim, (x, y) => [x + dx, y + dy]));
}

export function scale(prims: Prim[], factor: number, origin: Point = [0, 0]): Prim[] {
  const [ox, oy] = origin;
  return prims.map((prim) => mapPrim(prim, (x, y) => [ox + (x - ox) * factor, oy + (y - oy) * factor], factor));
}

export function rotatePoint([x, y]: Point, degrees: number, [cx, cy]: Point = CENTER): Point {
  const a = (degrees * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

export function rotate(prims: Prim[], degrees: number, origin: Point = CENTER): Prim[] {
  if (degrees === 0) return prims;
  const rotated = prims.map((prim) => mapPrim(prim, (x, y) => rotatePoint([x, y], degrees, origin)));
  return rotated.map((prim) => (prim.kind === "ring" && prim.start !== undefined ? { ...prim, start: prim.start + degrees, end: (prim.end ?? 0) + degrees } : prim));
}

export function mirrorX(prims: Prim[], axis = 16): Prim[] {
  const mirrored = prims.map((prim) => mapPrim(prim, (x, y) => [2 * axis - x, y]));
  return mirrored.map((prim) => {
    if (prim.kind === "poly") return { ...prim, points: [...prim.points].reverse() };
    if (prim.kind === "ring" && prim.start !== undefined) return { ...prim, start: 180 - (prim.end ?? 0), end: 180 - prim.start };
    return prim;
  });
}

export function rotateGlyph(glyph: Glyph, degrees: number): Glyph {
  return { prims: rotate(glyph.prims, degrees), hotspot: rotatePoint(glyph.hotspot, degrees) };
}

export function polar(cx: number, cy: number, r: number, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function arcPoints(cx: number, cy: number, r: number, start: number, end: number, steps = 12): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) points.push(polar(cx, cy, r, start + ((end - start) * i) / steps));
  return points;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

export function roundedPolygonPath(points: Point[], round: number, tipRound = round): string {
  const n = points.length;
  if (round <= 0) return `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}Z`;
  let d = "";
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i + n - 1) % n];
    const [vx, vy] = points[i];
    const [nx, ny] = points[(i + 1) % n];
    const l1 = Math.hypot(px - vx, py - vy);
    const l2 = Math.hypot(nx - vx, ny - vy);
    const r = Math.min(i === 0 ? tipRound : round, l1 / 2, l2 / 2);
    const ax = vx + ((px - vx) / l1) * r;
    const ay = vy + ((py - vy) / l1) * r;
    const bx = vx + ((nx - vx) / l2) * r;
    const by = vy + ((ny - vy) / l2) * r;
    d += `${i === 0 ? "M" : "L"}${fmt(ax)} ${fmt(ay)}Q${fmt(vx)} ${fmt(vy)} ${fmt(bx)} ${fmt(by)}`;
  }
  return `${d}Z`;
}

export function linePath(points: Point[]): string {
  return `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}`;
}

export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const [sx, sy] = polar(cx, cy, r, start);
  const [ex, ey] = polar(cx, cy, r, end);
  const sweep = end - start;
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  return `M${fmt(sx)} ${fmt(sy)}A${fmt(r)} ${fmt(r)} 0 ${large} ${sweep > 0 ? 1 : 0} ${fmt(ex)} ${fmt(ey)}`;
}

export function pointInPolygon([x, y]: Point, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentDistance([x, y]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function angleWithin(degrees: number, start: number, end: number): boolean {
  const span = ((end - start) % 360 + 360) % 360 || 360;
  const offset = ((degrees - start) % 360 + 360) % 360;
  return offset <= span;
}

export function pointInPrim(point: Point, prim: Prim, minWidth = 0): boolean {
  switch (prim.kind) {
    case "poly":
      return pointInPolygon(point, prim.points);
    case "circle":
      return Math.hypot(point[0] - prim.cx, point[1] - prim.cy) <= prim.r;
    case "ring": {
      const d = Math.hypot(point[0] - prim.cx, point[1] - prim.cy);
      if (Math.abs(d - prim.r) > Math.max(prim.width, minWidth) / 2) return false;
      if (prim.start === undefined) return true;
      const degrees = (Math.atan2(point[1] - prim.cy, point[0] - prim.cx) * 180) / Math.PI;
      return angleWithin(degrees, prim.start, prim.end ?? prim.start);
    }
    case "line": {
      const half = Math.max(prim.width, minWidth) / 2;
      for (let i = 0; i + 1 < prim.points.length; i++) {
        if (segmentDistance(point, prim.points[i], prim.points[i + 1]) <= half) return true;
      }
      return prim.points.length === 1 && Math.hypot(point[0] - prim.points[0][0], point[1] - prim.points[0][1]) <= half;
    }
  }
}
