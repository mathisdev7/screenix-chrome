import { arcPath, type Glyph, linePath, type Paint, pointInPrim, type Prim, roundedPolygonPath } from "./geometry";

export interface Style {
  fill: string | string[];
  gradientAngle?: number;
  outline: string;
  outlineWidth: number;
  halo?: string;
  haloWidth?: number;
  accent: string;
  detail?: string;
  lens?: string;
  join?: "round" | "miter" | "bevel";
  roundness?: number;
  opacity?: number;
  pixel?: number;
}

const SIZE = 32;

function paintColor(paint: Paint | undefined, style: Style, fill: string): string {
  switch (paint) {
    case "accent":
      return style.accent;
    case "outline":
      return style.outline;
    case "lens":
      return style.lens ?? "#ffffff";
    default:
      return fill;
  }
}

function gradientDef(style: Style, id: string): { def: string; fill: string } {
  if (typeof style.fill === "string") return { def: "", fill: style.fill };
  const angle = ((style.gradientAngle ?? 45) * Math.PI) / 180;
  const half = SIZE / 2;
  const reach = half * Math.SQRT2 * 0.8;
  const x1 = half - Math.cos(angle) * reach;
  const y1 = half - Math.sin(angle) * reach;
  const x2 = half + Math.cos(angle) * reach;
  const y2 = half + Math.sin(angle) * reach;
  const stops = style.fill
    .map((color, i) => `<stop offset="${(i / (style.fill.length - 1)).toFixed(3)}" stop-color="${color}"/>`)
    .join("");
  const def = `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}">${stops}</linearGradient></defs>`;
  return { def, fill: `url(#${id})` };
}

function geometryOf(prim: Prim, style: Style): { d: string; filled: boolean; width: number } {
  const roundness = style.roundness ?? 1;
  switch (prim.kind) {
    case "poly":
      return { d: roundedPolygonPath(prim.points, (prim.round ?? 0) * roundness, prim.tipRound === undefined ? undefined : prim.tipRound * roundness), filled: true, width: 0 };
    case "circle":
      return { d: arcPath(prim.cx, prim.cy, prim.r, 0, 359.99) + "Z", filled: true, width: 0 };
    case "ring":
      return { d: arcPath(prim.cx, prim.cy, prim.r, prim.start ?? 0, prim.end ?? 359.99), filled: false, width: prim.width };
    case "line":
      return { d: linePath(prim.points), filled: false, width: prim.width };
  }
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

function element(prim: Prim, style: Style, color: string, grow: number, fillInterior: boolean): string {
  const { d, filled, width } = geometryOf(prim, style);
  if (filled) {
    const stroke = grow > 0 ? ` stroke="${color}" stroke-width="${num(grow * 2)}"` : "";
    return `<path d="${d}" fill="${fillInterior ? color : "none"}"${stroke}/>`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(width + grow * 2)}"/>`;
}

function smoothSvg(glyph: Glyph, style: Style, id: string): string {
  const { def, fill } = gradientDef(style, id);
  const shape = glyph.prims.filter((prim) => prim.layer !== "detail");
  const details = glyph.prims.filter((prim) => prim.layer === "detail");
  const layers: string[] = [];
  if (style.halo && style.haloWidth) {
    layers.push(shape.map((prim) => element(prim, style, style.halo!, style.outlineWidth + style.haloWidth!, true)).join(""));
  }
  const body = [
    shape.map((prim) => element(prim, style, style.outline, style.outlineWidth, true)).join(""),
    shape.map((prim) => element(prim, style, paintColor(prim.paint, style, fill), 0, true)).join(""),
    details.map((prim) => element(prim, style, prim.paint ? paintColor(prim.paint, style, fill) : (style.detail ?? style.outline), 0, true)).join(""),
  ].join("");
  layers.push(style.opacity === undefined ? body : `<g opacity="${style.opacity}">${body}</g>`);
  const join = style.join ?? "round";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 ${SIZE} ${SIZE}">${def}<g stroke-linecap="round" stroke-linejoin="${join}">${layers.join("")}</g></svg>`;
}

type Cell = "fill" | "accent" | "lens" | "detail" | "outline" | "halo" | null;

function pixelSvg(glyph: Glyph, style: Style, cell: number, id: string): string {
  const n = Math.round(SIZE / cell);
  const grid: Cell[][] = Array.from({ length: n }, () => Array<Cell>(n).fill(null));
  const shape = glyph.prims.filter((prim) => prim.layer !== "detail");
  const details = glyph.prims.filter((prim) => prim.layer === "detail");
  const minWidth = cell * 1.05;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const point = [(i + 0.5) * cell, (j + 0.5) * cell] as const;
      for (const prim of shape) {
        if (pointInPrim(point, prim, minWidth)) grid[j][i] = prim.paint === "accent" ? "accent" : prim.paint === "lens" ? "lens" : "fill";
      }
      for (const prim of details) {
        if (pointInPrim(point, prim, minWidth)) grid[j][i] = "detail";
      }
    }
  }
  const dilate = (from: Set<Cell>, into: Cell) => {
    const additions: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (grid[j][i] !== null) continue;
        let touches = false;
        for (let dj = -1; dj <= 1 && !touches; dj++) {
          for (let di = -1; di <= 1; di++) {
            const neighbour = grid[j + dj]?.[i + di];
            if (neighbour !== undefined && neighbour !== null && from.has(neighbour)) {
              touches = true;
              break;
            }
          }
        }
        if (touches) additions.push([j, i]);
      }
    }
    for (const [j, i] of additions) grid[j][i] = into;
  };
  dilate(new Set<Cell>(["fill", "accent", "lens", "detail"]), "outline");
  if (style.halo && style.haloWidth) dilate(new Set<Cell>(["outline"]), "halo");

  const { def, fill } = gradientDef(style, id);
  const colors: Record<Exclude<Cell, null>, string> = {
    fill,
    accent: style.accent,
    lens: style.lens ?? "#ffffff",
    detail: style.detail ?? style.outline,
    outline: style.outline,
    halo: style.halo ?? "transparent",
  };
  const paths = (Object.keys(colors) as Exclude<Cell, null>[])
    .map((kind) => {
      let d = "";
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          if (grid[j][i] === kind) d += `M${num(i * cell)} ${num(j * cell)}h${num(cell)}v${num(cell)}h-${num(cell)}z`;
        }
      }
      return d ? `<path d="${d}" fill="${colors[kind]}"/>` : "";
    })
    .join("");
  const body = style.opacity === undefined ? paths : `<g opacity="${style.opacity}">${paths}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">${def}${body}</svg>`;
}

export function renderGlyph(glyph: Glyph, style: Style, gradientId: string): string {
  return style.pixel ? pixelSvg(glyph, style, style.pixel, gradientId) : smoothSvg(glyph, style, gradientId);
}

export function normalizedHotspot(glyph: Glyph): [number, number] {
  const round = (v: number) => Math.round((v / SIZE) * 100000) / 100000;
  return [round(glyph.hotspot[0]), round(glyph.hotspot[1])];
}
