export interface CaptureSettings {
  microphoneId: string | null;
  cameraId: string | null;
  tabAudio: boolean;
}

const STORAGE_KEY = "captureSettings";

const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = { microphoneId: null, cameraId: null, tabAudio: true };

export async function readCaptureSettings(): Promise<CaptureSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_CAPTURE_SETTINGS, ...(stored[STORAGE_KEY] as Partial<CaptureSettings> | undefined) };
}

export async function writeCaptureSettings(settings: CaptureSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export function capturesMedia(settings: CaptureSettings): boolean {
  return settings.microphoneId !== null || settings.cameraId !== null || settings.tabAudio;
}
