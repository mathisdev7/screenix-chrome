import { useEffect, useState } from "react";
import { ActionButton, ChoiceButton, SegmentedControl, Section, SliderRow, SwitchRow } from "@/editor/components/controls";
import { ThemePicker } from "@/editor/components/sidebar/CursorPanel";
import { WallpaperOptions } from "@/editor/components/sidebar/WallpaperGrid";
import { CLICK_EFFECT_OPTIONS } from "@/editor/components/sidebar/clickEffectIcons";
import { ABSTRACT_WALLPAPERS, PAINTING_WALLPAPERS, builtinWallpaper } from "@/render/wallpapers";
import { cameraBubbleOf, onCaptureSettingsChanged, readCaptureSettings, writeCaptureSettings, type CaptureSettings } from "@/shared/captureSettings";
import { DEFAULT_INSTANT_STYLE, type InstantStyle } from "@/shared/instant";
import type { BrowserFrameStyle } from "@/shared/settings";
import { InstantPreview } from "./InstantPreview";

const BROWSER_FRAMES: readonly { value: BrowserFrameStyle; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const CAMERA_SIZES = [
  { value: "small", label: "Small", size: 0.16 },
  { value: "medium", label: "Medium", size: 0.24 },
  { value: "large", label: "Large", size: 0.32 },
] as const;

type CameraSize = (typeof CAMERA_SIZES)[number]["value"];

function nearestCameraSize(size: number): CameraSize {
  return CAMERA_SIZES.reduce((best, option) => (Math.abs(option.size - size) < Math.abs(best.size - size) ? option : best)).value;
}

function useCaptureSettings(): [CaptureSettings | null, (patch: Partial<CaptureSettings>) => void] {
  const [settings, setSettings] = useState<CaptureSettings | null>(null);

  useEffect(() => {
    void readCaptureSettings().then(setSettings);
    return onCaptureSettingsChanged(setSettings);
  }, []);

  const update = (patch: Partial<CaptureSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    void writeCaptureSettings(next);
  };

  return [settings, update];
}

function CameraOptions({ capture, onStyleChange }: { capture: CaptureSettings; onStyleChange: (patch: Partial<InstantStyle>) => void }) {
  const style = capture.instantStyle;
  return (
    <Section title="Camera">
      {!capture.cameraId ? (
        <p className="text-[11px] leading-snug text-muted-foreground">Turn on a camera in the Screenix popup to add your bubble to the video.</p>
      ) : cameraBubbleOf(capture) === "recording" ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Your bubble is recorded with the page. Set the camera bubble to In the editor in the popup to size and flip it here.
        </p>
      ) : (
        <>
          <SegmentedControl
            label="Camera size"
            options={CAMERA_SIZES}
            value={nearestCameraSize(style.cameraSize)}
            onChange={(value) => onStyleChange({ cameraSize: CAMERA_SIZES.find((option) => option.value === value)?.size ?? DEFAULT_INSTANT_STYLE.cameraSize })}
          />
          <SwitchRow label="Mirror camera" checked={style.cameraMirror} onChange={(cameraMirror) => onStyleChange({ cameraMirror })} />
        </>
      )}
    </Section>
  );
}

export function InstantSetupPage() {
  const [capture, update] = useCaptureSettings();
  if (!capture) return null;

  const style = capture.instantStyle;
  const setStyle = (patch: Partial<InstantStyle>) => update({ instantStyle: { ...style, ...patch } });
  const framed = capture.instantLook === "framed";
  const selectedWallpaper = builtinWallpaper(style.wallpaper);
  const isDefault = !framed && !capture.instantZoom
    && (Object.keys(DEFAULT_INSTANT_STYLE) as (keyof InstantStyle)[]).every((key) => style[key] === DEFAULT_INSTANT_STYLE[key]);

  return (
    <main className="screenix-editor min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4 lg:sticky lg:top-6">
          <header className="space-y-1.5">
            <h1 className="text-[17px] font-semibold">Instant video</h1>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              These settings apply to your next Instant recordings. The preview shows a sample page; Edit in Studio can still change everything afterwards.
            </p>
          </header>
          <InstantPreview capture={capture} />
        </div>

        <div className="w-full shrink-0 space-y-5 rounded-2xl border bg-surface-1 p-5 lg:w-[340px]">
          <Section title="Cursor">
            <SliderRow
              label="Size"
              value={style.cursorSize}
              min={1}
              max={8}
              step={0.1}
              onChange={(cursorSize) => setStyle({ cursorSize })}
              format={(value) => `${value.toFixed(1)}%`}
            />
            <SwitchRow label="Hide when idle" checked={style.hideCursorWhenIdle} onChange={(hideCursorWhenIdle) => setStyle({ hideCursorWhenIdle })} />
          </Section>

          <ThemePicker theme={style.cursorTheme} onChange={(cursorTheme) => setStyle({ cursorTheme })} />

          <Section title="Click highlight">
            <div className="grid grid-cols-5 gap-1">
              {CLICK_EFFECT_OPTIONS.map(({ value, label, icon }) => (
                <ChoiceButton
                  key={value}
                  active={style.clickEffect === value}
                  title={label}
                  className="flex h-12 flex-col items-center justify-center gap-1 text-[10px]"
                  onClick={() => setStyle({ clickEffect: value })}
                >
                  {icon}
                  <span className="max-w-full truncate px-0.5">{label}</span>
                </ChoiceButton>
              ))}
            </div>
          </Section>

          <Section title="Zoom">
            <SwitchRow label="Zoom on clicks" checked={capture.instantZoom} onChange={(instantZoom) => update({ instantZoom })} />
          </Section>

          <Section title="Background">
            <SwitchRow label="Wallpaper and frame" checked={framed} onChange={(on) => update({ instantLook: on ? "framed" : "full" })} />
            {framed && (
              <div className="space-y-2">
                <WallpaperOptions wallpapers={ABSTRACT_WALLPAPERS} selected={selectedWallpaper} onSelect={(wallpaper) => setStyle({ wallpaper })} />
                <span className="block pt-1 text-[11px] text-muted-foreground">Paintings</span>
                <WallpaperOptions wallpapers={PAINTING_WALLPAPERS} selected={selectedWallpaper} onSelect={(wallpaper) => setStyle({ wallpaper })} />
              </div>
            )}
          </Section>

          <Section title="Browser frame">
            <SegmentedControl label="Browser frame" options={BROWSER_FRAMES} value={style.browserFrame} onChange={(browserFrame) => setStyle({ browserFrame })} />
          </Section>

          <CameraOptions capture={capture} onStyleChange={setStyle} />

          <div className="flex gap-2 pt-1">
            <ChoiceButton
              active={false}
              disabled={isDefault}
              onClick={() => update({ instantLook: "full", instantZoom: false, instantStyle: DEFAULT_INSTANT_STYLE })}
              className="h-[38px] flex-1 text-[12px]"
            >
              Reset
            </ChoiceButton>
            <ActionButton onClick={() => window.close()} className="flex-1">
              Done
            </ActionButton>
          </div>
        </div>
      </div>
    </main>
  );
}
