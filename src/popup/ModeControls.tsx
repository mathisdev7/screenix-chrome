import { SegmentedControl, SelectField } from "@/editor/components/controls";
import type { CaptureSettings } from "@/shared/captureSettings";
import { INSTANT_LOOKS, type RecordingMode } from "@/shared/instant";

const MODES: readonly { value: RecordingMode; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "instant", label: "Instant" },
];

export function ModeControls({ settings, disabled, onChange }: {
  settings: CaptureSettings;
  disabled: boolean;
  onChange: (patch: Partial<CaptureSettings>) => void;
}) {
  return (
    <div className="space-y-2">
      <SegmentedControl label="Recording mode" options={MODES} value={settings.mode} onChange={(mode) => onChange({ mode })} />
      {settings.mode === "instant" && (
        <SelectField
          label="Instant video look"
          value={settings.instantLook}
          options={INSTANT_LOOKS}
          disabled={disabled}
          onChange={(instantLook) => onChange({ instantLook })}
          className="min-h-8 w-full px-2.5 text-[12px]"
        />
      )}
    </div>
  );
}
