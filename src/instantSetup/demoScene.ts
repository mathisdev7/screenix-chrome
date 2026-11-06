import type { Size } from "@/render/geometry";
import type { CursorShape } from "@/shared/cursorShapes";
import type { PointerSample } from "@/shared/types";

export const DEMO_SOURCE: Size = { width: 1280, height: 800 };
export const DEMO_DURATION = 10;
export const DEMO_URL = "https://app.example.com/projects";

const SAMPLE_RATE = 60;
const CLICK_LENGTH = 0.08;
const FONT = `"Inter Variable", Inter, system-ui, sans-serif`;

interface Stop {
  t: number;
  x: number;
  y: number;
  shape: CursorShape;
  click?: boolean;
}

const STOPS: readonly Stop[] = [
  { t: 0, x: 0.5, y: 0.55, shape: "default" },
  { t: 1, x: 0.42, y: 0.06, shape: "hand", click: true },
  { t: 2.4, x: 0.27, y: 0.82, shape: "hand", click: true },
  { t: 3.6, x: 0.74, y: 0.3, shape: "text", click: true },
  { t: 6.4, x: 0.74, y: 0.3, shape: "text" },
  { t: 7.4, x: 0.86, y: 0.06, shape: "hand", click: true },
  { t: 8.6, x: 0.55, y: 0.58, shape: "default" },
];

const CARDS = [
  { x: 0.06, color: "#7c9cff", title: "Website redesign" },
  { x: 0.37, color: "#f2a65a", title: "Onboarding flow" },
  { x: 0.68, color: "#5cc8a1", title: "Q3 launch video" },
] as const;

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function sample(t: number, x: number, y: number, kind: PointerSample["kind"], shape: CursorShape): PointerSample {
  return { t, x, y, kind, button: 0, shape, tabId: 1 };
}

export function demoPointer(): PointerSample[] {
  const samples = [sample(0, STOPS[0].x, STOPS[0].y, "move", STOPS[0].shape)];
  for (let index = 1; index < STOPS.length; index++) {
    const from = STOPS[index - 1];
    const to = STOPS[index];
    const moving = from.x !== to.x || from.y !== to.y;
    const start = moving ? Math.max(from.t + 0.3, to.t - 0.8) : to.t;
    for (let t = start; moving && t < to.t; t += 1 / SAMPLE_RATE) {
      const progress = smoothstep((t - start) / (to.t - start));
      const shape = progress > 0.85 ? to.shape : from.shape;
      samples.push(sample(t, from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress, "move", shape));
    }
    if (moving) samples.push(sample(to.t, to.x, to.y, "move", to.shape));
    if (to.click) {
      samples.push(sample(to.t + 0.2, to.x, to.y, "down", to.shape));
      samples.push(sample(to.t + 0.2 + CLICK_LENGTH, to.x, to.y, "up", to.shape));
    }
  }
  return samples;
}

function roundRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (!stroke) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function text(ctx: OffscreenCanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

export async function demoPage(): Promise<ImageBitmap> {
  await document.fonts.ready;
  const { width: w, height: h } = DEMO_SOURCE;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the preview page.");

  ctx.fillStyle = "#f5f6f8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, 0.12 * h);
  ctx.fillStyle = "#e3e5ea";
  ctx.fillRect(0, 0.12 * h, w, 1.5);

  roundRect(ctx, 0.03 * w, 0.035 * h, 0.05 * h, 0.05 * h, 8, "#1f2430");
  text(ctx, "Acme", 0.03 * w + 0.065 * h, 0.06 * h, 20, "#1f2430", 700);
  for (const [label, x, active] of [["Overview", 0.3, false], ["Projects", 0.42, true], ["Reports", 0.54, false]] as const) {
    ctx.textAlign = "center";
    text(ctx, label, x * w, 0.06 * h, 16, active ? "#1f2430" : "#7a8090", active ? 600 : 500);
  }
  roundRect(ctx, 0.79 * w, 0.03 * h, 0.14 * w, 0.06 * h, 10, "#3b6cf6");
  text(ctx, "New project", 0.86 * w, 0.06 * h, 16, "#ffffff", 600);
  ctx.textAlign = "left";

  text(ctx, "Projects", 0.06 * w, 0.24 * h, 34, "#1f2430", 700);
  text(ctx, "12 active · updated 2 minutes ago", 0.06 * w, 0.3 * h, 16, "#7a8090");
  roundRect(ctx, 0.62 * w, 0.265 * h, 0.32 * w, 0.07 * h, 10, "#ffffff", "#d9dce3");
  text(ctx, "Search projects", 0.645 * w, 0.3 * h, 16, "#9aa0ad");

  for (const card of CARDS) {
    const x = card.x * w;
    const cardWidth = 0.26 * w;
    roundRect(ctx, x, 0.42 * h, cardWidth, 0.46 * h, 14, "#ffffff", "#e3e5ea");
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, 0.42 * h, cardWidth, 0.46 * h, 14);
    ctx.clip();
    ctx.fillStyle = card.color;
    ctx.fillRect(x, 0.42 * h, cardWidth, 0.2 * h);
    ctx.restore();
    text(ctx, card.title, x + 20, 0.67 * h, 19, "#1f2430", 650);
    roundRect(ctx, x + 20, 0.71 * h, cardWidth * 0.62, 8, 4, "#e6e8ee");
    roundRect(ctx, x + 20, 0.74 * h, cardWidth * 0.42, 8, 4, "#e6e8ee");
    roundRect(ctx, x + cardWidth - 108, 0.79 * h, 88, 0.06 * h, 9, "#eef2ff");
    ctx.textAlign = "center";
    text(ctx, "Open", x + cardWidth - 64, 0.82 * h, 15, "#3b6cf6", 600);
    ctx.textAlign = "left";
  }

  return canvas.transferToImageBitmap();
}
