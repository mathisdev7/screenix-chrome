import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { SelectField } from "@/editor/components/controls";
import { openMediaAccessPage, type MediaKind } from "@/shared/mediaAccess";
import type { MediaState } from "./useMediaState";

const DEFAULT_DEVICE = "default";
const NO_DEVICE = "off";
const MAX_DEVICE_LABEL_LENGTH = 30;

function shortLabel(label: string): string {
  return label.length > MAX_DEVICE_LABEL_LENGTH ? `${label.slice(0, MAX_DEVICE_LABEL_LENGTH - 1).trimEnd()}…` : label;
}

export function PopupRow({ icon: RowIcon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <RowIcon size={16} stroke={1.8} className="shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function DeviceSelect({ icon, label, kind, deviceKind, value, state, onChange }: {
  icon: Icon;
  label: string;
  kind: MediaKind;
  deviceKind: MediaDeviceKind;
  value: string | null;
  state: MediaState;
  onChange: (deviceId: string | null) => void;
}) {
  const devices = state.devices.filter((device) => device.kind === deviceKind && device.deviceId && device.deviceId !== DEFAULT_DEVICE);
  const noun = label.toLowerCase();

  return (
    <PopupRow icon={icon}>
      {state.access[kind] ? (
        <SelectField
          label={label}
          value={value ?? NO_DEVICE}
          options={[
            { value: NO_DEVICE, label: `No ${noun}` },
            { value: DEFAULT_DEVICE, label: `Default ${noun}` },
            ...devices.map((device, index) => ({ value: device.deviceId, label: shortLabel(device.label || `${label} ${index + 1}`) })),
          ]}
          onChange={(deviceId) => onChange(deviceId === NO_DEVICE ? null : deviceId)}
          className="min-h-[34px] px-3 text-[12px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => openMediaAccessPage([kind])}
          className="sidebar-select min-h-[34px] px-3 text-[12px] text-muted-foreground hover:text-foreground"
        >
          Allow {noun} access…
        </button>
      )}
    </PopupRow>
  );
}
