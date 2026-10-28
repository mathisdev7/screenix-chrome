import type { CountdownSeconds } from "./countdown";
import type { InstantLook, RecordingMode } from "./instant";

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
  countdown: CountdownSeconds;
  cameraBubble: CameraBubble;
}

const STORAGE_KEY = "captureSettings";

const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = { microphoneId: null, microphoneGain: 1, cameraId: null, tabAudio: true, mode: "studio", instantLook: "full", instantZoom: false, countdown: 3, cameraBubble: "countdown" };

export async function readCaptureSettings(): Promise<CaptureSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const settings = { ...DEFAULT_CAPTURE_SETTINGS, ...(stored[STORAGE_KEY] as Partial<CaptureSettings> | undefined) };
  return CAMERA_BUBBLES.includes(settings.cameraBubble) ? settings : { ...settings, cameraBubble: DEFAULT_CAPTURE_SETTINGS.cameraBubble };
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
