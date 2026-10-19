import { DEFAULT_CAMERA_SETTINGS, type CameraPosition, type CameraSettings, type SettingsPatch } from "@/shared/settings";
import { ChoiceButton, Section, SliderRow, SwitchRow } from "../controls";

const POSITIONS: readonly { value: CameraPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

const STYLE_KEYS = ["size", "roundness", "squircle", "shadow", "mirror"] as const;

export function CameraPanel({ hasCamera, camera, onChange }: {
  hasCamera: boolean;
  camera: CameraSettings;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
}) {
  if (!hasCamera) {
    return (
      <Section title="Camera">
        <p className="text-[11px] leading-snug text-muted-foreground">
          This recording has no camera. Choose a camera in the Screenix popup before recording.
        </p>
      </Section>
    );
  }

  const set = <K extends keyof CameraSettings>(key: K) => (value: CameraSettings[K]) =>
    onChange({ camera: { [key]: value } }, `camera.${key}`);
  const styleIsDefault = STYLE_KEYS.every((key) => camera[key] === DEFAULT_CAMERA_SETTINGS[key]);
  const styleDefaults = Object.fromEntries(STYLE_KEYS.map((key) => [key, DEFAULT_CAMERA_SETTINGS[key]]));

  return (
    <div className="space-y-5">
      <SwitchRow label="Camera overlay" checked={camera.enabled} onChange={(enabled) => onChange({ camera: { enabled } })} />

      {camera.enabled && (
        <>
          <Section title="Position">
            <div className="grid grid-cols-2 gap-1.5">
              {POSITIONS.map((position) => (
                <ChoiceButton
                  key={position.value}
                  active={camera.position === position.value}
                  className="h-9 text-[11px]"
                  onClick={() => onChange({ camera: { position: position.value } })}
                >
                  {position.label}
                </ChoiceButton>
              ))}
            </div>
          </Section>

          <Section title="Style" onReset={() => onChange({ camera: styleDefaults })} resetDisabled={styleIsDefault}>
            <SliderRow label="Size" value={camera.size} min={0.08} max={0.4} step={0.01} onChange={set("size")} format={(value) => `${Math.round(value * 100)}%`} />
            <SliderRow label="Roundness" value={camera.roundness} min={0} max={0.5} step={0.01} onChange={set("roundness")} format={(value) => `${Math.round(value * 200)}%`} />
            <SliderRow label="Shadow" value={camera.shadow} min={0} max={1} step={0.05} onChange={set("shadow")} format={(value) => (value <= 0 ? "Off" : `${Math.round(value * 100)}%`)} />
            <SwitchRow label="Squircle corners" checked={camera.squircle} onChange={(squircle) => onChange({ camera: { squircle } })} />
            <SwitchRow label="Mirror" checked={camera.mirror} onChange={(mirror) => onChange({ camera: { mirror } })} />
          </Section>
        </>
      )}
    </div>
  );
}
