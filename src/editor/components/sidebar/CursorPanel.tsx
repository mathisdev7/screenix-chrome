import { IconChevronDown } from "@tabler/icons-react";
import clsx from "clsx";
import { useState } from "react";
import { cursorAssetUrl } from "@/render/cursor/theme";
import { CURSOR_THEMES } from "@/shared/cursorThemes";
import { DEFAULT_CURSOR_SETTINGS, type CursorSettings, type SettingsPatch } from "@/shared/settings";
import { ChoiceButton, Section, SliderRow, SwitchRow } from "../controls";
import { CLICK_EFFECT_OPTIONS } from "./clickEffectIcons";

function intensityLabel(value: number): string {
  if (value === 0) return "Off";
  if (value <= 0.3) return "Subtle";
  if (value <= 0.6) return "Medium";
  return "Strong";
}

function speedLabel(value: number): string {
  if (value <= 0.2) return "Slow";
  if (value <= 0.4) return "Relaxed";
  if (value <= 0.6) return "Normal";
  if (value <= 0.8) return "Fast";
  return "Snappy";
}

function swayLabel(value: number): string {
  if (value === 0) return "Off";
  if (value <= 0.3) return "Subtle";
  if (value <= 0.7) return "Moderate";
  return "Heavy";
}

function ThemePicker({ theme, onChange }: {
  theme: CursorSettings["theme"];
  onChange: (theme: CursorSettings["theme"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = CURSOR_THEMES.find(({ id }) => id === theme) ?? CURSOR_THEMES[0];

  return (
    <Section title="Theme">
      <button
        type="button"
        aria-expanded={open}
        className="sidebar-choice flex h-10 w-full items-center gap-2 px-2.5 text-[11px]"
        onClick={() => setOpen((value) => !value)}
      >
        <img src={cursorAssetUrl(current.id, "default")} alt="" className="size-5 shrink-0 object-contain" />
        <span className="flex-1 truncate text-left">{current.label}</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          {open ? "Done" : "Change"}
          <IconChevronDown size={13} className={clsx("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-1.5">
          {CURSOR_THEMES.map(({ id, label }) => (
            <ChoiceButton key={id} active={theme === id} className="flex h-9 items-center gap-1.5 px-2 text-[11px]" onClick={() => onChange(id)}>
              <img src={cursorAssetUrl(id, "default")} alt="" className="size-4 shrink-0 object-contain" />
              <span className="truncate">{label}</span>
            </ChoiceButton>
          ))}
        </div>
      )}
    </Section>
  );
}

export function CursorPanel({ cursor, onChange }: {
  cursor: CursorSettings;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
}) {
  const set = <K extends keyof CursorSettings>(key: K) => (value: CursorSettings[K]) => onChange({ cursor: { [key]: value } }, `cursor.${key}`);
  const appearanceDefaults = { size: DEFAULT_CURSOR_SETTINGS.size, shadow: DEFAULT_CURSOR_SETTINGS.shadow };
  const motionDefaults = {
    speed: DEFAULT_CURSOR_SETTINGS.speed,
    sway: DEFAULT_CURSOR_SETTINGS.sway,
    motionBlur: DEFAULT_CURSOR_SETTINGS.motionBlur,
  };
  const clickDefaults = {
    clickEffect: DEFAULT_CURSOR_SETTINGS.clickEffect,
    clickEffectIntensity: DEFAULT_CURSOR_SETTINGS.clickEffectIntensity,
  };
  const isDefault = (defaults: Partial<CursorSettings>) =>
    Object.entries(defaults).every(([key, value]) => cursor[key as keyof CursorSettings] === value);

  return (
    <div className="space-y-5">
      <ThemePicker theme={cursor.theme} onChange={(theme) => onChange({ cursor: { theme } })} />

      <Section title="Appearance" onReset={() => onChange({ cursor: appearanceDefaults })} resetDisabled={isDefault(appearanceDefaults)}>
        <SliderRow label="Size" value={cursor.size} min={1} max={8} step={0.1} onChange={set("size")} format={(value) => `${value.toFixed(1)}%`} />
        <SliderRow label="Shadow" value={cursor.shadow} min={0} max={1} step={0.1} onChange={set("shadow")} format={intensityLabel} />
      </Section>

      <Section title="Motion" onReset={() => onChange({ cursor: motionDefaults })} resetDisabled={isDefault(motionDefaults)}>
        <SliderRow label="Speed" value={cursor.speed} min={0} max={1} step={0.1} onChange={set("speed")} format={speedLabel} />
        <SliderRow label="Sway" value={cursor.sway} min={0} max={1} step={0.1} onChange={set("sway")} format={swayLabel} />
        <SliderRow label="Motion blur" value={cursor.motionBlur} min={0} max={1} step={0.1} onChange={set("motionBlur")} format={intensityLabel} />
      </Section>

      <Section title="Click effect" onReset={() => onChange({ cursor: clickDefaults })} resetDisabled={isDefault(clickDefaults)}>
        <div className="grid grid-cols-5 gap-1">
          {CLICK_EFFECT_OPTIONS.map(({ value, label, icon }) => (
            <ChoiceButton
              key={value}
              active={cursor.clickEffect === value}
              title={label}
              className="flex h-12 flex-col items-center justify-center gap-1 text-[10px]"
              onClick={() => onChange({ cursor: { clickEffect: value } })}
            >
              {icon}
              <span className="max-w-full truncate px-0.5">{label}</span>
            </ChoiceButton>
          ))}
        </div>
        {cursor.clickEffect !== "none" && (
          <SliderRow
            label="Intensity"
            value={cursor.clickEffectIntensity}
            min={0.1}
            max={1}
            step={0.1}
            onChange={set("clickEffectIntensity")}
            format={intensityLabel}
          />
        )}
      </Section>

      <Section title="Behavior">
        <SwitchRow label="Hide when idle" checked={cursor.hideWhenIdle} onChange={(value) => onChange({ cursor: { hideWhenIdle: value } })} />
        {cursor.hideWhenIdle && (
          <SliderRow label="Idle delay" value={cursor.idleTimeout} min={0.1} max={3} step={0.1} onChange={set("idleTimeout")} format={(value) => `${value.toFixed(1)}s`} />
        )}
        <SwitchRow label="Lock cursor type" checked={cursor.lockType} onChange={(value) => onChange({ cursor: { lockType: value } })} />
      </Section>
    </div>
  );
}
