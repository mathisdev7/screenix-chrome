import { normalizeCursorTheme, type CursorThemeId } from "./cursorThemes";
import {
  createDefaultSettings,
  DEFAULT_BACKGROUND_SETTINGS,
  DEFAULT_CAMERA_SETTINGS,
  DEFAULT_CURSOR_SETTINGS,
  type BrowserFrameStyle,
  type ClickEffectStyle,
  type EditorSettings,
} from "./settings";
import type { ProjectId } from "./types";

export type RecordingMode = "studio" | "instant";

export type InstantLook = "full" | "framed";

export interface InstantStyle {
  cursorTheme: CursorThemeId;
  cursorSize: number;
  clickEffect: ClickEffectStyle;
  hideCursorWhenIdle: boolean;
  wallpaper: string | null;
  browserFrame: BrowserFrameStyle;
  cameraSize: number;
  cameraMirror: boolean;
}

export const DEFAULT_INSTANT_STYLE: InstantStyle = {
  cursorTheme: DEFAULT_CURSOR_SETTINGS.theme,
  cursorSize: DEFAULT_CURSOR_SETTINGS.size,
  clickEffect: DEFAULT_CURSOR_SETTINGS.clickEffect,
  hideCursorWhenIdle: DEFAULT_CURSOR_SETTINGS.hideWhenIdle,
  wallpaper: DEFAULT_BACKGROUND_SETTINGS.wallpaper,
  browserFrame: DEFAULT_BACKGROUND_SETTINGS.browserFrame,
  cameraSize: DEFAULT_CAMERA_SETTINGS.size,
  cameraMirror: DEFAULT_CAMERA_SETTINGS.mirror,
};

export function normalizeInstantStyle(style: Partial<InstantStyle> | undefined): InstantStyle {
  return { ...DEFAULT_INSTANT_STYLE, ...style, cursorTheme: normalizeCursorTheme(style?.cursorTheme) };
}

export const INSTANT_HIDPI_LONG_SIDE = 1920;

export const INSTANT_VIDEO_ASSET_KEY = "instant-video";
export const INSTANT_POSTER_ASSET_KEY = "instant-poster";

export type InstantStatus =
  | { projectId: ProjectId; state: "rendering"; progress: number }
  | { projectId: ProjectId; state: "ready" }
  | { projectId: ProjectId; state: "failed"; error: string };

export const INSTANT_STATUS_KEY = "instantStatus";

export function instantSettings(look: InstantLook, style: InstantStyle): EditorSettings {
  const settings = createDefaultSettings();
  return {
    ...settings,
    cursor: {
      ...settings.cursor,
      theme: style.cursorTheme,
      size: style.cursorSize,
      clickEffect: style.clickEffect,
      hideWhenIdle: style.hideCursorWhenIdle,
    },
    background: { ...settings.background, enabled: look === "framed", wallpaper: style.wallpaper, browserFrame: style.browserFrame },
    camera: { ...settings.camera, size: style.cameraSize, mirror: style.cameraMirror },
  };
}

export async function readInstantStatus(): Promise<InstantStatus | null> {
  const stored = await chrome.storage.session.get(INSTANT_STATUS_KEY);
  return (stored[INSTANT_STATUS_KEY] as InstantStatus | undefined) ?? null;
}

export async function writeInstantStatus(status: InstantStatus): Promise<void> {
  await chrome.storage.session.set({ [INSTANT_STATUS_KEY]: status });
}
