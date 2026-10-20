import { IconMicrophone, IconVideo, IconVolume, type Icon } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { readCaptureSettings, writeCaptureSettings, type CaptureSettings } from "@/shared/captureSettings";
import { hasMediaAccess, openMediaAccessPage, type MediaKind } from "@/shared/mediaAccess";
import { SelectField, SwitchRow } from "@/editor/components/controls";

const DEFAULT_DEVICE = "default";
const NO_DEVICE = "off";
const MAX_DEVICE_LABEL_LENGTH = 28;

function shortLabel(label: string): string {
  return label.length > MAX_DEVICE_LABEL_LENGTH ? `${label.slice(0, MAX_DEVICE_LABEL_LENGTH - 1).trimEnd()}…` : label;
}

export interface MediaState {
  settings: CaptureSettings;
  devices: MediaDeviceInfo[];
  access: Record<MediaKind, boolean>;
}

async function loadMediaState(): Promise<MediaState> {
  const [settings, devices, microphone, camera] = await Promise.all([
    readCaptureSettings(),
    navigator.mediaDevices.enumerateDevices(),
    hasMediaAccess("microphone"),
    hasMediaAccess("camera"),
  ]);
  return { settings, devices, access: { microphone, camera } };
}

function DeviceRow({ icon: RowIcon, label, kind, deviceKind, value, state, disabled, onChange }: {
  icon: Icon;
  label: string;
  kind: MediaKind;
  deviceKind: MediaDeviceKind;
  value: string | null;
  state: MediaState;
  disabled: boolean;
  onChange: (deviceId: string | null) => void;
}) {
  const devices = state.devices.filter((device) => device.kind === deviceKind && device.deviceId && device.deviceId !== DEFAULT_DEVICE);
  const allowed = state.access[kind];

  return (
    <div className="flex items-center gap-2">
      <RowIcon size={15} stroke={1.8} className="shrink-0 text-muted-foreground" aria-hidden />
      {allowed ? (
        <SelectField
          label={label}
          value={value ?? NO_DEVICE}
          disabled={disabled}
          options={[
            { value: NO_DEVICE, label: `No ${label.toLowerCase()}` },
            { value: DEFAULT_DEVICE, label: `Default ${label.toLowerCase()}` },
            ...devices.map((device, index) => ({ value: device.deviceId, label: shortLabel(device.label || `${label} ${index + 1}`) })),
          ]}
          onChange={(deviceId) => onChange(deviceId === NO_DEVICE ? null : deviceId)}
          className="min-h-8 min-w-0 flex-1 px-2.5 text-[12px]"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => openMediaAccessPage([kind])}
          className="sidebar-input h-8 flex-1 px-2 text-left text-[12px] text-muted-foreground hover:text-foreground"
        >
          Allow {label.toLowerCase()}…
        </button>
      )}
    </div>
  );
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

  const update = (patch: Partial<CaptureSettings>) => {
    if (!state) return;
    const settings = { ...state.settings, ...patch };
    setState({ ...state, settings });
    void writeCaptureSettings(settings);
  };

  return { state, update };
}

export function MediaControls({ state, disabled, onChange }: {
  state: MediaState;
  disabled: boolean;
  onChange: (patch: Partial<CaptureSettings>) => void;
}) {
  return (
    <div className="space-y-2">
      <DeviceRow
        icon={IconMicrophone}
        label="Microphone"
        kind="microphone"
        deviceKind="audioinput"
        value={state.settings.microphoneId}
        state={state}
        disabled={disabled}
        onChange={(microphoneId) => onChange({ microphoneId })}
      />
      <DeviceRow
        icon={IconVideo}
        label="Camera"
        kind="camera"
        deviceKind="videoinput"
        value={state.settings.cameraId}
        state={state}
        disabled={disabled}
        onChange={(cameraId) => onChange({ cameraId })}
      />
      <div className="flex items-center gap-2">
        <IconVolume size={15} stroke={1.8} className="shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <SwitchRow label="Tab audio" checked={state.settings.tabAudio} onChange={(tabAudio) => onChange({ tabAudio })} />
        </div>
      </div>
    </div>
  );
}
