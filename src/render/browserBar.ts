import type { BrowserFrameStyle } from "@/shared/settings";
import type { PageVisit } from "@/shared/types";
import type { Rect } from "./geometry";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

type BarStyle = Exclude<BrowserFrameStyle, "off">;

const PALETTES: Record<BarStyle, { bar: string; field: string; host: string; path: string; icon: string; divider: string }> = {
  light: { bar: "#ececee", field: "#ffffff", host: "#1d1d1f", path: "#8a8a8e", icon: "#a1a1a6", divider: "rgba(0,0,0,0.1)" },
  dark: { bar: "#2c2c2e", field: "#1c1c1e", host: "#f5f5f7", path: "#98989d", icon: "#7c7c80", divider: "rgba(0,0,0,0.5)" },
};

const TRAFFIC_LIGHTS = ["#ff5f57", "#febc2e", "#28c840"];
const FONT_FAMILY = `"Inter Variable", Inter, system-ui, sans-serif`;
const FAVICON_SIZE = 64;

export interface BrowserPage {
  t: number;
  url: string;
  favicon: ImageBitmap | null;
}

export function displayUrl(url: string): { host: string; path: string } {
  const parsed = URL.parse(url);
  if (!parsed?.host) return { host: url, path: "" };
  const path = `${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}${parsed.hash}`;
  return { host: parsed.host.replace(/^www\./, ""), path };
}

async function loadFavicon(url: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      return await createImageBitmap(image, { resizeWidth: FAVICON_SIZE, resizeHeight: FAVICON_SIZE, resizeQuality: "high" });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

export class BrowserPages {
  static readonly empty = new BrowserPages([]);

  constructor(private readonly pages: readonly BrowserPage[]) {}

  static async load(visits: readonly PageVisit[]): Promise<BrowserPages> {
    const favicons = new Map<string, Promise<ImageBitmap | null>>();
    const favicon = (url: string) => {
      const loaded = favicons.get(url) ?? loadFavicon(url);
      favicons.set(url, loaded);
      return loaded;
    };
    const pages = await Promise.all(visits.map(async ({ t, url, favIconUrl }) => ({
      t,
      url,
      favicon: favIconUrl ? await favicon(favIconUrl) : null,
    })));
    return new BrowserPages(pages);
  }

  at(time: number): BrowserPage | null {
    let current = this.pages[0] ?? null;
    for (const page of this.pages) {
      if (page.t > time) break;
      current = page;
    }
    return current;
  }
}

export class BrowserBarPainter {
  private fitKey = "";
  private fittedPath = "";

  paint(ctx: Context2D, bar: Rect, page: BrowserPage | null, style: BarStyle) {
    const palette = PALETTES[style];
    const h = bar.height;
    const midY = bar.y + h / 2;

    ctx.save();
    ctx.fillStyle = palette.bar;
    ctx.fillRect(bar.x, bar.y, bar.width, h);
    ctx.fillStyle = palette.divider;
    ctx.fillRect(bar.x, bar.y + h - Math.max(1, h * 0.025), bar.width, Math.max(1, h * 0.025));

    TRAFFIC_LIGHTS.forEach((color, index) => {
      ctx.beginPath();
      ctx.arc(bar.x + h * (0.5 + index * 0.4), midY, h * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
    this.paintChevrons(ctx, bar.x + h * 2.15, midY, h, palette.icon);

    const field = { width: Math.min(bar.width * 0.46, bar.width - h * 6), height: h * 0.64 };
    const fieldX = bar.x + (bar.width - field.width) / 2;
    const fieldY = midY - field.height / 2;
    ctx.beginPath();
    ctx.roundRect(fieldX, fieldY, field.width, field.height, h * 0.2);
    ctx.fillStyle = palette.field;
    ctx.fill();

    if (page) this.paintUrl(ctx, page, { x: fieldX, y: fieldY, ...field }, palette);
    ctx.restore();
  }

  private paintChevrons(ctx: Context2D, x: number, midY: number, h: number, color: string) {
    const size = h * 0.13;
    ctx.strokeStyle = color;
    ctx.lineWidth = h * 0.05;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, midY - size);
    ctx.lineTo(x - size * 0.5, midY);
    ctx.lineTo(x + size * 0.5, midY + size);
    const forward = x + h * 0.55;
    ctx.moveTo(forward - size * 0.5, midY - size);
    ctx.lineTo(forward + size * 0.5, midY);
    ctx.lineTo(forward - size * 0.5, midY + size);
    ctx.stroke();
  }

  private paintUrl(ctx: Context2D, page: BrowserPage, field: Rect, palette: (typeof PALETTES)[BarStyle]) {
    const { host, path } = displayUrl(page.url);
    const fontSize = field.height * 0.46;
    const iconSize = page.favicon ? field.height * 0.5 : 0;
    const gap = page.favicon ? field.height * 0.3 : 0;
    const padding = field.height * 0.5;

    ctx.font = `500 ${fontSize}px ${FONT_FAMILY}`;
    const hostWidth = ctx.measureText(host).width;
    ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
    const shownPath = this.fitPath(ctx, path, field.width - padding * 2 - iconSize - gap - hostWidth);
    const pathWidth = ctx.measureText(shownPath).width;

    let x = field.x + Math.max(padding, (field.width - iconSize - gap - hostWidth - pathWidth) / 2);
    const midY = field.y + field.height / 2;
    if (page.favicon) {
      ctx.drawImage(page.favicon, x, midY - iconSize / 2, iconSize, iconSize);
      x += iconSize + gap;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(field.x, field.y, field.width - padding / 2, field.height);
    ctx.clip();
    ctx.textBaseline = "middle";
    ctx.font = `500 ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = palette.host;
    ctx.fillText(host, x, midY);
    ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = palette.path;
    ctx.fillText(shownPath, x + hostWidth, midY);
    ctx.restore();
  }

  private fitPath(ctx: Context2D, path: string, available: number): string {
    const key = `${ctx.font}|${Math.round(available)}|${path}`;
    if (key === this.fitKey) return this.fittedPath;
    let fitted = path;
    if (ctx.measureText(path).width > available) {
      let length = path.length;
      while (length > 0 && ctx.measureText(`${path.slice(0, length)}…`).width > available) length--;
      fitted = length > 0 ? `${path.slice(0, length)}…` : "";
    }
    this.fitKey = key;
    this.fittedPath = fitted;
    return fitted;
  }
}
