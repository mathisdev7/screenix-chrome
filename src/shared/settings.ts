import { DEFAULT_CURSOR_THEME, normalizeCursorTheme, type CursorThemeId } from "./cursorThemes";

export type ClickEffectStyle = "none" | "ripple" | "highlight" | "halo" | "burst";

export type BackgroundKind = "image" | "color" | "gradient";

export type BrowserFrameStyle = "off" | "light" | "dark";

export type AspectRatioId = "source" | "16:9" | "9:16" | "1:1" | "4:5" | "4:3";

export interface CursorSettings {
  theme: CursorThemeId;
  size: number;
  shadow: number;
  speed: number;
  sway: number;
  motionBlur: number;
  clickEffect: ClickEffectStyle;
  clickEffectIntensity: number;
  hideWhenIdle: boolean;
  idleTimeout: number;
  lockType: boolean;
}

export interface BackgroundSettings {
  enabled: boolean;
  kind: BackgroundKind;
  wallpaper: string | null;
  color: string;
  gradientEndColor: string;
  gradientAngle: number;
  squircle: boolean;
  screenScale: number;
  cornerRadius: number;
  shadowBlur: number;
  glassBorderWidth: number;
  glassBorderOpacity: number;
  zoomInsideFrame: boolean;
  browserFrame: BrowserFrameStyle;
}

export interface CameraSettings {
  enabled: boolean;
  x: number;
  y: number;
  size: number;
  roundness: number;
  squircle: boolean;
  shadow: number;
  mirror: boolean;
  glassBorder: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AudioSettings {
  microphoneVolume: number;
  tabVolume: number;
}

export interface TrimRange {
  start: number;
  end: number | null;
}

export interface SpeedClip {
  id: string;
  start: number;
  end: number;
  rate: number;
}

export type ZoomMode = "auto" | "manual";

export interface ZoomClip {
  id: string;
  start: number;
  end: number;
  scale: number;
  mode: ZoomMode;
  centerX: number;
  centerY: number;
  zoomIn: number;
  zoomOut: number;
}

export interface EditorSettings {
  cursor: CursorSettings;
  background: BackgroundSettings;
  camera: CameraSettings;
  audio: AudioSettings;
  aspectRatio: AspectRatioId;
  crop: CropRect;
  trim: TrimRange;
  speed: SpeedClip[];
  zoom: ZoomClip[];
}

export const DEFAULT_CURSOR_SETTINGS: CursorSettings = {
  theme: DEFAULT_CURSOR_THEME,
  size: 6.5,
  shadow: 0.6,
  speed: 0.5,
  sway: 0.3,
  motionBlur: 0.5,
  clickEffect: "none",
  clickEffectIntensity: 0.5,
  hideWhenIdle: false,
  idleTimeout: 0.5,
  lockType: false,
};

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  enabled: true,
  kind: "image",
  wallpaper: "builtin:MacBook Pro Dark",
  color: "#1a1a1a",
  gradientEndColor: "#000000",
  gradientAngle: 135,
  squircle: true,
  screenScale: 0.85,
  cornerRadius: 28,
  shadowBlur: 40,
  glassBorderWidth: 0,
  glassBorderOpacity: 0.18,
  zoomInsideFrame: false,
  browserFrame: "off",
};

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  enabled: true,
  x: 1,
  y: 1,
  size: 0.24,
  roundness: 0.45,
  squircle: true,
  shadow: 1,
  mirror: true,
  glassBorder: 0,
};

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  microphoneVolume: 1,
  tabVolume: 1,
};

export function createDefaultSettings(): EditorSettings {
  return {
    cursor: { ...DEFAULT_CURSOR_SETTINGS },
    background: { ...DEFAULT_BACKGROUND_SETTINGS },
    camera: { ...DEFAULT_CAMERA_SETTINGS },
    audio: { ...DEFAULT_AUDIO_SETTINGS },
    aspectRatio: "source",
    crop: { ...FULL_CROP },
    trim: { start: 0, end: null },
    speed: [],
    zoom: [],
  };
}

export function withDefaults(settings: Partial<EditorSettings> | null | undefined): EditorSettings {
  const defaults = createDefaultSettings();
  return {
    cursor: { ...defaults.cursor, ...settings?.cursor, theme: normalizeCursorTheme(settings?.cursor?.theme) },
    background: { ...defaults.background, ...settings?.background },
    camera: { ...defaults.camera, ...settings?.camera },
    audio: { ...defaults.audio, ...settings?.audio },
    aspectRatio: settings?.aspectRatio ?? defaults.aspectRatio,
    crop: { ...defaults.crop, ...settings?.crop },
    trim: { ...defaults.trim, ...settings?.trim },
    speed: Array.isArray(settings?.speed) ? settings.speed : defaults.speed,
    zoom: Array.isArray(settings?.zoom) ? settings.zoom : defaults.zoom,
  };
}

export interface SettingsPatch {
  cursor?: Partial<CursorSettings>;
  background?: Partial<BackgroundSettings>;
  camera?: Partial<CameraSettings>;
  audio?: Partial<AudioSettings>;
  aspectRatio?: AspectRatioId;
  crop?: CropRect;
  trim?: Partial<TrimRange>;
  speed?: SpeedClip[];
  zoom?: ZoomClip[];
}

export function applySettingsPatch(settings: EditorSettings, patch: SettingsPatch): EditorSettings {
  return {
    cursor: patch.cursor ? { ...settings.cursor, ...patch.cursor } : settings.cursor,
    background: patch.background ? { ...settings.background, ...patch.background } : settings.background,
    camera: patch.camera ? { ...settings.camera, ...patch.camera } : settings.camera,
    audio: patch.audio ? { ...settings.audio, ...patch.audio } : settings.audio,
    aspectRatio: patch.aspectRatio ?? settings.aspectRatio,
    crop: patch.crop ?? settings.crop,
    trim: patch.trim ? { ...settings.trim, ...patch.trim } : settings.trim,
    speed: patch.speed ?? settings.speed,
    zoom: patch.zoom ?? settings.zoom,
  };
}
