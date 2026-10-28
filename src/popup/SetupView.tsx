import { IconHourglassHigh, IconMicrophone, IconVolume, IconZoomIn } from "@tabler/icons-react";
import { ChoiceButton, SegmentedControl, SwitchRow } from "@/editor/components/controls";
import { COUNTDOWN_SECONDS, type CountdownSeconds } from "@/shared/countdown";
import { INSTANT_LOOKS, type RecordingMode } from "@/shared/instant";
import { CameraPanel } from "./CameraPanel";
import { DeviceSelect, PopupRow } from "./DeviceSelect";
import { MicrophoneGain } from "./MicrophoneGain";
import type { CapturePatch, MediaState } from "./useMediaState";

const MODES: readonly { value: RecordingMode; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "instant", label: "Instant" },
];

const COUNTDOWNS = COUNTDOWN_SECONDS.map((seconds) => ({ value: String(seconds), label: seconds === 0 ? "Off" : `${seconds}s` }));

export function SetupView({ state, onChange }: { state: MediaState; onChange: (patch: CapturePatch) => void }) {
  const { settings } = state;

  return (
    <div className="space-y-3">
      <section className="space-y-2">
        <SegmentedControl label="Recording mode" options={MODES} value={settings.mode} onChange={(mode) => onChange({ mode })} />
        {settings.mode === "studio" ? (
          <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">Edit the cursor, zoom and camera afterwards.</p>
        ) : (
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <SegmentedControl label="Instant video look" options={INSTANT_LOOKS} value={settings.instantLook} onChange={(instantLook) => onChange({ instantLook })} />
            </div>
            <ChoiceButton
              active={settings.instantZoom}
              title="Zoom in on clicks"
              onClick={() => onChange({ instantZoom: !settings.instantZoom })}
              className="flex shrink-0 items-center gap-1.5 px-3 text-[11px]"
            >
              <IconZoomIn size={14} stroke={1.8} />
              Zoom
            </ChoiceButton>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <DeviceSelect
          icon={IconMicrophone}
          label="Microphone"
          kind="microphone"
          deviceKind="audioinput"
          value={settings.microphoneId}
          state={state}
          onChange={(microphoneId) => onChange({ microphoneId })}
        />
        {settings.microphoneId && state.access.microphone && (
          <div className="pl-[26px]">
            <MicrophoneGain deviceId={settings.microphoneId} gain={settings.microphoneGain} onChange={(microphoneGain) => onChange({ microphoneGain })} />
          </div>
        )}
        <PopupRow icon={IconVolume}>
          <SwitchRow label="Tab audio" checked={settings.tabAudio} onChange={(tabAudio) => onChange({ tabAudio })} />
        </PopupRow>
      </section>

      <CameraPanel state={state} onChange={onChange} />

      <PopupRow icon={IconHourglassHigh}>
        <SegmentedControl
          label="Countdown"
          options={COUNTDOWNS}
          value={String(settings.countdown)}
          onChange={(value) => onChange({ countdown: Number(value) as CountdownSeconds })}
        />
      </PopupRow>
    </div>
  );
}
