import type { Families } from "./glyphs";
import type { Style } from "./svg";

export interface ThemeSpec {
  id: string;
  label: string;
  families: Families;
  style: Style;
}

const RED = "#e5484d";

export const GENERATED_THEMES: ThemeSpec[] = [
  {
    id: "snow",
    label: "Snow",
    families: { arrow: "classic", hand: "classic", text: "classic" },
    style: { fill: "#ffffff", outline: "#1f2328", outlineWidth: 1, accent: RED },
  },
  {
    id: "ink",
    label: "Ink",
    families: { arrow: "sharp", hand: "slim", text: "bar" },
    style: { fill: "#15171a", outline: "#15171a", outlineWidth: 0.5, halo: "#ffffff", haloWidth: 1.1, accent: RED, detail: "#ffffff", lens: "#ffffff" },
  },
  {
    id: "neon",
    label: "Neon",
    families: { arrow: "swept", hand: "slim", text: "caret" },
    style: { fill: "#0b0b14", outline: "#22f7ee", outlineWidth: 1.2, halo: "#22f7ee55", haloWidth: 1.4, accent: "#ff3df2", lens: "#0b0b14" },
  },
  {
    id: "blueprint",
    label: "Blueprint",
    families: { arrow: "dart", hand: "slim", text: "bar" },
    style: { fill: "#0f2a5f", outline: "#8ec5ff", outlineWidth: 1.1, halo: "#0f2a5f66", haloWidth: 0.8, accent: "#ffd166", lens: "#dbeeff" },
  },
  {
    id: "comic",
    label: "Comic",
    families: { arrow: "arrowhead", hand: "glove", text: "classic" },
    style: { fill: "#ffffff", outline: "#111111", outlineWidth: 1.7, accent: RED, join: "round" },
  },
  {
    id: "hologram",
    label: "Hologram",
    families: { arrow: "swept", hand: "soft", text: "caret" },
    style: { fill: ["#a5f3fc", "#f0abfc", "#fde68a"], gradientAngle: 30, outline: "#ffffff", outlineWidth: 1, halo: "#00000059", haloWidth: 0.9, accent: "#ff4f81", lens: "#ffffff" },
  },
  {
    id: "retro",
    label: "Retro",
    families: { arrow: "retro", hand: "classic", text: "classic" },
    style: { fill: "#ffffff", outline: "#000000", outlineWidth: 1, accent: RED, join: "miter", roundness: 0 },
  },
  {
    id: "eightbit",
    label: "8-bit",
    families: { arrow: "classic", hand: "classic", text: "block" },
    style: { fill: "#ffffff", outline: "#000000", outlineWidth: 1, accent: RED, pixel: 4 / 3 },
  },
  {
    id: "terminal",
    label: "Terminal",
    families: { arrow: "sharp", hand: "slim", text: "block" },
    style: { fill: "#000000", outline: "#39ff14", outlineWidth: 1, accent: "#ffb000", lens: "#000000", pixel: 1 },
  },
];
