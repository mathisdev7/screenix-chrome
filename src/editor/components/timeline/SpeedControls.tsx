import { IconTrash } from "@tabler/icons-react";
import type { SpeedClip } from "@/shared/settings";
import { formatRate, MAX_SPEED_RATE, MIN_SPEED_RATE, SPEED_PRESETS } from "../../lib/speedClips";
import { ChoiceButton, SliderRow } from "../controls";

export function SpeedControls({ clip, onRate, onRemove }: {
  clip: SpeedClip;
  onRate: (rate: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div className="w-52">
        <SliderRow label="Speed" value={clip.rate} min={MIN_SPEED_RATE} max={MAX_SPEED_RATE} step={0.25} onChange={onRate} format={formatRate} />
      </div>
      <div className="flex gap-1">
        {SPEED_PRESETS.map((rate) => (
          <ChoiceButton key={rate} active={clip.rate === rate} className="h-8 min-w-11 px-2 text-[11px]" onClick={() => onRate(rate)}>
            {formatRate(rate)}
          </ChoiceButton>
        ))}
      </div>
      <button
        type="button"
        title="Delete speed clip (Delete)"
        onClick={onRemove}
        className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-destructive"
      >
        <IconTrash size={13} />
        Delete
      </button>
    </div>
  );
}
