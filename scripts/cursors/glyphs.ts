import type { CursorShape } from "../../src/shared/cursorShapes";
import { arcPoints, type Glyph, type Point, type Prim, rotateGlyph, rotate, scale, translate } from "./geometry";

export type ArrowFamily = "classic" | "needle" | "sharp" | "blob" | "dart" | "arrowhead" | "retro" | "swept" | "stubby" | "triangle";
export type HandFamily = "classic" | "slim" | "glove" | "soft";
export type TextFamily = "classic" | "bar" | "serif" | "curly" | "caret" | "block";

export interface Families {
  arrow: ArrowFamily;
  hand: HandFamily;
  text: TextFamily;
}

interface ArrowSpec {
  points: Point[];
  round: number;
  tipRound: number;
}

function quadratic(from: Point, control: Point, to: Point, steps: number): Point[] {
  const points: Point[] = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const k = (1 - t) ** 2;
    const m = 2 * (1 - t) * t;
    const n = t * t;
    points.push([k * from[0] + m * control[0] + n * to[0], k * from[1] + m * control[1] + n * to[1]]);
  }
  return points;
}

const ARROWS: Record<ArrowFamily, ArrowSpec> = {
  classic: { points: [[0, 0], [0, 16.4], [4.3, 12.6], [7.4, 19.6], [10.3, 18.3], [7.2, 11.4], [12.8, 11.4]], round: 0.6, tipRound: 0.4 },
  needle: { points: [[0, 0], [0, 19], [4.1, 15], [6.6, 21.2], [8.9, 20.2], [6.4, 14], [10.6, 13.6]], round: 0.5, tipRound: 0.3 },
  sharp: { points: [[0, 0], [0, 19.6], [4.9, 15.2], [8.3, 22.4], [11.3, 21], [7.9, 14], [14, 14]], round: 0.3, tipRound: 0.2 },
  blob: { points: [[0, 0], [0, 17], [4.6, 13.4], [7.6, 20.2], [11.2, 18.6], [8.2, 12], [13.4, 12]], round: 2.2, tipRound: 1.4 },
  dart: { points: [[0, 0], [0, 18.4], [4.6, 13.9], [13.4, 13.2]], round: 0.5, tipRound: 0.3 },
  arrowhead: { points: [[0, 0], [8.2, 13.2], [3.1, 10.9], [-2.1, 16.8]], round: 0.5, tipRound: 0.3 },
  retro: { points: [[0, 0], [0, 15], [3.6, 11.5], [6.6, 18], [9.6, 16.6], [6.6, 10.5], [11.2, 10.5]], round: 0, tipRound: 0 },
  swept: {
    points: [[0, 0], [0, 17.6], [4.4, 13.4], [7.6, 20.4], [10.4, 19.1], [7.3, 12.2], [13.2, 12.2], ...quadratic([13.2, 12.2], [4.4, 7.4], [0, 0], 7)],
    round: 0.4,
    tipRound: 0.3,
  },
  stubby: { points: [[0, 0], [0, 13.6], [3.5, 10.8], [5.8, 16], [9, 14.6], [6.7, 9.6], [10.6, 9.6]], round: 1.3, tipRound: 0.8 },
  triangle: { points: [[0, 0], [0, 17], [12, 12.4]], round: 0.9, tipRound: 0.5 },
};

function arrow(family: ArrowFamily, tip: Point): Prim[] {
  const spec = ARROWS[family];
  const prims: Prim[] = [{ kind: "poly", points: spec.points, round: spec.round, tipRound: spec.tipRound }];
  const placed = family === "arrowhead" ? rotate(prims, -30, [0, 0]) : prims;
  return translate(placed, tip[0], tip[1]);
}

function arrowWithBadge(family: ArrowFamily, badge: Prim[]): Glyph {
  const tip: Point = [5, 3.5];
  return { prims: [...arrow(family, tip), ...badge], hotspot: tip };
}

