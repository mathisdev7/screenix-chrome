import { DEFAULT_BACKGROUND_SETTINGS, type BackgroundKind, type BackgroundSettings, type BrowserFrameStyle, type SettingsPatch } from "@/shared/settings";
import { ColorField, SegmentedControl, Section, SliderRow, SwitchRow } from "../controls";
import { WallpaperGrid } from "./WallpaperGrid";

const BACKGROUND_KINDS = [
  { value: "image", label: "Image" },
  { value: "color", label: "Color" },
  { value: "gradient", label: "Gradient" },
] as const satisfies readonly { value: BackgroundKind; label: string }[];

const BROWSER_FRAMES = [
  { value: "off", label: "Off" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly { value: BrowserFrameStyle; label: string }[];

const FRAME_KEYS = ["squircle", "screenScale", "cornerRadius", "shadowBlur", "glassBorderWidth", "glassBorderOpacity"] as const;

const FRAME_DEFAULTS: Partial<BackgroundSettings> = Object.fromEntries(
  FRAME_KEYS.map((key) => [key, DEFAULT_BACKGROUND_SETTINGS[key]]),
);

export function BackgroundPanel({ background, onChange, onUploadWallpaper }: {
  background: BackgroundSettings;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
  onUploadWallpaper: (file: File) => void;
}) {
  const set = <K extends keyof BackgroundSettings>(key: K) => (value: BackgroundSettings[K]) =>
    onChange({ background: { [key]: value } }, `background.${key}`);
  const frameIsDefault = FRAME_KEYS.every((key) => background[key] === DEFAULT_BACKGROUND_SETTINGS[key]);

  return (
    <div className="space-y-5">
      <SwitchRow label="Add a background" checked={background.enabled} onChange={(enabled) => onChange({ background: { enabled } })} />
      {background.enabled && (
        <SwitchRow label="Zoom inside frame" checked={background.zoomInsideFrame} onChange={(zoomInsideFrame) => onChange({ background: { zoomInsideFrame } })} />
      )}

      <Section title="Browser frame">
        <SegmentedControl label="Browser frame" options={BROWSER_FRAMES} value={background.browserFrame} onChange={(browserFrame) => onChange({ background: { browserFrame } })} />
      </Section>

      {background.enabled && (
        <>
          <Section title="Background">
            <SegmentedControl label="Background type" options={BACKGROUND_KINDS} value={background.kind} onChange={(kind) => onChange({ background: { kind } })} />
            {background.kind === "image" && (
              <WallpaperGrid
                value={background.wallpaper}
                onSelect={(wallpaper) => onChange({ background: { wallpaper } })}
                onUpload={onUploadWallpaper}
              />
            )}
            {background.kind === "color" && <ColorField value={background.color} onChange={set("color")} />}
            {background.kind === "gradient" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <ColorField label="Start" value={background.color} onChange={set("color")} />
                  <ColorField label="End" value={background.gradientEndColor} onChange={set("gradientEndColor")} />
                </div>
                <SliderRow label="Angle" value={background.gradientAngle} min={0} max={360} step={1} onChange={set("gradientAngle")} format={(value) => `${Math.round(value)}°`} />
              </>
            )}
          </Section>

          <Section title="Frame" onReset={() => onChange({ background: FRAME_DEFAULTS })} resetDisabled={frameIsDefault}>
            <SwitchRow label="Squircle corners" checked={background.squircle} onChange={(squircle) => onChange({ background: { squircle } })} />
            <SliderRow label="Screen scale" value={background.screenScale} min={0.5} max={1} step={0.01} onChange={set("screenScale")} format={(value) => `${Math.round(value * 100)}%`} />
            <SliderRow label="Corner radius" value={background.cornerRadius} min={0} max={48} step={1} onChange={set("cornerRadius")} format={(value) => `${Math.round(value)}px`} />
            <SliderRow label="Shadow blur" value={background.shadowBlur} min={0} max={80} step={1} onChange={set("shadowBlur")} format={(value) => `${Math.round(value)}px`} />
            <SliderRow label="Glass border" value={background.glassBorderWidth} min={0} max={32} step={1} onChange={set("glassBorderWidth")} format={(value) => `${Math.round(value)}px`} />
            {background.glassBorderWidth > 0 && (
              <SliderRow label="Glass opacity" value={background.glassBorderOpacity} min={0.04} max={0.36} step={0.01} onChange={set("glassBorderOpacity")} format={(value) => `${Math.round(value * 100)}%`} />
            )}
          </Section>
        </>
      )}
    </div>
  );
}
