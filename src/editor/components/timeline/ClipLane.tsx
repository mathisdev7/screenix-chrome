import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { moveSpan, resizeSpan, type Bounds, type Span } from "../../lib/clipSpans";

type LaneDrag = { id: string; mode: "move"; grab: number } | { id: string; mode: "start" | "end" };

function EdgeHandle({ side, onPointerDown }: { side: "start" | "end"; onPointerDown: (event: ReactPointerEvent) => void }) {
  return (
    <div
      className={`absolute inset-y-0 z-10 w-2.5 cursor-ew-resize ${side === "start" ? "left-0" : "right-0"}`}
      onPointerDown={onPointerDown}
    />
  );
}

export function ClipLane<T extends Span>({ name, clips, selectedId, bounds, className, percent, timeAt, renderLabel, onSelect, onChange }: {
  name: string;
  clips: readonly T[];
  selectedId: string | null;
  bounds: Bounds;
  className: string;
  percent: (seconds: number) => string;
  timeAt: (clientX: number) => number;
  renderLabel: (clip: T) => ReactNode;
  onSelect: (id: string | null) => void;
  onChange: (clips: T[], coalesceKey: string) => void;
}) {
  const dragRef = useRef<LaneDrag | null>(null);

  const beginDrag = (event: ReactPointerEvent, clip: T, mode: LaneDrag["mode"]) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(clip.id);
    dragRef.current = mode === "move" ? { id: clip.id, mode, grab: timeAt(event.clientX) - clip.start } : { id: clip.id, mode };
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const at = timeAt(event.clientX);
    if (drag.mode === "move") onChange(moveSpan(clips, drag.id, at - drag.grab, bounds), `${name}.${drag.id}.move`);
    else onChange(resizeSpan(clips, drag.id, drag.mode, at, bounds), `${name}.${drag.id}.${drag.mode}`);
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
            className={`timeline-clip-surface timeline-clip-lane ${className} flex cursor-grab items-center justify-center gap-1 text-[10px] active:cursor-grabbing`}
            data-selected={clip.id === selectedId ? "" : undefined}
            title="Drag to move, drag the edges to resize"
            onPointerDown={(event) => beginDrag(event, clip, "move")}
          >
            {renderLabel(clip)}
          </div>
          <EdgeHandle side="start" onPointerDown={(event) => beginDrag(event, clip, "start")} />
          <EdgeHandle side="end" onPointerDown={(event) => beginDrag(event, clip, "end")} />
        </div>
      ))}
    </div>
  );
}
