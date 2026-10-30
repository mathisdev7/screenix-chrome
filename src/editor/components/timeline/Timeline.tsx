import { IconBolt, IconScissors, IconVideo, IconZoomIn } from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { TimeMap } from "@/render/timeMap";
import type { CutClip, SpeedClip, TrimRange, ZoomClip } from "@/shared/settings";
import { useElementSize } from "../../hooks/useElementSize";
import { formatDuration } from "../../lib/format";
import type { PlaybackClock } from "../../playback/PlaybackClock";
import { usePlaybackSnapshot } from "../../playback/usePlayback";
import { addCutClip, cutClipAt, removeCutClip } from "../../lib/cutClips";
import { addSpeedClip, formatRate, removeSpeedClip, setSpeedRate, speedClipAt } from "../../lib/speedClips";
import { formatScale, removeZoomClip } from "../../lib/zoomClips";
import { ClipLane } from "./ClipLane";
import { CutControls } from "./CutControls";
import { SpeedControls } from "./SpeedControls";
import { TimelineToolbar } from "./TimelineToolbar";
import { formatTick, tickStep, tickTimes } from "./timelineScale";

const FRAME_STEP = 1 / 30;
const MIN_CLIP_DURATION = 0.2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

type DragTarget = "seek" | "trim-start" | "trim-end";
type LaneSelection = { lane: "speed" | "cut"; id: string };