const BADGE: Point = [22.5, 23];
const BADGE_R = 6.4;

function badge(details: Prim[]): Prim[] {
  return [{ kind: "circle", cx: BADGE[0], cy: BADGE[1], r: BADGE_R }, ...details.map((prim) => ({ layer: "detail" as const, ...prim }))];
}

const [bx, by] = BADGE;

const CONTEXT_MENU = badge([
  { kind: "line", points: [[bx - 3, by - 2.6], [bx + 3, by - 2.6]], width: 1.4 },
  { kind: "line", points: [[bx - 3, by], [bx + 3, by]], width: 1.4 },
  { kind: "line", points: [[bx - 3, by + 2.6], [bx + 3, by + 2.6]], width: 1.4 },
]);

const HELP = badge([
  { kind: "line", points: [...arcPoints(bx, by - 1.6, 2.2, -160, 90, 10), [bx, by + 2]], width: 1.5 },
  { kind: "circle", cx: bx, cy: by + 4.1, r: 0.95 },
]);

const COPY = badge([
  { kind: "line", points: [[bx - 3.2, by], [bx + 3.2, by]], width: 1.6 },
  { kind: "line", points: [[bx, by - 3.2], [bx, by + 3.2]], width: 1.6 },
]);

const ALIAS = badge([
  { kind: "line", points: [[bx - 2.8, by + 3], [bx + 2.6, by - 2.4]], width: 1.5 },
  { kind: "line", points: [[bx - 1.2, by - 2.6], [bx + 2.8, by - 2.6], [bx + 2.8, by + 1.4]], width: 1.5 },
]);

const PROGRESS = badge([{ kind: "ring", cx: bx, cy: by, r: 3.2, width: 1.7, start: -90, end: 180, paint: "accent" }]);

function notAllowed(cx: number, cy: number, r: number, width: number): Prim[] {
  const k = r * 0.68;
  return [
    { kind: "ring", cx, cy, r, width, paint: "accent" },
    { kind: "line", points: [[cx - k, cy - k], [cx + k, cy + k]], width, paint: "accent" },
  ];
}

interface HandSpec {
  fingerWidth: number;
  spacing: number;
  tops: number[];
  grabTops: number[];
  scale: number;
}

const HANDS: Record<Exclude<HandFamily, "soft">, HandSpec> = {
  classic: { fingerWidth: 3.7, spacing: 4, tops: [2.2, 5.2, 6.8, 9.8], grabTops: [5.6, 4.2, 4.4, 6], scale: 0.86 },
  slim: { fingerWidth: 2.7, spacing: 3.3, tops: [1, 3.6, 5, 8.6], grabTops: [5.6, 4, 4.2, 6.2], scale: 0.88 },
  glove: { fingerWidth: 5.3, spacing: 5.6, tops: [2.4, 5.2, 8.4], grabTops: [5.2, 4, 5.4], scale: 0.78 },
};

function fingers(spec: HandSpec, tops: number[], bottom: number, first: number): Prim[] {
  return tops.map((top, i) => ({ kind: "line", points: [[first + i * spec.spacing, top], [first + i * spec.spacing, bottom]], width: spec.fingerWidth - (i === tops.length - 1 ? 0.3 : 0) }));
}

function palm(left: number, right: number, top: number, bottom: number, round: number): Prim {
  const slope = (right - left) * 0.22;
  return { kind: "poly", points: [[left, top], [right, top], [right, bottom - 5.4], [right - slope, bottom], [left + slope, bottom], [left, bottom - 4.6]], round };
}

