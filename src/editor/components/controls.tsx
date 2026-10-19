import { Radio } from "@base-ui/react/radio";
import { Select } from "@base-ui/react/select";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Slider } from "@base-ui/react/slider";
import { Switch } from "@base-ui/react/switch";
import { IconSelector } from "@tabler/icons-react";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function SectionHeader({ title, onReset, resetDisabled }: {
  title: string;
  onReset?: () => void;
  resetDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="select-none text-[11px] font-semibold tracking-wide text-muted-foreground">{title}</span>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className="text-[11px] font-medium text-ring transition-colors hover:text-ring/80 disabled:pointer-events-none disabled:opacity-30"
        >
          Reset
        </button>
      )}
    </div>
  );
}

export function Section({ title, onReset, resetDisabled, children }: {
  title: string;
  onReset?: () => void;
  resetDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <SectionHeader title={title} onReset={onReset} resetDisabled={resetDisabled} />
      {children}
    </section>
  );
}

export function SliderRow({ label, value, min, max, step = 0.01, onChange, onCommit, format }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  format?: (value: number) => string;
}) {
  const display = format ? format(value) : value.toFixed(1);
  return (
    <Slider.Root
      aria-label={label}
      className="sidebar-slider"
      max={max}
      min={min}
      step={step}
      thumbAlignment="edge"
      value={value}
      onValueChange={(next) => onChange(next as number)}
      onValueCommitted={(next) => onCommit?.(next as number)}
    >
      <Slider.Control className="sidebar-slider-control">
        <Slider.Track className="sidebar-slider-track">
          <Slider.Indicator className="sidebar-slider-fill" />
          <div className="sidebar-slider-caption" aria-hidden="true">
            <span>{label}</span>
            <span className="sidebar-slider-value">{display}</span>
          </div>
          <Slider.Thumb className="sidebar-slider-thumb" index={0} aria-label={label} aria-valuetext={display} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      className="sidebar-segments"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      value={value}
      onValueChange={(next) => onChange(next as T)}
    >
      {options.map((option) => (
        <Radio.Root key={option.value} className="sidebar-segment" value={option.value}>
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

export function SwitchRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="sidebar-switch-row">
      <span>{label}</span>
      <Switch.Root aria-label={label} checked={checked} onCheckedChange={onChange} className="sidebar-switch">
        <Switch.Thumb className="sidebar-switch-thumb" />
      </Switch.Root>
    </label>
  );
}

export function ChoiceButton({ active, className, ...props }: ComponentProps<"button"> & { active: boolean }) {
  return <button type="button" aria-pressed={active} className={clsx("sidebar-choice", className)} {...props} />;
}

export function ActionButton({ variant = "solid", className, ...props }: ComponentProps<"button"> & { variant?: "solid" | "danger" }) {
  return (
    <button
      type="button"
      className={clsx("sidebar-action", variant === "danger" && "sidebar-action-danger", className)}
      {...props}
    />
  );
}

export function ColorField({ label, value, onChange }: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>}
      <div className="flex h-10 items-center gap-2 rounded-lg border px-3">
        <input
          type="color"
          aria-label={label ?? "Color"}
          className="sidebar-input size-7 cursor-pointer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="font-mono text-[12px] text-muted-foreground">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, disabled, className }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select.Root items={options} value={value} disabled={disabled} onValueChange={(next) => next !== null && onChange(next)}>
      <Select.Trigger aria-label={label} className={clsx("sidebar-select", className)}>
        <Select.Value className="block min-w-0 flex-1 truncate" />
        <Select.Icon data-slot="select-icon">
          <IconSelector size={13} stroke={1.8} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner alignItemWithTrigger={false} sideOffset={6} className="z-50 select-none">
          <Select.Popup className="editor-sidebar-select-list max-h-[var(--available-height)] w-[var(--anchor-width)] overflow-y-auto">
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                <Select.ItemText className="block min-w-0 truncate">{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