function TrimHandle({ side, onPointerDown }: { side: "start" | "end"; onPointerDown: (event: ReactPointerEvent) => void }) {
  return (
    <div
      title={side === "start" ? "Drag to trim the start" : "Drag to trim the end"}
      className={`absolute inset-y-0 z-10 grid w-5 cursor-ew-resize place-items-center ${side === "start" ? "left-0" : "right-0"}`}
      onPointerDown={onPointerDown}
    >
      <span className="h-5 w-1 rounded-full bg-white/80 shadow-sm" />
    </div>
  );
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function Timeline({ clock, duration, map, speed, cuts, zoomClips, selectedZoomId, onTrimChange, onSpeedChange, onCutsChange, onZoomChange, onSelectZoom, onAddZoom, cropping, cropped, onCrop, ratioMenu }: {
  clock: PlaybackClock;
  duration: number;
  map: TimeMap;
  speed: readonly SpeedClip[];
  cuts: readonly CutClip[];
  zoomClips: readonly ZoomClip[];
  selectedZoomId: string | null;
  onTrimChange: (trim: Partial<TrimRange>) => void;
  onSpeedChange: (speed: SpeedClip[], coalesceKey?: string) => void;
  onCutsChange: (cuts: CutClip[], coalesceKey?: string) => void;
  onZoomChange: (zoom: ZoomClip[], coalesceKey?: string) => void;
  onSelectZoom: (id: string | null) => void;
  onAddZoom: () => void;
  cropping: boolean;
  cropped: boolean;
  onCrop: () => void;
  ratioMenu: ReactNode;
}) {
  const { time, playing } = usePlaybackSnapshot(clock);
  const trim = { start: map.sourceStart, end: map.sourceEnd };
  const [selected, setSelected] = useState<LaneSelection | null>(null);
  const selectedSpeed = selected?.lane === "speed" ? speed.find((clip) => clip.id === selected.id) ?? null : null;
  const selectedCut = selected?.lane === "cut" ? cuts.find((clip) => clip.id === selected.id) ?? null : null;

  const selectLane = (lane: LaneSelection["lane"]) => (id: string | null) => {
    setSelected(id ? { lane, id } : null);
    if (id) onSelectZoom(null);
  };
  const selectSpeed = selectLane("speed");
  const selectCut = selectLane("cut");

  const selectZoom = (id: string | null) => {
    onSelectZoom(id);
    if (id) setSelected(null);
  };

  const keepsVideo = (start: number, end: number, nextCuts: readonly CutClip[]) =>
    new TimeMap(start, end, [], nextCuts).outputDuration >= MIN_CLIP_DURATION;

  const changeCuts = (next: CutClip[], coalesceKey?: string) => {
    if (keepsVideo(trim.start, trim.end, next)) onCutsChange(next, coalesceKey);
  };

  useEffect(() => {
    if (!selected && !selectedZoomId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || (event.key !== "Delete" && event.key !== "Backspace")) return;
      event.preventDefault();
      if (selected?.lane === "speed") {
        onSpeedChange(removeSpeedClip(speed, selected.id));
        setSelected(null);
      } else if (selected?.lane === "cut") {
        onCutsChange(removeCutClip(cuts, selected.id));
        setSelected(null);
      } else if (selectedZoomId) {
        onZoomChange(removeZoomClip(zoomClips, selectedZoomId));
        onSelectZoom(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, selectedZoomId, speed, cuts, zoomClips, onSpeedChange, onCutsChange, onZoomChange, onSelectZoom]);

  const addSpeed = () => {
    const existing = speedClipAt(speed, time);
    if (existing) {
      selectSpeed(existing.id);
      return;
    }
    const id = crypto.randomUUID();
    const next = addSpeedClip(speed, time, trim, id);
    if (!next) return;
    onSpeedChange(next);
    selectSpeed(id);
  };

  const addCut = () => {
    const existing = cutClipAt(cuts, time);
    if (existing) {
      selectCut(existing.id);
      return;
    }
    const id = crypto.randomUUID();
    const next = addCutClip(cuts, time, trim, id);
    if (!next || !keepsVideo(trim.start, trim.end, next)) return;
    onCutsChange(next);
    selectCut(id);
  };
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragTarget | null>(null);
  const { width: viewportWidth } = useElementSize(viewportRef);

  const contentWidth = Math.max(1, viewportWidth * zoom);
  const safeDuration = Math.max(duration, 1e-3);
  const percent = (seconds: number) => `${(seconds / safeDuration) * 100}%`;
  const step = tickStep(contentWidth / safeDuration);
  const ticks = tickTimes(duration, step);

  const inTrim = (seconds: number) => `${((seconds - trim.start) / Math.max(trim.end - trim.start, 1e-3)) * 100}%`;

  const timeAt = (clientX: number) => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(duration, Math.max(0, ((clientX - rect.left) / rect.width) * duration));
  };

  const applyDrag = (target: DragTarget, clientX: number) => {
    const at = timeAt(clientX);
    if (target === "seek") clock.seek(at);
    else if (target === "trim-start") {
      const start = Math.min(at, trim.end - MIN_CLIP_DURATION);
      if (keepsVideo(start, trim.end, cuts)) onTrimChange({ start });
    } else {
      const end = Math.max(at, trim.start + MIN_CLIP_DURATION);
      if (keepsVideo(trim.start, end, cuts)) onTrimChange({ end });
    }
  };

  const startDrag = (target: DragTarget, event: ReactPointerEvent) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = target;
    if (target === "seek") clock.pause();
    applyDrag(target, event.clientX);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (dragRef.current) applyDrag(dragRef.current, event.clientX);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const zoomTo = (next: number) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));

  return (
    <div className="flex flex-col gap-2.5 border-t bg-[var(--editor-workspace-background)] px-4 pb-4 pt-2.5">
      <TimelineToolbar
        time={map.outputAt(time)}
        duration={map.outputDuration}
        playing={playing}
        zoom={zoom}
        onAddSpeed={addSpeed}
        onAddCut={addCut}
        onAddZoom={onAddZoom}
        cropping={cropping}
        cropped={cropped}
        onCrop={onCrop}
        ratioMenu={ratioMenu}
        onToggle={() => clock.toggle()}
        onStep={(direction) => {
          clock.pause();
          clock.seek(time + direction * FRAME_STEP);
        }}
        onZoom={zoomTo}
      />
      <div ref={viewportRef} className="overflow-x-auto rounded-xl p-2.5">
        <div
          ref={contentRef}
          className="relative select-none"
          style={{ width: contentWidth }}
          onPointerDown={(event) => startDrag("seek", event)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="relative mb-0.5 h-5">
            {ticks.map((tick, index) => (
              <span
                key={tick}
                className={clsx(
                  "absolute top-1 text-[8px] tabular-nums text-[var(--editor-timeline-label)]",
                  index === 0 ? "translate-x-0" : tick >= duration - 1e-6 ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: percent(tick) }}
              >
                {formatTick(tick, step)}
              </span>
            ))}
          </div>

          <div className="relative h-[3.25rem] rounded-xl bg-surface-2/40">
            <div
              className="absolute inset-y-0"
              style={{ left: percent(trim.start), width: percent(trim.end - trim.start) }}
            >
              <div className="timeline-clip-surface timeline-clip-video">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="timeline-tick"
                    style={{ left: inTrim(tick) }}
                  />
                ))}
                {cuts.map((cut) => (
                  <span
                    key={cut.id}
                    className="timeline-cut-gap"
                    style={{ left: inTrim(cut.start), width: inTrim(trim.start + cut.end - cut.start) }}
                  />
                ))}
                <div className="relative flex h-full flex-col items-center justify-center leading-tight">
                  <span className="flex items-center gap-1 text-[9px]">
                    <IconVideo size={10} stroke={2.2} />
                    Clip
                  </span>
                  <span className="text-[11px]">{formatDuration(map.outputDuration)}</span>
                </div>
              </div>
              <TrimHandle side="start" onPointerDown={(event) => startDrag("trim-start", event)} />
              <TrimHandle side="end" onPointerDown={(event) => startDrag("trim-end", event)} />
            </div>
          </div>

          {cuts.length > 0 && (
            <ClipLane
              name="cut"
              clips={cuts}
              selectedId={selectedCut?.id ?? null}
              bounds={trim}
              className="timeline-clip-cut"
              percent={percent}
              timeAt={timeAt}
              renderLabel={(clip) => (
                <>
                  <IconScissors size={10} stroke={2.4} className="shrink-0" />
                  <span className="truncate">Cut · {formatDuration(clip.end - clip.start)}</span>
                </>
              )}
              onSelect={selectCut}
              onChange={changeCuts}
            />
          )}

          {zoomClips.length > 0 && (
            <ClipLane
              name="zoom"
              clips={zoomClips}
              selectedId={selectedZoomId}
              bounds={trim}
              className="timeline-clip-zoom"
              percent={percent}
              timeAt={timeAt}
              renderLabel={(clip) => (
                <>
                  <IconZoomIn size={10} stroke={2.4} className="shrink-0" />
                  <span className="truncate">{clip.mode === "auto" ? "Auto" : "Manual"} · {formatScale(clip.scale)}</span>
                </>
              )}
              onSelect={selectZoom}
              onChange={onZoomChange}
            />
          )}

          {speed.length > 0 && (
            <ClipLane
              name="speed"
              clips={speed}
              selectedId={selectedSpeed?.id ?? null}
              bounds={trim}
              className="timeline-clip-speed"
              percent={percent}
              timeAt={timeAt}
              renderLabel={(clip) => (
                <>
                  <IconBolt size={10} stroke={2.4} className="shrink-0" />
                  <span className="truncate">{formatRate(clip.rate)}</span>
                </>
              )}
              onSelect={selectSpeed}
              onChange={onSpeedChange}
            />
          )}

          <div className="pointer-events-none absolute inset-y-0 z-30 -translate-x-1/2" style={{ left: percent(time) }}>
            <svg width="11" height="9" viewBox="0 0 11 9" className="absolute -top-1 left-1/2 -translate-x-1/2 text-ring">
              <path d="M1 1h9L5.5 8z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
            </svg>
            <div className="absolute bottom-0 left-1/2 top-[5px] w-0.5 -translate-x-1/2 rounded-full bg-ring opacity-90" />
          </div>
        </div>
      </div>
      {selectedCut && (
        <CutControls
          clip={selectedCut}
          onRemove={() => {
            onCutsChange(removeCutClip(cuts, selectedCut.id));
            selectCut(null);
          }}
        />
      )}
      {selectedSpeed && (
        <SpeedControls
          clip={selectedSpeed}
          onRate={(rate) => onSpeedChange(setSpeedRate(speed, selectedSpeed.id, rate), `speed.${selectedSpeed.id}.rate`)}
          onRemove={() => {
            onSpeedChange(removeSpeedClip(speed, selectedSpeed.id));
            selectSpeed(null);
          }}
        />
      )}
    </div>
  );
}