function hand(family: HandFamily): Glyph {
  if (family === "soft") {
    const prims: Prim[] = [
      { kind: "line", points: [[6, 1.6], [6, 12]], width: 4.4 },
      { kind: "poly", points: [[8.4, 8.2], [19.4, 8.2], [19.4, 18.6], [15.6, 24], [7, 24], [3.8, 20.2], [3.8, 12]], round: 4.2 },
      { kind: "line", points: [[0.6, 12.6], [5, 18]], width: 4.4 },
      { kind: "line", layer: "detail", points: [[11.4, 8.6], [11.4, 12.8]], width: 1 },
      { kind: "line", layer: "detail", points: [[15.2, 8.6], [15.2, 13.2]], width: 1 },
    ];
    return { prims: translate(scale(prims, 0.86), 10, 5), hotspot: [10 + 6 * 0.86, 5 + 0.3] };
  }
  const spec = HANDS[family];
  const first = 6;
  const last = first + (spec.tops.length - 1) * spec.spacing;
  const half = spec.fingerWidth / 2;
  const prims: Prim[] = [
    ...fingers(spec, spec.tops, 12, first),
    palm(first - half, last + half, 12, 23.4, 3),
    { kind: "line", points: [[first - half - 3.4, 12.4], [first - half + 1.2, 17.8]], width: spec.fingerWidth + 0.1 },
  ];
  const tipY = spec.tops[0] - half;
  return { prims: translate(scale(prims, spec.scale), 10, 5), hotspot: [10 + first * spec.scale, 5 + tipY * spec.scale] };
}

function grab(family: HandFamily): Glyph {
  if (family === "soft") {
    const prims: Prim[] = [
      { kind: "poly", points: [[4, 6.6], [18.6, 6.6], [18.6, 17], [15, 22], [6.6, 22], [3.4, 18], [3.4, 10]], round: 4.4 },
      { kind: "line", points: [[0.6, 11.6], [4.6, 16.8]], width: 4.2 },
      { kind: "line", layer: "detail", points: [[8, 7], [8, 11.4]], width: 1 },
      { kind: "line", layer: "detail", points: [[11.6, 7], [11.6, 11.8]], width: 1 },
      { kind: "line", layer: "detail", points: [[15.2, 7], [15.2, 11.4]], width: 1 },
    ];
    return { prims: translate(scale(prims, 0.86), 7.4, 6.6), hotspot: [16, 16] };
  }
  const spec = HANDS[family];
  const first = 5;
  const last = first + (spec.grabTops.length - 1) * spec.spacing;
  const half = spec.fingerWidth / 2;
  const prims: Prim[] = [
    ...fingers(spec, spec.grabTops, 10, first),
    palm(first - half, last + half, 10, 22, 3.5),
    { kind: "line", points: [[first - half - 3, 11.4], [first - half + 1.2, 16.6]], width: spec.fingerWidth + 0.1 },
  ];
  return { prims: translate(scale(prims, spec.scale), 7.4, 6), hotspot: [16, 16] };
}

function grabbing(family: HandFamily): Glyph {
  const knuckleCount = family === "glove" ? 3 : 4;
  const spacing = family === "glove" ? 5.4 : family === "slim" ? 3.4 : 4;
  const radius = family === "glove" ? 3.2 : family === "slim" ? 2.1 : 2.6;
  const left = 2.8;
  const right = left + 2.6 + (knuckleCount - 1) * spacing + 2.6 + (family === "glove" ? 1 : 0);
  const prims: Prim[] = [];
  for (let i = 0; i < knuckleCount; i++) {
    const edge = i === 0 || i === knuckleCount - 1;
    prims.push({ kind: "circle", cx: left + 2.6 + i * spacing, cy: edge ? 9.4 : 8.3, r: radius });
  }
  prims.push(
    { kind: "poly", points: [[left, 10], [right, 10], [right, 18], [right - 3.7, 23.6], [left + 4, 23.6], [left, 18.8]], round: 4 },
    { kind: "line", points: [[left - 1.2, 13.2], [left + 2.2, 17.2]], width: 3.6 },
    { kind: "line", layer: "detail", points: [[left + 0.6, 11.9], [left + 3.4, 15.4], [left + 8.6, 15.6]], width: 1.1 },
  );
  const factor = family === "glove" ? 0.8 : 0.86;
  return { prims: translate(scale(prims, factor), 16 - ((left + right) / 2) * factor, 6.8), hotspot: [16, 16] };
}

