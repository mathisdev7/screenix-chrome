import clsx from "clsx";
import { useRef } from "react";
import type { SceneInputs } from "@/render/compositor";
import { aspectValue } from "@/render/geometry";
import type { ProjectMedia } from "@/render/projectMedia";
import type { PlaybackClock } from "../../playback/PlaybackClock";
import { usePreviewRenderer } from "./usePreviewRenderer";

export function PreviewPane({ media, inputs, clock }: {
  media: ProjectMedia;
  inputs: SceneInputs;
  clock: PlaybackClock;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePreviewRenderer(canvasRef, media, inputs, clock);
  const aspect = aspectValue(inputs.settings.aspectRatio, media.source);
  const framed = inputs.settings.background.enabled;

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center" style={{ containerType: "size" }}>
      <div
        className={clsx("relative overflow-hidden", !framed && "rounded-md ring-1 ring-[var(--editor-preview-ring)]")}
        style={{ width: `min(96cqw, calc(94cqh * ${aspect}), 1920px)`, aspectRatio: aspect }}
        onClick={() => clock.toggle()}
      >
        <canvas ref={canvasRef} className="block size-full" />
      </div>
    </div>
  );
}
