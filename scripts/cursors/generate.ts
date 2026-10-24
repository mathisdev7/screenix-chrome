import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CURSOR_SHAPES, type CursorShape } from "../../src/shared/cursorShapes";
import { buildGlyph } from "./glyphs";
import { normalizedHotspot, renderGlyph } from "./svg";
import { GENERATED_THEMES, type ThemeSpec } from "./themes";

const ROOT = join(import.meta.dir, "../..");
const THEMES_DIR = join(ROOT, "public/cursors/themes");
const HOTSPOTS_PATH = join(ROOT, "src/render/cursor/themeHotspots.json");

type HotspotTable = Record<string, Record<string, [number, number]>>;

function renderTheme(theme: ThemeSpec): { svgs: Record<CursorShape, string>; hotspots: Record<CursorShape, [number, number]> } {
  const svgs = {} as Record<CursorShape, string>;
  const hotspots = {} as Record<CursorShape, [number, number]>;
  for (const shape of CURSOR_SHAPES) {
    const glyph = buildGlyph(shape, theme.families);
    svgs[shape] = renderGlyph(glyph, theme.style, `g-${theme.id}`);
    hotspots[shape] = normalizedHotspot(glyph);
  }
  return { svgs, hotspots };
}

function writeThemes(): Map<string, Record<CursorShape, string>> {
  const table = JSON.parse(readFileSync(HOTSPOTS_PATH, "utf8")) as HotspotTable;
  const rendered = new Map<string, Record<CursorShape, string>>();
  for (const theme of GENERATED_THEMES) {
    const { svgs, hotspots } = renderTheme(theme);
    const dir = join(THEMES_DIR, theme.id);
    mkdirSync(dir, { recursive: true });
    for (const shape of CURSOR_SHAPES) writeFileSync(join(dir, `${shape}.svg`), `${svgs[shape]}\n`);
    table[theme.id] = hotspots;
    rendered.set(theme.id, svgs);
  }
  writeFileSync(HOTSPOTS_PATH, `${JSON.stringify(table, null, 2)}\n`);
  return rendered;
}

const BACKGROUNDS = [
  { name: "light", css: "#f4f4f5" },
  { name: "dark", css: "#18181b" },
  { name: "wallpaper", css: "linear-gradient(135deg,#f97316,#db2777 45%,#4f46e5)" },
  { name: "page", css: "repeating-linear-gradient(0deg,#fff 0 14px,#e5e7eb 14px 15px)" },
];

const HERO_SHAPES: CursorShape[] = ["default", "hand", "text", "grab"];

function gallery(rendered: Map<string, Record<CursorShape, string>>): string {
  const rows = GENERATED_THEMES.map((theme) => {
    const svgs = rendered.get(theme.id)!;
    const hero = BACKGROUNDS.map(
      ({ css }) => `<div class="hero" style="background:${css}">${HERO_SHAPES.map((shape) => `<span class="big">${svgs[shape]}</span>`).join("")}</div>`,
    ).join("");
    const all = CURSOR_SHAPES.map((shape) => `<span class="small" title="${shape}">${svgs[shape]}</span>`).join("");
    return `<section><h2>${theme.label} <code>${theme.id}</code> <small>${theme.families.arrow} · ${theme.families.hand} hand · ${theme.families.text} beam${theme.style.pixel ? ` · pixel ${theme.style.pixel}` : ""}</small></h2><div class="heroes">${hero}</div><div class="all">${all}</div></section>`;
  });
  return `<!doctype html><meta charset="utf-8"><title>Cursor themes</title><style>
body{font:14px/1.4 system-ui,sans-serif;margin:0;padding:24px;background:#fafafa;color:#111}
h2{font-size:16px;margin:28px 0 8px}code{font-size:12px;color:#666}small{font-weight:400;color:#999;margin-left:8px}
.heroes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.hero{display:flex;gap:4px;align-items:center;justify-content:center;padding:8px;border-radius:10px;min-width:0}
.big svg{width:56px;height:56px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
.all{display:flex;flex-wrap:wrap;gap:2px;margin-top:6px;padding:6px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}
.small svg{width:40px;height:40px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
</style>${rows.join("")}`;
}

function detailPage(rendered: Map<string, Record<CursorShape, string>>): string {
  const sections = GENERATED_THEMES.map((theme) => {
    const svgs = rendered.get(theme.id)!;
    const sprites = CURSOR_SHAPES.map((shape) => `<figure><span>${svgs[shape]}</span><figcaption>${shape}</figcaption></figure>`).join("");
    return `<section id="${theme.id}"><h2>${theme.label}</h2><div class="grid">${sprites}</div></section>`;
  });
  return `<!doctype html><meta charset="utf-8"><title>Cursor theme detail</title><style>
body{font:12px system-ui,sans-serif;margin:0;padding:16px;background:#e4e4e7;color:#111}
section{display:none}section:target{display:block}h2{margin:0 0 8px}
.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
figure{margin:0;text-align:center}figure span svg{width:104px;height:104px;background:#fff;border-radius:6px}
figcaption{color:#555}
</style>${sections.join("")}`;
}

const rendered = writeThemes();
const galleryPath = process.argv[2];
if (galleryPath) {
  writeFileSync(galleryPath, gallery(rendered));
  writeFileSync(galleryPath.replace(/\.html$/, "-detail.html"), detailPage(rendered));
}
console.log(`Generated ${GENERATED_THEMES.length} themes × ${CURSOR_SHAPES.length} sprites${galleryPath ? `, gallery at ${galleryPath}` : ""}`);
