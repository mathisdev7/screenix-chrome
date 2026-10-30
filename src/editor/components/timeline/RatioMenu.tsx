import { Popover } from "@base-ui/react/popover";
import { IconAspectRatio, IconChevronDown } from "@tabler/icons-react";
import { ASPECT_RATIOS, aspectValue, type Size } from "@/render/geometry";
import type { AspectRatioId, SettingsPatch } from "@/shared/settings";
import { ChoiceButton, Section } from "../controls";

const ICON_BOX = 18;

function AspectIcon({ aspect }: { aspect: number }) {
  const width = aspect >= 1 ? ICON_BOX : ICON_BOX * aspect;
  const height = aspect >= 1 ? ICON_BOX / aspect : ICON_BOX;
  return (
    <span className="grid size-5 place-items-center">
      <span className="rounded-[3px] border-[1.5px] border-current" style={{ width, height }} />
    </span>
  );
}

export function RatioMenu({ aspectRatio, source, backgroundEnabled, onChange }: {
  aspectRatio: AspectRatioId;
  source: Size;
  backgroundEnabled: boolean;
  onChange: (patch: SettingsPatch) => void;
}) {
  const current = ASPECT_RATIOS.find((option) => option.id === aspectRatio) ?? ASPECT_RATIOS[0];

  return (
    <Popover.Root>
      <Popover.Trigger
        title="Aspect ratio of the video"
        className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-medium text-foreground hover:bg-accent/60 data-[popup-open]:bg-accent/60"
      >
        <IconAspectRatio size={13} />
        {current.id === "source" ? "Ratio" : current.label}
        <IconChevronDown size={12} className="text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={6} collisionPadding={8} className="z-50">
          <Popover.Popup className="screenix-editor w-[264px] rounded-xl border bg-background p-3 shadow-2xl">
            <Section title="Aspect ratio" onReset={() => onChange({ aspectRatio: "source" })} resetDisabled={aspectRatio === "source"}>
              <div className="grid grid-cols-3 gap-1.5">
                {ASPECT_RATIOS.map((option) => (
                  <ChoiceButton
                    key={option.id}
                    active={aspectRatio === option.id}
                    className="flex h-14 flex-col items-center justify-center gap-1 text-[11px]"
                    onClick={() => onChange({ aspectRatio: option.id })}
                  >
                    <AspectIcon aspect={aspectValue(option.id, source)} />
                    {option.label}
                  </ChoiceButton>
                ))}
              </div>
              {!backgroundEnabled && aspectRatio !== "source" && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Without a background, the recording is cropped to fill the frame.
                </p>
              )}
            </Section>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
