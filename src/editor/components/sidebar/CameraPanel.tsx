import { useRef } from "react";
import { DEFAULT_CAMERA_SETTINGS, type CameraSettings, type SettingsPatch } from "@/shared/settings";
import type { CameraImportState } from "../../hooks/useCameraImport";
import { ActionButton, ChoiceButton, Section, SliderRow, SwitchRow } from "../controls";

const CORNERS: readonly { x: number; y: number; label: string }[] = [
  { x: 0, y: 0, label: "Top left" },
  { x: 1, y: 0, label: "Top right" },
  { x: 0, y: 1, label: "Bottom left" },
  { x: 1, y: 1, label: "Bottom right" },
];

const STYLE_KEYS = ["size", "roundness", "glassBorder", "squircle", "shadow", "mirror"] as const;

function CameraVideoImport({ hasCamera, state, onImport }: {
  hasCamera: boolean;
  state: CameraImportState;
  onImport: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importing = state.status === "importing";

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onImport(file);
        }}
      />
      <ActionButton disabled={importing} onClick={() => inputRef.current?.click()}>
        {importing ? `Importing… ${Math.round(state.progress * 100)}%` : hasCamera ? "Replace with a video" : "Import a video as camera"}
      </ActionButton>
      {state.status === "failed" && <p role="alert" className="text-[11px] text-destructive">{state.message}</p>}
      <p className="text-[11px] leading-snug text-muted-foreground">
        Videos shorter than the recording loop to fill it.
      </p>
    </div>
  );
}

export function CameraPanel({ hasCamera, camera, importState, onImportVideo, onChange }: {
  hasCamera: boolean;
  camera: CameraSettings;
  importState: CameraImportState;
  onImportVideo: (file: File) => void;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
}) {
  if (!hasCamera) {
    return (
      <Section title="Camera">
        <p className="text-[11px] leading-snug text-muted-foreground">
          This recording has no camera. Choose a camera in the Screenix popup before recording, or import a video to use as the camera.
        </p>
        <CameraVideoImport hasCamera={false} state={importState} onImport={onImportVideo} />
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
              {CORNERS.map((corner) => (
                <ChoiceButton
                  key={corner.label}
                  active={camera.x === corner.x && camera.y === corner.y}
                  className="h-9 text-[11px]"
                  onClick={() => onChange({ camera: { x: corner.x, y: corner.y } })}
                >
                  {corner.label}
                </ChoiceButton>
              ))}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">Or drag the camera in the preview to place it anywhere.</p>
          </Section>

          <Section title="Style" onReset={() => onChange({ camera: styleDefaults })} resetDisabled={styleIsDefault}>
            <SliderRow label="Size" value={camera.size} min={0.08} max={0.4} step={0.01} onChange={set("size")} format={(value) => `${Math.round(value * 100)}%`} />
            <SliderRow label="Roundness" value={camera.roundness} min={0} max={0.5} step={0.01} onChange={set("roundness")} format={(value) => `${Math.round(value * 200)}%`} />
            <SliderRow label="Glass border" value={camera.glassBorder} min={0} max={1} step={0.05} onChange={set("glassBorder")} format={(value) => (value <= 0 ? "Off" : `${Math.round(value * 100)}%`)} />
            <SliderRow label="Shadow" value={camera.shadow} min={0} max={1} step={0.05} onChange={set("shadow")} format={(value) => (value <= 0 ? "Off" : `${Math.round(value * 100)}%`)} />
            <SwitchRow label="Squircle corners" checked={camera.squircle} onChange={(squircle) => onChange({ camera: { squircle } })} />
            <SwitchRow label="Mirror" checked={camera.mirror} onChange={(mirror) => onChange({ camera: { mirror } })} />
          </Section>
        </>
      )}

      <Section title="Source">
        <CameraVideoImport hasCamera state={importState} onImport={onImportVideo} />
      </Section>
    </div>
  );
}
