import { IconAdjustmentsHorizontal, IconVideo, IconVideoOff } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { SegmentedControl, SwitchRow } from "@/editor/components/controls";
import { cameraConstraints } from "@/shared/mediaAccess";
import { DeviceSelect } from "./DeviceSelect";
import type { CapturePatch, MediaState } from "./useMediaState";

type Placement = "page" | "editor";

const CAMERA_SETUP_PAGE = "camera-setup.html";

const PLACEMENTS: readonly { value: Placement; label: string }[] = [
  { value: "editor", label: "In the editor" },
  { value: "page", label: "On the page" },
];

const PLACEMENT_HINTS: Record<Placement, string> = {
  page: "Recorded with the page, like Loom.",
  editor: "Its own track, editable later.",
};

type PreviewResult = { cameraId: string; stream: MediaStream } | { cameraId: string; failed: true };

function useCameraStream(cameraId: string): MediaStream | "failed" | null {
  const [result, setResult] = useState<PreviewResult | null>(null);

  useEffect(() => {
    let active = true;
    let opened: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: cameraConstraints(cameraId) }).then(
      (stream) => {
        if (!active) return stream.getTracks().forEach((track) => track.stop());
        opened = stream;
        setResult({ cameraId, stream });
      },
      () => {
        if (active) setResult({ cameraId, failed: true });
      },
    );
    return () => {
      active = false;
      opened?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraId]);

  if (result?.cameraId !== cameraId) return null;
  return "stream" in result ? result.stream : "failed";
}

function CameraPreview({ cameraId }: { cameraId: string }) {
  const stream = useCameraStream(cameraId);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.current && stream !== "failed") video.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 shadow-[0_6px_16px_rgba(0,0,0,0.35),0_0_0_1px_var(--border)]">
      {stream === "failed" ? (
        <IconVideoOff size={20} stroke={1.8} className="text-muted-foreground" aria-label="Camera unavailable" />
      ) : (
        <video ref={video} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />
      )}
    </div>
  );
}

export function CameraPanel({ state, onChange }: { state: MediaState; onChange: (patch: CapturePatch) => void }) {
  const { settings } = state;
  const placement: Placement = settings.cameraBubble === "recording" ? "page" : "editor";

  const choosePlacement = (next: Placement) => onChange({ cameraBubble: next === "page" ? "recording" : "countdown" });

  return (
    <div className="space-y-2">
      <DeviceSelect
        icon={IconVideo}
        label="Camera"
        kind="camera"
        deviceKind="videoinput"
        value={settings.cameraId}
        state={state}
        onChange={(cameraId) => onChange({ cameraId })}
      />
      {settings.cameraId && (
        <div className="space-y-2 rounded-xl border bg-surface-1 p-2.5">
          <div className="flex items-center gap-3">
            <CameraPreview cameraId={settings.cameraId} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SegmentedControl label="Camera bubble" options={PLACEMENTS} value={placement} onChange={choosePlacement} />
              <p className="text-[11px] leading-snug text-muted-foreground">{PLACEMENT_HINTS[placement]}</p>
            </div>
          </div>
          {placement === "editor" ? (
            <SwitchRow
              label="Bubble during countdown"
              checked={settings.cameraBubble === "countdown"}
              onChange={(on) => onChange({ cameraBubble: on ? "countdown" : "off" })}
            />
          ) : (
            <button
              type="button"
              onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL(CAMERA_SETUP_PAGE) })}
              className="sidebar-choice flex h-8 w-full items-center justify-center gap-1.5 text-[12px]"
            >
              <IconAdjustmentsHorizontal size={14} stroke={1.8} />
              Adjust size, shape and position
            </button>
          )}
        </div>
      )}
    </div>
  );
}
