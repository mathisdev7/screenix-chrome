import { IconSparkles, IconTrash, IconZoomIn } from "@tabler/icons-react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Size } from "@/render/geometry";
import type { ZoomClip, ZoomMode } from "@/shared/settings";
import { MAX_ZOOM_SCALE, MAX_ZOOM_TRANSITION, MIN_ZOOM_SCALE, MIN_ZOOM_TRANSITION, formatScale, removeZoomClip, updateZoomClip } from "../../lib/zoomClips";
import { thumbnailUrl } from "../../lib/thumbnailUrl";
import { ActionButton, Section, SegmentedControl, SliderRow } from "../controls";

const MODES: readonly { value: ZoomMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
];

function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function RegionPicker({ clip, source, thumbnail, onMove }: {
  clip: ZoomClip;
  source: Size;
  thumbnail: string | null;
  onMove: (centerX: number, centerY: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const size = 100 / Math.max(1, clip.scale);

  const moveTo = (event: ReactPointerEvent) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    onMove((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  };

  return (
    <div
      ref={boxRef}
      className="relative w-full cursor-crosshair touch-none overflow-hidden rounded-lg border bg-surface-1 bg-cover bg-center"
      style={{ aspectRatio: `${source.width} / ${source.height}`, backgroundImage: thumbnail ? `url(${thumbnail})` : undefined }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event);
      }}
    >
      <div
        className="pointer-events-none absolute rounded-md border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        style={{
          width: `${size}%`,
          height: `${size}%`,
          left: `${clip.centerX * 100 - size / 2}%`,
          top: `${clip.centerY * 100 - size / 2}%`,
        }}
      />
    </div>
  );
}

export function ZoomPanel({ clips, selectedId, source, thumbnail, canAutoZoom, onAdd, onAutoZoom, onSelect, onChange }: {
  clips: readonly ZoomClip[];
  selectedId: string | null;
  source: Size;
  thumbnail: Blob | null;
  canAutoZoom: boolean;
  onAdd: () => void;
  onAutoZoom: () => void;
  onSelect: (id: string | null) => void;
  onChange: (clips: ZoomClip[], coalesceKey?: string) => void;
}) {
  const clip = clips.find((item) => item.id === selectedId) ?? null;
  const patch = (next: Partial<Omit<ZoomClip, "id" | "start" | "end">>, key?: string) => {
    if (clip) onChange(updateZoomClip(clips, clip.id, next), key && `zoom.${clip.id}.${key}`);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1.5">
        <ActionButton className="flex items-center justify-center gap-1.5" onClick={onAdd}>
          <IconZoomIn size={14} />
          Add zoom
        </ActionButton>
        <ActionButton
          className="flex items-center justify-center gap-1.5"
          title={canAutoZoom ? "Zoom in on every click, replacing the current zooms" : "This recording has no clicks"}
          disabled={!canAutoZoom}
          onClick={onAutoZoom}
        >
          <IconSparkles size={14} />
          Auto zoom
        </ActionButton>
      </div>

      {clip ? (
        <>
          <Section title="Mode">
            <SegmentedControl label="Zoom mode" options={MODES} value={clip.mode} onChange={(mode) => patch({ mode })} />
            <p className="text-[11px] leading-snug text-muted-foreground">
              {clip.mode === "auto"
                ? "Follows the cursor and only moves when it leaves the area in view."
                : "Stays on the area you pick. Drag the box to move it."}
            </p>
            {clip.mode === "manual" && (
              <RegionPicker
                clip={clip}
                source={source}
                thumbnail={thumbnail && thumbnailUrl(thumbnail)}
                onMove={(centerX, centerY) => patch({ centerX, centerY }, "center")}
              />
            )}
          </Section>

          <Section title="Zoom">
            <SliderRow
              label="Scale"
              value={clip.scale}
              min={MIN_ZOOM_SCALE}
              max={MAX_ZOOM_SCALE}
              step={0.1}
              onChange={(scale) => patch({ scale }, "scale")}
              format={formatScale}
            />
            <SliderRow
              label="Zoom in"
              value={clip.zoomIn}
              min={MIN_ZOOM_TRANSITION}
              max={MAX_ZOOM_TRANSITION}
              step={0.05}
              onChange={(zoomIn) => patch({ zoomIn }, "zoomIn")}
              format={formatSeconds}
            />
            <SliderRow
              label="Zoom out"
              value={clip.zoomOut}
              min={MIN_ZOOM_TRANSITION}
              max={MAX_ZOOM_TRANSITION}
              step={0.05}
              onChange={(zoomOut) => patch({ zoomOut }, "zoomOut")}
              format={formatSeconds}
            />
            {clip.mode === "manual" && (
              <>
                <SliderRow label="Position X" value={clip.centerX} min={0} max={1} step={0.005} onChange={(centerX) => patch({ centerX }, "center")} format={formatPercent} />
                <SliderRow label="Position Y" value={clip.centerY} min={0} max={1} step={0.005} onChange={(centerY) => patch({ centerY }, "center")} format={formatPercent} />
              </>
            )}
          </Section>

          <ActionButton
            variant="danger"
            className="flex w-full items-center justify-center gap-1.5"
            onClick={() => {
              onChange(removeZoomClip(clips, clip.id));
              onSelect(null);
            }}
          >
            <IconTrash size={14} />
            Delete zoom
          </ActionButton>
        </>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">
          {clips.length > 0 ? "Select a zoom on the timeline to edit it." : "Add a zoom at the playhead, or let Auto zoom add one at every click."}
        </p>
      )}
    </div>
  );
}