function iBeam(family: TextFamily): Glyph {
  const stem = (width: number): Prim => ({ kind: "line", points: [[16, 7], [16, 25]], width });
  const serif = (y: number, reach: number, width: number): Prim => ({ kind: "line", points: [[16 - reach, y], [16 + reach, y]], width });
  let prims: Prim[];
  switch (family) {
    case "classic":
      prims = [stem(2.2), serif(7, 3.2, 2.2), serif(25, 3.2, 2.2)];
      break;
    case "bar":
      prims = [stem(2.8)];
      break;
    case "serif":
      prims = [stem(1.7), serif(7, 4.2, 1.7), serif(25, 4.2, 1.7)];
      break;
    case "curly":
      prims = [
        stem(2),
        { kind: "line", points: [[12.4, 8.8], [13.2, 7.3], [16, 7], [18.8, 7.3], [19.6, 8.8]], width: 2 },
        { kind: "line", points: [[12.4, 23.2], [13.2, 24.7], [16, 25], [18.8, 24.7], [19.6, 23.2]], width: 2 },
      ];
      break;
    case "caret":
      prims = [stem(1.6), { kind: "circle", cx: 16, cy: 7.4, r: 1.9 }, { kind: "circle", cx: 16, cy: 24.6, r: 1.9 }];
      break;
    case "block":
      prims = [{ kind: "poly", points: [[12.4, 7], [19.6, 7], [19.6, 25], [12.4, 25]], round: 0.8 }];
      break;
  }
  return { prims, hotspot: [16, 16] };
}

function cross(width: number, reach: number): Prim[] {
  return [
    { kind: "line", points: [[16, 16 - reach], [16, 16 + reach]], width },
    { kind: "line", points: [[16 - reach, 16], [16 + reach, 16]], width },
  ];
}

function head(tip: Point, length: number, halfWidth: number, direction: Point): Prim {
  const [dx, dy] = direction;
  const [tx, ty] = tip;
  const baseX = tx - dx * length;
  const baseY = ty - dy * length;
  return { kind: "poly", points: [tip, [baseX - dy * halfWidth, baseY + dx * halfWidth], [baseX + dy * halfWidth, baseY - dx * halfWidth]], round: 0.3 };
}

function fourWay(dot: boolean): Glyph {
  const prims: Prim[] = [
    ...cross(2.4, 9),
    head([16, 4.5], 5, 4.4, [0, -1]),
    head([16, 27.5], 5, 4.4, [0, 1]),
    head([4.5, 16], 5, 4.4, [-1, 0]),
    head([27.5, 16], 5, 4.4, [1, 0]),
  ];
  if (dot) prims.push({ kind: "circle", cx: 16, cy: 16, r: 2.1, layer: "detail" });
  return { prims, hotspot: [16, 16] };
}

function doubleArrow(): Glyph {
  return {
    prims: [
      { kind: "line", points: [[8, 16], [24, 16]], width: 2.5 },
      head([27.5, 16], 5.5, 4.8, [1, 0]),
      head([4.5, 16], 5.5, 4.8, [-1, 0]),
    ],
    hotspot: [16, 16],
  };
}

function singleArrow(): Glyph {
  return {
    prims: [
      { kind: "line", points: [[16, 10], [16, 25.5]], width: 2.6 },
      head([16, 5], 6, 5.4, [0, -1]),
    ],
    hotspot: [16, 5],
  };
}

function splitArrow(): Glyph {
  return {
    prims: [
      { kind: "line", points: [[16, 8.5], [16, 23.5]], width: 2.4 },
      { kind: "line", points: [[12, 16], [9, 16]], width: 2.2 },
      { kind: "line", points: [[20, 16], [23, 16]], width: 2.2 },
      head([4.3, 16], 4.6, 3.9, [-1, 0]),
      head([27.7, 16], 4.6, 3.9, [1, 0]),
    ],
    hotspot: [16, 16],
  };
}

