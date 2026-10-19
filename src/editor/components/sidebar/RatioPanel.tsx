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

export function RatioPanel({ aspectRatio, source, backgroundEnabled, onChange }: {
  aspectRatio: AspectRatioId;
  source: Size;
  backgroundEnabled: boolean;
  onChange: (patch: SettingsPatch) => void;
}) {
  return (
    <div className="space-y-5">
      <Section title="Aspect ratio" onReset={() => onChange({ aspectRatio: "source" })} resetDisabled={aspectRatio === "source"}>
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECT_RATIOS.map((option) => (
            <ChoiceButton
              key={option.id}
              active={aspectRatio === option.id}
              className="flex h-16 flex-col items-center justify-center gap-1.5 text-[11px]"
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
    </div>
  );
}
