import { Popover } from "@base-ui/react/popover";
import { Switch } from "@base-ui/react/switch";
import { IconCheck, IconChevronDown, type Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { openMediaAccessPage, type MediaKind } from "@/shared/mediaAccess";
import type { MediaState } from "./useMediaState";

const DEFAULT_DEVICE = "default";

export function SourceRow({ icon: SourceIcon, preview, title, checked, onCheckedChange, children }: {
  icon: Icon;
  preview?: ReactNode;
  title: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="popup-source" data-off={checked ? undefined : ""}>
      {preview ?? (
        <div className="popup-source-tile">
          <SourceIcon size={16} stroke={1.8} aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="popup-source-title">{title}</div>
        {children}
      </div>
      <Switch.Root aria-label={title} checked={checked} onCheckedChange={onCheckedChange} className="sidebar-switch">
        <Switch.Thumb className="sidebar-switch-thumb" />
      </Switch.Root>
    </div>
  );
}

function SourcePicker({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="popup-source-detail popup-picker">
        <span className="truncate">{label}</span>
        <IconChevronDown size={12} stroke={2} className="shrink-0" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-50">
          <Popover.Popup className="popup-menu max-h-[var(--available-height)] w-[236px] overflow-y-auto">{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function DeviceSource({ kind, deviceKind, icon, title, value, state, onChange, preview, summary, meter, children }: {
  kind: MediaKind;
  deviceKind: MediaDeviceKind;
  icon: Icon;
  title: string;
  value: string | null;
  state: MediaState;
  onChange: (deviceId: string | null) => void;
  preview?: ReactNode;
  summary?: string;
  meter?: ReactNode;
  children?: ReactNode;
}) {
  const access = state.access[kind];
  const on = access && value !== null;
  const options = [
    { value: DEFAULT_DEVICE, label: `Default ${title.toLowerCase()}` },
    ...state.devices
      .filter((device) => device.kind === deviceKind && device.deviceId && device.deviceId !== DEFAULT_DEVICE)
      .map((device, index) => ({ value: device.deviceId, label: device.label || `${title} ${index + 1}` })),
  ];
  const selected = options.find((option) => option.value === value) ?? options[0];

  const toggle = (checked: boolean) => {
    if (!access) openMediaAccessPage([kind]);
    else onChange(checked ? DEFAULT_DEVICE : null);
  };

  return (
    <SourceRow icon={icon} preview={on ? preview : undefined} title={title} checked={on} onCheckedChange={toggle}>
      {!access ? (
        <button type="button" onClick={() => openMediaAccessPage([kind])} className="popup-source-detail popup-picker">
          Allow access…
        </button>
      ) : on ? (
        <>
          <SourcePicker label={summary ? `${selected.label} · ${summary}` : selected.label}>
            <div className="popup-menu-label">{title}</div>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={option.value === selected.value}
                onClick={() => onChange(option.value)}
                className="popup-menu-item"
              >
                <span className="popup-menu-check">{option.value === selected.value && <IconCheck size={12} stroke={2.2} />}</span>
                <span className="truncate">{option.label}</span>
              </button>
            ))}
            {children && (
              <>
                <div className="popup-menu-separator" />
                {children}
              </>
            )}
          </SourcePicker>
          {meter}
        </>
      ) : (
        <span className="popup-source-detail">Off</span>
      )}
    </SourceRow>
  );
}
