export const CURSOR_THEMES = [
  { id: "macos_tahoe", label: "macOS Tahoe" },
  { id: "macos_dark", label: "macOS Dark" },
  { id: "mochi", label: "Mochi" },
  { id: "aosp", label: "AOSP" },
  { id: "mocu", label: "Mocu" },
  { id: "kenney", label: "Kenney" },
  { id: "mint", label: "Mint" },
  { id: "snow", label: "Snow" },
  { id: "ink", label: "Ink" },
  { id: "neon", label: "Neon" },
  { id: "blueprint", label: "Blueprint" },
  { id: "comic", label: "Comic" },
  { id: "hologram", label: "Hologram" },
  { id: "retro", label: "Retro" },
  { id: "eightbit", label: "8-bit" },
  { id: "terminal", label: "Terminal" },
] as const;

export type CursorThemeId = (typeof CURSOR_THEMES)[number]["id"];

export const DEFAULT_CURSOR_THEME: CursorThemeId = "macos_tahoe";

export function normalizeCursorTheme(theme: string | undefined): CursorThemeId {
  return CURSOR_THEMES.find(({ id }) => id === theme)?.id ?? DEFAULT_CURSOR_THEME;
}
