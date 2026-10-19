import type { ClickEffectStyle } from "@/shared/settings";
import type { Rect } from "../geometry";
import type { ClickEvent } from "./timeline";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const REFERENCE_WIDTH = 1280;

const EFFECT_DURATIONS: Record<Exclude<ClickEffectStyle, "none">, number> = {
  ripple: 0.65,
  highlight: 0.5,
  halo: 0.9,
  burst: 0.45,
};

interface EffectFrame {
  x: number;
  y: number;
  progress: number;
  intensity: number;
  baseSize: number;
  lineScale: number;
}

function drawRipple(ctx: Context2D, { x, y, progress, intensity, baseSize, lineScale }: EffectFrame) {
  const ringCount = 2;
  for (let ring = 0; ring < ringCount; ring++) {
    const delay = ring * 0.3;
    const p = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
    if (p <= 0) continue;
    ctx.beginPath();
    ctx.arc(x, y, baseSize * (0.4 + p * 1.4 + ring * 0.3), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(Math.pow(1 - p, 1.5) * intensity).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, 3 * (1 - p * 0.5)) * lineScale;
    ctx.stroke();
  }
}

function drawHighlight(ctx: Context2D, { x, y, progress, intensity, baseSize }: EffectFrame) {
  const easeOut = 1 - Math.pow(1 - progress, 2);
  const radius = baseSize * (0.3 + easeOut * 1.6);
  const alpha = Math.pow(1 - progress, 1.2) * intensity * 0.9;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(255,245,180,${(alpha * 0.9).toFixed(3)})`);
  gradient.addColorStop(0.45, `rgba(255,220,100,${(alpha * 0.45).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(255,200,50,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawHalo(ctx: Context2D, { x, y, progress, intensity, baseSize }: EffectFrame) {
  const alpha = Math.min(1, progress * 4) * Math.pow(1 - progress, 0.8) * intensity * 0.7;
  const radius = baseSize * (0.7 + progress * 0.6);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(255,255,255,${(alpha * 0.55).toFixed(3)})`);
  gradient.addColorStop(0.45, `rgba(190,215,255,${(alpha * 0.35).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(140,180,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBurst(ctx: Context2D, { x, y, progress, intensity, baseSize, lineScale }: EffectFrame) {
  const rayCount = 8;
  const easeOut = 1 - Math.pow(1 - progress, 2);
  const innerRadius = baseSize * (0.25 + easeOut * 0.25);
  const outerRadius = baseSize * (0.5 + easeOut * 2);
  ctx.strokeStyle = `rgba(255,240,150,${(Math.pow(1 - progress, 1.5) * intensity).toFixed(3)})`;
  ctx.lineWidth = Math.max(1, 2.5 * (1 - progress * 0.7)) * lineScale;
  ctx.lineCap = "round";
  for (let ray = 0; ray < rayCount; ray++) {
    const angle = (ray / rayCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * innerRadius, y + Math.sin(angle) * innerRadius);
    ctx.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius);
    ctx.stroke();
  }
}

const PAINTERS: Record<Exclude<ClickEffectStyle, "none">, (ctx: Context2D, frame: EffectFrame) => void> = {
  ripple: drawRipple,
  highlight: drawHighlight,
  halo: drawHalo,
  burst: drawBurst,
};

export function drawClickEffects(
  ctx: Context2D,
  clicks: readonly ClickEvent[],
  time: number,
  style: ClickEffectStyle,
  intensity: number,
  area: Rect,
) {
  if (style === "none" || intensity <= 0) return;
  const duration = EFFECT_DURATIONS[style];
  const paint = PAINTERS[style];
  const baseSize = Math.min(area.width, area.height) * 0.045;
  const lineScale = area.width / REFERENCE_WIDTH;

  for (let i = clicks.length - 1; i >= 0; i--) {
    const click = clicks[i];
    if (click.kind === "up" || click.t > time) continue;
    const elapsed = time - click.t;
    if (elapsed >= duration) break;
    paint(ctx, {
      x: area.x + click.x * area.width,
      y: area.y + click.y * area.height,
      progress: elapsed / duration,
      intensity,
      baseSize,
      lineScale,
    });
  }
}
