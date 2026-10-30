import { IconAdjustmentsHorizontal, IconVideo, IconVideoOff } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { SegmentedControl, SwitchRow } from "@/editor/components/controls";
import { cameraConstraints } from "@/shared/mediaAccess";
import { DeviceSource } from "./SourceRow";
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
    <div className="popup-source-tile rounded-full!">
      {stream === "failed" ? (
        <IconVideoOff size={16} stroke={1.8} className="text-muted-foreground" aria-label="Camera unavailable" />
      ) : (
        <video ref={video} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />
      )}
    </div>
  );
}

export function CameraSource({ state, onChange }: { state: MediaState; onChange: (patch: CapturePatch) => void }) {
  const { settings } = state;
  const placement: Placement = settings.cameraBubble === "recording" ? "page" : "editor";

  const choosePlacement = (next: Placement) => onChange({ cameraBubble: next === "page" ? "recording" : "countdown" });

  return (
    <DeviceSource
      kind="camera"
      deviceKind="videoinput"
      icon={IconVideo}
      title="Camera"
      value={settings.cameraId}
      state={state}
      onChange={(cameraId) => onChange({ cameraId })}
      preview={settings.cameraId && <CameraPreview cameraId={settings.cameraId} />}
      summary={PLACEMENTS.find((option) => option.value === placement)?.label}
    >
      <div className="popup-menu-label">Bubble</div>
      <div className="space-y-1.5 px-1 pb-1">
        <SegmentedControl label="Camera bubble" options={PLACEMENTS} value={placement} onChange={choosePlacement} />
        <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">{PLACEMENT_HINTS[placement]}</p>
        {placement === "editor" ? (
          <SwitchRow
            label="Show during countdown"
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
    </DeviceSource>
  );
}
