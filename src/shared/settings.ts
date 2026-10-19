export type ClickEffectStyle = "none" | "ripple" | "highlight" | "halo" | "burst";

export type BackgroundKind = "image" | "color" | "gradient";

export type AspectRatioId = "source" | "16:9" | "9:16" | "1:1" | "4:5" | "4:3";

export interface CursorSettings {
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

export interface EditorSettings {
  cursor: CursorSettings;
  background: BackgroundSettings;
  camera: CameraSettings;
  audio: AudioSettings;
  aspectRatio: AspectRatioId;
  trim: TrimRange;
  speed: SpeedClip[];
}

export const DEFAULT_CURSOR_SETTINGS: CursorSettings = {
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
};

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
    trim: { start: 0, end: null },
    speed: [],
  };
}

export function withDefaults(settings: Partial<EditorSettings> | null | undefined): EditorSettings {
  const defaults = createDefaultSettings();
  return {
    cursor: { ...defaults.cursor, ...settings?.cursor },
    background: { ...defaults.background, ...settings?.background },
    camera: { ...defaults.camera, ...settings?.camera },
    audio: { ...defaults.audio, ...settings?.audio },
    aspectRatio: settings?.aspectRatio ?? defaults.aspectRatio,
    trim: { ...defaults.trim, ...settings?.trim },
    speed: Array.isArray(settings?.speed) ? settings.speed : defaults.speed,
  };
}

export interface SettingsPatch {
  cursor?: Partial<CursorSettings>;
  background?: Partial<BackgroundSettings>;
  camera?: Partial<CameraSettings>;
  audio?: Partial<AudioSettings>;
  aspectRatio?: AspectRatioId;
  trim?: Partial<TrimRange>;
  speed?: SpeedClip[];
}

export function applySettingsPatch(settings: EditorSettings, patch: SettingsPatch): EditorSettings {
  return {
    cursor: patch.cursor ? { ...settings.cursor, ...patch.cursor } : settings.cursor,
    background: patch.background ? { ...settings.background, ...patch.background } : settings.background,
    camera: patch.camera ? { ...settings.camera, ...patch.camera } : settings.camera,
    audio: patch.audio ? { ...settings.audio, ...patch.audio } : settings.audio,
    aspectRatio: patch.aspectRatio ?? settings.aspectRatio,
    trim: patch.trim ? { ...settings.trim, ...patch.trim } : settings.trim,
    speed: patch.speed ?? settings.speed,
  };
}
