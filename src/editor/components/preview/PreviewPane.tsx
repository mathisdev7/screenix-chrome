import clsx from "clsx";
import { useMemo, useRef } from "react";
import type { SceneInputs } from "@/render/compositor";
import { aspectValue, outputAspect } from "@/render/geometry";
import type { ProjectMedia } from "@/render/projectMedia";
import { ZoomTimeline } from "@/render/zoom/zoomTimeline";
import { FULL_CROP, type SettingsPatch } from "@/shared/settings";
import type { PlaybackClock } from "../../playback/PlaybackClock";
import { CropOverlay, CropToolbar } from "./CropOverlay";
import { useCameraDrag } from "./useCameraDrag";
import { usePreviewRenderer } from "./usePreviewRenderer";

function uncroppedInputs(inputs: SceneInputs): SceneInputs {
  const { settings } = inputs;
  return {
    ...inputs,
    zoom: ZoomTimeline.empty,
    settings: {
      ...settings,
      crop: FULL_CROP,
      aspectRatio: "source",
      background: { ...settings.background, enabled: false },
      camera: { ...settings.camera, enabled: false },
    },
  };
}

export function PreviewPane({ media, inputs, clock, cropping, onCropDone, onChange }: {
  media: ProjectMedia;
  inputs: SceneInputs;
  clock: PlaybackClock;
  cropping: boolean;
  onCropDone: () => void;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneInputs = useMemo(() => (cropping ? uncroppedInputs(inputs) : inputs), [cropping, inputs]);
  usePreviewRenderer(canvasRef, media, sceneInputs, clock);
  const { settings } = inputs;
  const camera = settings.camera;
  const cameraDrag = useCameraDrag(canvasRef, camera, !cropping && media.camera !== null && camera.enabled, onChange);
  const aspect = cropping ? aspectValue("source", media.source) : outputAspect(settings, media.source);
  const framed = settings.background.enabled && !cropping;
  const toolbarSpace = cropping ? "40px" : "0px";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2" style={{ containerType: "size" }}>
      {cropping && (
        <CropToolbar crop={settings.crop} onReset={() => onChange({ crop: FULL_CROP })} onDone={onCropDone} />
      )}
      <div
        className={clsx("relative overflow-hidden", !framed && "rounded-md ring-1 ring-[var(--editor-preview-ring)]")}
        style={{ width: `min(96cqw, calc((94cqh - ${toolbarSpace}) * ${aspect}), 1920px)`, aspectRatio: aspect, cursor: cameraDrag.cursor }}
        onClick={() => {
          if (!cropping && !cameraDrag.consumeClick()) clock.toggle();
        }}
        {...cameraDrag.handlers}
      >
        <canvas ref={canvasRef} className="block size-full" />
        {cropping && <CropOverlay crop={settings.crop} onChange={(crop) => onChange({ crop }, "crop")} />}
      </div>
    </div>
  );
}
