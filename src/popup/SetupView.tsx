import { IconAdjustmentsHorizontal, IconMicrophone, IconVolume } from "@tabler/icons-react";
import { SegmentedControl } from "@/editor/components/controls";
import { CLICK_EFFECT_OPTIONS } from "@/editor/components/sidebar/clickEffectIcons";
import type { CaptureSettings } from "@/shared/captureSettings";
import type { RecordingMode } from "@/shared/instant";
import { CameraSource } from "./CameraSource";
import { MicrophoneGain, MicrophoneMeter, formatGain } from "./MicrophoneGain";
import { DeviceSource, SourceRow } from "./SourceRow";
import type { CapturePatch, MediaState } from "./useMediaState";

const MODES: readonly { value: RecordingMode; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "instant", label: "Instant" },
];

const INSTANT_SETUP_PAGE = "instant-setup.html";

function instantSummary({ instantLook, instantZoom, instantStyle }: CaptureSettings): string {
  const clickEffect = CLICK_EFFECT_OPTIONS.find(({ value }) => value === instantStyle.clickEffect);
  return [
    `Cursor ${instantStyle.cursorSize.toFixed(1)}%`,
    instantStyle.clickEffect !== "none" && clickEffect && `${clickEffect.label} clicks`,
    instantLook === "framed" && "Background",
    instantZoom && "Zoom on clicks",
    instantStyle.browserFrame !== "off" && "Browser frame",
  ].filter(Boolean).join(" · ");
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
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL(INSTANT_SETUP_PAGE) })}
              className="sidebar-choice flex h-8 w-full items-center justify-center gap-1.5 text-[12px]"
            >
              <IconAdjustmentsHorizontal size={14} stroke={1.8} />
              Cursor, clicks and background
            </button>
            <p className="truncate px-0.5 text-[11px] leading-snug text-muted-foreground">{instantSummary(settings)}</p>
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
