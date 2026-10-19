import { IconBolt, IconMinus, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerTrackNextFilled, IconPlayerTrackPrevFilled, IconPlus, IconZoomIn } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { formatClock } from "../../lib/format";

function ToolbarButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid size-7 place-items-center border-y border-l bg-transparent text-foreground first:rounded-l-lg last:rounded-r-lg last:border-r hover:bg-accent/60"
    >
      {children}
    </button>
  );
}

function AddButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium text-foreground hover:bg-accent/60"
    >
      {children}
    </button>
  );
}

export function TimelineToolbar({ time, duration, playing, zoom, onToggle, onStep, onZoom, onAddSpeed, onAddZoom }: {
  time: number;
  duration: number;
  playing: boolean;
  zoom: number;
  onToggle: () => void;
  onStep: (direction: -1 | 1) => void;
  onZoom: (zoom: number) => void;
  onAddSpeed: () => void;
  onAddZoom: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatClock(time)} <span className="opacity-50">/</span> {formatClock(duration)}
        </span>
        <div className="flex gap-1.5">
          <AddButton title="Zoom in on part of the video, starting at the playhead" onClick={onAddZoom}>
            <IconZoomIn size={13} />
            Add zoom
          </AddButton>
          <AddButton title="Speed up or slow down part of the video, starting at the playhead" onClick={onAddSpeed}>
            <IconBolt size={13} />
            Add speed
          </AddButton>
        </div>
      </div>
      <div className="flex">
        <ToolbarButton title="Previous frame" onClick={() => onStep(-1)}>
          <IconPlayerTrackPrevFilled size={13} />
        </ToolbarButton>
        <ToolbarButton title={playing ? "Pause (Space)" : "Play (Space)"} onClick={onToggle}>
          {playing ? <IconPlayerPauseFilled size={14} /> : <IconPlayerPlayFilled size={14} />}
        </ToolbarButton>
        <ToolbarButton title="Next frame" onClick={() => onStep(1)}>
          <IconPlayerTrackNextFilled size={13} />
        </ToolbarButton>
      </div>
      <div className="flex justify-end">
        <ToolbarButton title="Zoom out" onClick={() => onZoom(zoom / 1.5)}>
          <IconMinus size={13} />
        </ToolbarButton>
        <button
          type="button"
          title="Reset zoom"
          onClick={() => onZoom(1)}
          className="h-7 min-w-12 border-y border-l px-1 text-[10px] tabular-nums text-muted-foreground hover:bg-accent/60"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ToolbarButton title="Zoom in" onClick={() => onZoom(zoom * 1.5)}>
          <IconPlus size={13} />
        </ToolbarButton>
      </div>
    </div>
  );
}