function magnifier(plus: boolean): Glyph {
  const details: Prim[] = [{ kind: "line", layer: "detail", paint: "outline", points: [[10.6, 14], [17.4, 14]], width: 1.8 }];
  if (plus) details.push({ kind: "line", layer: "detail", paint: "outline", points: [[14, 10.6], [14, 17.4]], width: 1.8 });
  return {
    prims: [
      { kind: "circle", cx: 14, cy: 14, r: 7, paint: "lens" },
      { kind: "ring", cx: 14, cy: 14, r: 7, width: 2.4 },
      { kind: "line", points: [[19.4, 19.4], [26, 26]], width: 3.2 },
      ...details,
    ],
    hotspot: [14, 14],
  };
}

function spinner(): Glyph {
  const prims: Prim[] = [];
  for (let i = 0; i < 8; i++) {
    const a = ((i * 45 - 90) * Math.PI) / 180;
    prims.push({ kind: "circle", cx: 16 + 8.4 * Math.cos(a), cy: 16 + 8.4 * Math.sin(a), r: 1.3 + i * 0.24, paint: i >= 6 ? "accent" : "fill" });
  }
  return { prims, hotspot: [16, 16] };
}

const RESIZE_ANGLES = {
  "n-resize": 0,
  "ne-resize": 45,
  "e-resize": 90,
  "se-resize": 135,
  "s-resize": 180,
  "sw-resize": 225,
  "w-resize": 270,
  "nw-resize": 315,
} as const;

export function buildGlyph(shape: CursorShape, families: Families): Glyph {
  const family = families.arrow;
  switch (shape) {
    case "n-resize":
    case "ne-resize":
    case "e-resize":
    case "se-resize":
    case "s-resize":
    case "sw-resize":
    case "w-resize":
    case "nw-resize":
      return rotateGlyph(singleArrow(), RESIZE_ANGLES[shape]);
    case "default": {
      const tip: Point = [10, 6];
      return { prims: arrow(family, tip), hotspot: tip };
    }
    case "context-menu":
      return arrowWithBadge(family, CONTEXT_MENU);
    case "help":
      return arrowWithBadge(family, HELP);
    case "progress":
      return arrowWithBadge(family, PROGRESS);
    case "alias":
      return arrowWithBadge(family, ALIAS);
    case "copy":
      return arrowWithBadge(family, COPY);
    case "no-drop":
      return arrowWithBadge(family, notAllowed(22.5, 23, 5.4, 2.1));
    case "not-allowed":
      return { prims: notAllowed(16, 16, 9.4, 2.8), hotspot: [16, 16] };
    case "hand":
      return hand(families.hand);
    case "grab":
      return grab(families.hand);
    case "grabbing":
      return grabbing(families.hand);
    case "text":
      return iBeam(families.text);
    case "vertical-text":
      return rotateGlyph(iBeam(families.text), 90);
    case "crosshair":
      return { prims: cross(2, 9.5), hotspot: [16, 16] };
    case "cell":
      return { prims: cross(3.4, 8), hotspot: [16, 16] };
    case "move":
      return fourWay(false);
    case "all-scroll":
      return fourWay(true);
    case "ew-resize":
      return doubleArrow();
    case "ns-resize":
      return rotateGlyph(doubleArrow(), 90);
    case "nwse-resize":
      return rotateGlyph(doubleArrow(), 45);
    case "nesw-resize":
      return rotateGlyph(doubleArrow(), -45);
    case "col-resize":
      return splitArrow();
    case "row-resize":
      return rotateGlyph(splitArrow(), 90);
    case "zoom-in":
      return magnifier(true);
    case "zoom-out":
      return magnifier(false);
    case "wait":
      return spinner();
  }
}
