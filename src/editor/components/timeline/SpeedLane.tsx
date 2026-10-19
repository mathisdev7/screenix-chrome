import { IconBolt } from "@tabler/icons-react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { SpeedClip } from "@/shared/settings";
import { formatRate, moveSpeedClip, resizeSpeedClip, type Bounds } from "../../lib/speedClips";

type SpeedDrag = { id: string; mode: "move"; grab: number } | { id: string; mode: "start" | "end" };

function EdgeHandle({ side, onPointerDown }: { side: "start" | "end"; onPointerDown: (event: ReactPointerEvent) => void }) {
  return (
    <div
      className={`absolute inset-y-0 z-10 w-2.5 cursor-ew-resize ${side === "start" ? "left-0" : "right-0"}`}
      onPointerDown={onPointerDown}
    />
  );
}

export function SpeedLane({ clips, selectedId, bounds, percent, timeAt, onSelect, onChange }: {
  clips: readonly SpeedClip[];
  selectedId: string | null;
  bounds: Bounds;
  percent: (seconds: number) => string;
  timeAt: (clientX: number) => number;
  onSelect: (id: string | null) => void;
  onChange: (clips: SpeedClip[], coalesceKey: string) => void;
}) {
  const dragRef = useRef<SpeedDrag | null>(null);

  const beginDrag = (event: ReactPointerEvent, clip: SpeedClip, mode: SpeedDrag["mode"]) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(clip.id);
    dragRef.current = mode === "move" ? { id: clip.id, mode, grab: timeAt(event.clientX) - clip.start } : { id: clip.id, mode };
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const at = timeAt(event.clientX);
    if (drag.mode === "move") onChange(moveSpeedClip(clips, drag.id, at - drag.grab, bounds), `speed.${drag.id}.move`);
    else onChange(resizeSpeedClip(clips, drag.id, drag.mode, at, bounds), `speed.${drag.id}.${drag.mode}`);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="relative mt-1.5 h-8 rounded-lg bg-surface-2/30" onPointerDown={() => onSelect(null)}>
      {clips.map((clip) => (
        <div
          key={clip.id}
          className="absolute inset-y-0"
          style={{ left: percent(clip.start), width: percent(clip.end - clip.start) }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="timeline-clip-surface timeline-clip-speed flex cursor-grab items-center justify-center gap-1 text-[10px] active:cursor-grabbing"
            data-selected={clip.id === selectedId ? "" : undefined}
            title="Drag to move, drag the edges to resize"
            onPointerDown={(event) => beginDrag(event, clip, "move")}
          >
            <IconBolt size={10} stroke={2.4} className="shrink-0" />
            <span className="truncate">{formatRate(clip.rate)}</span>
          </div>
          <EdgeHandle side="start" onPointerDown={(event) => beginDrag(event, clip, "start")} />
          <EdgeHandle side="end" onPointerDown={(event) => beginDrag(event, clip, "end")} />
        </div>
      ))}
    </div>
  );
}
