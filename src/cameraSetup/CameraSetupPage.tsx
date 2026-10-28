import { useEffect, useState } from "react";
import { mountCameraBubble } from "@/content/cameraBubble";
import { ActionButton, ChoiceButton, SliderRow } from "@/editor/components/controls";
import {
  CAMERA_BUBBLE_MAX_SIZE,
  CAMERA_BUBBLE_MIN_SIZE,
  DEFAULT_CAMERA_BUBBLE_STYLE,
  onCameraBubbleStyleChanged,
  readCameraBubbleStyle,
  writeCameraBubbleStyle,
  type CameraBubbleStyle,
} from "@/shared/cameraBubbleStyle";
import { readCaptureSettings } from "@/shared/captureSettings";
import { cameraConstraints } from "@/shared/mediaAccess";

type CameraState = "loading" | "live" | "none" | "failed";

const CORNERS = [
  { label: "Top left", x: 0, y: 0 },
  { label: "Top right", x: 1, y: 0 },
  { label: "Bottom left", x: 0, y: 1 },
  { label: "Bottom right", x: 1, y: 1 },
] as const;

const CAMERA_NOTES: Record<Exclude<CameraState, "live">, string> = {
  loading: "Starting your camera…",
  none: "Choose a camera in the Screenix popup to see yourself here.",
  failed: "Your camera isn't available. Check that no other app is using it.",
};

function useCameraBubbleStyle(): CameraBubbleStyle {
  const [style, setStyle] = useState(DEFAULT_CAMERA_BUBBLE_STYLE);
  useEffect(() => {
    void readCameraBubbleStyle().then(setStyle);
    return onCameraBubbleStyleChanged(setStyle);
  }, []);
  return style;
}

function useLiveBubble(): CameraState {
  const [state, setState] = useState<CameraState>("loading");

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.transform = "scaleX(-1)";
    const host = mountCameraBubble(video, true);

    void readCaptureSettings().then(async ({ cameraId }) => {
      if (!cameraId) return setState("none");
      try {
        const opened = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(cameraId) });
        if (!active) return opened.getTracks().forEach((track) => track.stop());
        stream = opened;
        video.srcObject = opened;
        setState("live");
      } catch {
        if (active) setState("failed");
      }
    });

    return () => {
      active = false;
      host.remove();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return state;
}

export function CameraSetupPage() {
  const style = useCameraBubbleStyle();
  const camera = useLiveBubble();
  const update = (patch: Partial<CameraBubbleStyle>) => void writeCameraBubbleStyle({ ...style, ...patch });
  const isDefault = (Object.keys(DEFAULT_CAMERA_BUBBLE_STYLE) as (keyof CameraBubbleStyle)[]).every((key) => style[key] === DEFAULT_CAMERA_BUBBLE_STYLE[key]);

  return (
    <main className="screenix-editor grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="w-[340px] space-y-5 rounded-2xl border bg-surface-1 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <header className="space-y-1.5">
          <h1 className="text-[15px] font-semibold">Camera bubble</h1>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            This is how your camera appears on the pages you record. Drag it to move it, or drag the white dot to resize it.
          </p>
          {camera !== "live" && <p className="text-[12px] leading-relaxed text-[#d9a45a]">{CAMERA_NOTES[camera]}</p>}
        </header>

        <section className="space-y-2">
          <SliderRow
            label="Size"
            value={style.size}
            min={CAMERA_BUBBLE_MIN_SIZE}
            max={CAMERA_BUBBLE_MAX_SIZE}
            step={4}
            onChange={(size) => update({ size })}
            format={(size) => `${size} px`}
          />
          <SliderRow
            label="Roundness"
            value={style.roundness}
            min={0}
            max={1}
            step={0.01}
            onChange={(roundness) => update({ roundness })}
            format={(roundness) => `${Math.round(roundness * 100)}%`}
          />
        </section>

        <section className="space-y-2">
          <h2 className="select-none text-[11px] font-semibold tracking-wide text-muted-foreground">Position</h2>
          <div className="grid grid-cols-2 gap-2">
            {CORNERS.map((corner) => (
              <ChoiceButton
                key={corner.label}
                active={style.x === corner.x && style.y === corner.y}
                onClick={() => update({ x: corner.x, y: corner.y })}
                className="h-9 text-[12px]"
              >
                {corner.label}
              </ChoiceButton>
            ))}
          </div>
        </section>

        <div className="flex gap-2">
          <ChoiceButton
            active={false}
            disabled={isDefault}
            onClick={() => void writeCameraBubbleStyle(DEFAULT_CAMERA_BUBBLE_STYLE)}
            className="h-[38px] flex-1 text-[12px]"
          >
            Reset
          </ChoiceButton>
          <ActionButton onClick={() => window.close()} className="flex-1">
            Done
          </ActionButton>
        </div>
      </div>
    </main>
  );
}
