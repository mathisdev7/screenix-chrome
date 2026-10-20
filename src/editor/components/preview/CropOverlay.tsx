import clsx from "clsx";
import { useEffect, useRef, type PointerEvent } from "react";
import type { CropRect } from "@/shared/settings";
import { dragCrop, isFullCrop, type CropHandle } from "../../lib/cropRect";

const HANDLES: Record<Exclude<CropHandle, "move">, string> = {
  nw: "left-0 top-0 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 cursor-ns-resize",
  ne: "right-0 top-0 cursor-nesw-resize",
  e: "right-0 top-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "bottom-0 right-0 cursor-nwse-resize",
  s: "bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize",
  sw: "bottom-0 left-0 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-y-1/2 cursor-ew-resize",
};

interface CropDrag {
  handle: CropHandle;
  pointerX: number;
  pointerY: number;
  start: CropRect;
}

export function CropOverlay({ crop, onChange }: { crop: CropRect; onChange: (crop: CropRect) => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<CropDrag | null>(null);

  const begin = (event: PointerEvent<HTMLElement>, handle: CropHandle) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    areaRef.current?.setPointerCapture(event.pointerId);
    drag.current = { handle, pointerX: event.clientX, pointerY: event.clientY, start: crop };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    const bounds = areaRef.current?.getBoundingClientRect();
    if (!current || !bounds) return;
    const dx = (event.clientX - current.pointerX) / bounds.width;
    const dy = (event.clientY - current.pointerY) / bounds.height;
    onChange(dragCrop(current.start, current.handle, dx, dy));
  };

  const end = () => {
    drag.current = null;
  };

  return (
    <div ref={areaRef} className="absolute inset-0 touch-none select-none" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div
        className="absolute cursor-move border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
        }}
        onPointerDown={(event) => begin(event, "move")}
      >
        {Object.entries(HANDLES).map(([handle, position]) => (
          <span
            key={handle}
            className={clsx("absolute grid size-6 place-items-center", position)}
            onPointerDown={(event) => begin(event, handle as CropHandle)}
          >
            <span className="size-3 rounded-full bg-white shadow ring-1 ring-black/25" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function CropToolbar({ crop, onReset, onDone }: { crop: CropRect; onReset: () => void; onDone: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.preventDefault();
      onDone();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDone]);

  return (
    <div className="flex h-8 shrink-0 items-center gap-2">
      <span className="text-[11px] text-muted-foreground">Drag the edges to crop the recording</span>
      <button
        type="button"
        disabled={isFullCrop(crop)}
        onClick={onReset}
        className="flex h-7 items-center rounded-lg border px-2.5 text-[11px] font-medium text-foreground hover:bg-accent/60 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Reset
      </button>
      <button type="button" onClick={onDone} className="gold-button flex h-7 items-center rounded-lg px-3 text-[11px] font-medium">
        Done
      </button>
    </div>
  );
}
