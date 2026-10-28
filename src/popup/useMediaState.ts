import { useCallback, useEffect, useState } from "react";
import { readCaptureSettings, writeCaptureSettings, type CaptureSettings } from "@/shared/captureSettings";
import { hasMediaAccess, type MediaKind } from "@/shared/mediaAccess";

export interface MediaState {
  settings: CaptureSettings;
  devices: MediaDeviceInfo[];
  access: Record<MediaKind, boolean>;
}

export type CapturePatch = Partial<CaptureSettings>;

async function loadMediaState(): Promise<MediaState> {
  const [settings, devices, microphone, camera] = await Promise.all([
    readCaptureSettings(),
    navigator.mediaDevices.enumerateDevices(),
    hasMediaAccess("microphone"),
    hasMediaAccess("camera"),
  ]);
  return { settings, devices, access: { microphone, camera } };
}

export function useMediaState() {
  const [state, setState] = useState<MediaState | null>(null);

  const reload = useCallback(() => {
    void loadMediaState().then(setState);
  }, []);

  useEffect(() => {
    reload();
    navigator.mediaDevices.addEventListener("devicechange", reload);
    return () => navigator.mediaDevices.removeEventListener("devicechange", reload);
  }, [reload]);

  const update = (patch: CapturePatch) => {
    if (!state) return;
    const settings = { ...state.settings, ...patch };
    setState({ ...state, settings });
    void writeCaptureSettings(settings);
  };

  return { state, update };
}
