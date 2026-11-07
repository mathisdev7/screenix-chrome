import type { CountdownSeconds } from "./countdown";
import { DEFAULT_INSTANT_STYLE, normalizeInstantStyle, type InstantLook, type InstantStyle, type RecordingMode } from "./instant";

export const CAMERA_BUBBLES = ["recording", "countdown", "off"] as const;

export type CameraBubble = (typeof CAMERA_BUBBLES)[number];

export interface CaptureSettings {
  microphoneId: string | null;
  microphoneGain: number;
  cameraId: string | null;
  tabAudio: boolean;
  mode: RecordingMode;
  instantLook: InstantLook;
  instantZoom: boolean;
  instantStyle: InstantStyle;
  countdown: CountdownSeconds;
  cameraBubble: CameraBubble;
  debuggerBarNotice: boolean;
}

const STORAGE_KEY = "captureSettings";

const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = { microphoneId: null, microphoneGain: 1, cameraId: null, tabAudio: true, mode: "studio", instantLook: "full", instantZoom: false, instantStyle: DEFAULT_INSTANT_STYLE, countdown: 3, cameraBubble: "countdown", debuggerBarNotice: true };

export async function readCaptureSettings(): Promise<CaptureSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeCaptureSettings(stored[STORAGE_KEY] as Partial<CaptureSettings> | undefined);
}

function normalizeCaptureSettings(stored: Partial<CaptureSettings> | undefined): CaptureSettings {
  const settings = { ...DEFAULT_CAPTURE_SETTINGS, ...stored, instantStyle: normalizeInstantStyle(stored?.instantStyle) };
  return CAMERA_BUBBLES.includes(settings.cameraBubble) ? settings : { ...settings, cameraBubble: DEFAULT_CAPTURE_SETTINGS.cameraBubble };
}

export function onCaptureSettingsChanged(listener: (settings: CaptureSettings) => void): () => void {
  const handle = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && STORAGE_KEY in changes) listener(normalizeCaptureSettings(changes[STORAGE_KEY].newValue as Partial<CaptureSettings> | undefined));
  };
  chrome.storage.onChanged.addListener(handle);
  return () => chrome.storage.onChanged.removeListener(handle);
}

export function cameraBubbleOf(settings: CaptureSettings): CameraBubble {
  return settings.cameraId ? settings.cameraBubble : "off";
}

export function separateMediaSettings(settings: CaptureSettings): CaptureSettings {
  return cameraBubbleOf(settings) === "recording" ? { ...settings, cameraId: null } : settings;
}

export async function writeCaptureSettings(settings: CaptureSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
