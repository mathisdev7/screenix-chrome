import { IconMicrophone, IconPhoto, IconVolume, IconZoomIn, type Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { SegmentedControl } from "@/editor/components/controls";
import type { RecordingMode } from "@/shared/instant";
import { CameraSource } from "./CameraSource";
import { MicrophoneGain, MicrophoneMeter, formatGain } from "./MicrophoneGain";
import { DeviceSource, SourceRow } from "./SourceRow";
import type { CapturePatch, MediaState } from "./useMediaState";

const MODES: readonly { value: RecordingMode; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "instant", label: "Instant" },
];

function Chip({ icon: ChipIcon, active, onClick, children }: { icon: Icon; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="popup-chip">
      <ChipIcon size={13} stroke={1.8} />
      {children}
    </button>
  );
}

export function SetupView({ state, onChange }: { state: MediaState; onChange: (patch: CapturePatch) => void }) {
  const { settings } = state;
  const { microphoneId, microphoneGain } = settings;

  return (
    <div className="space-y-3">
      <section className="popup-mode space-y-2">
        <SegmentedControl label="Recording mode" options={MODES} value={settings.mode} onChange={(mode) => onChange({ mode })} />
        {settings.mode === "studio" ? (
          <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">Edit the cursor, zoom and camera afterwards.</p>
        ) : (
          <div className="flex gap-1.5">
            <Chip
              icon={IconPhoto}
              active={settings.instantLook === "framed"}
              onClick={() => onChange({ instantLook: settings.instantLook === "framed" ? "full" : "framed" })}
            >
              Background
            </Chip>
            <Chip icon={IconZoomIn} active={settings.instantZoom} onClick={() => onChange({ instantZoom: !settings.instantZoom })}>
              Zoom on clicks
            </Chip>
          </div>
        )}
      </section>

      <div className="popup-sources">
        <DeviceSource
          kind="microphone"
          deviceKind="audioinput"
          icon={IconMicrophone}
          title="Microphone"
          value={microphoneId}
          state={state}
          onChange={(id) => onChange({ microphoneId: id })}
          summary={microphoneGain === 1 ? undefined : formatGain(microphoneGain)}
          meter={microphoneId && <MicrophoneMeter deviceId={microphoneId} gain={microphoneGain} />}
        >
          <div className="px-1 pb-1">
            <MicrophoneGain gain={microphoneGain} onChange={(gain) => onChange({ microphoneGain: gain })} />
          </div>
        </DeviceSource>
        <CameraSource state={state} onChange={onChange} />
        <SourceRow icon={IconVolume} title="Tab audio" checked={settings.tabAudio} onCheckedChange={(tabAudio) => onChange({ tabAudio })}>
          <span className="popup-source-detail">{settings.tabAudio ? "Sound from this tab" : "Off"}</span>
        </SourceRow>
      </div>
    </div>
  );
}
