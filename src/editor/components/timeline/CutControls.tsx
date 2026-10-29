import { IconArrowBackUp } from "@tabler/icons-react";
import type { CutClip } from "@/shared/settings";
import { formatDuration } from "../../lib/format";

export function CutControls({ clip, onRemove }: { clip: CutClip; onRemove: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground">
        {formatDuration(clip.end - clip.start)} removed. Drag the cut or its edges to choose what to remove.
      </span>
      <button
        type="button"
        title="Delete the cut and keep this part (Delete)"
        onClick={onRemove}
        className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      >
        <IconArrowBackUp size={13} />
        Restore
      </button>
    </div>
  );
}
