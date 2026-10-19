import { IconLayoutGrid, IconPlayerRecordFilled, IconPlayerStopFilled } from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { openLicensePricing, useLicense } from "@/editor/hooks/useLicense";
import { MediaControls } from "./MediaControls";
import {
  RECORDING_STATUS_KEY,
  readRecordingStatus,
  sendBackgroundRequest,
  type BackgroundRequest,
  type RecordingStatus,
} from "@/shared/messages";

const LICENSE_PAGE = "/editor.html?license=1";

function useRecordingStatus(): RecordingStatus {
  const [status, setStatus] = useState<RecordingStatus>({ state: "idle" });

  useEffect(() => {
    void readRecordingStatus().then(setStatus);
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session" && RECORDING_STATUS_KEY in changes) setStatus(changes[RECORDING_STATUS_KEY].newValue as RecordingStatus);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  return status;
}

function useElapsedSeconds(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function Popup() {
  const status = useRecordingStatus();
  const elapsed = useElapsedSeconds(status.state === "recording" ? status.startedAt : null);
  const [error, setError] = useState<string | null>(null);
  const { license, loading: licenseLoading } = useLicense();

  const send = async (request: BackgroundRequest) => {
    const response = await sendBackgroundRequest(request);
    if (response.ok) window.close();
    else setError(response.error);
  };

  const start = async () => {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow.id !== undefined) await send({ type: "recording/start", windowId: currentWindow.id });
  };

  return (
    <div className="screenix-editor w-[280px] space-y-3 p-4">
      <div className="flex items-center gap-2">
        <img src="/icons/icon-32.png" alt="" className="size-5" />
        <span className="text-[13px] font-semibold">Screenix</span>
      </div>

      <MediaControls disabled={status.state !== "idle"} />

      {status.state === "recording" ? (
        <button
          type="button"
          onClick={() => void send({ type: "recording/stop" })}
          className="sidebar-action sidebar-action-danger"
        >
          <IconPlayerStopFilled size={14} />
          Stop recording · <span className="tabular-nums">{formatElapsed(elapsed)}</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={status.state !== "idle"}
          onClick={() => void start()}
          className="sidebar-action"
        >
          <IconPlayerRecordFilled size={14} />
          {status.state === "saving" ? "Saving…" : status.state === "starting" ? "Starting…" : "Start recording"}
        </button>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        Records the active tab and follows you when you switch tabs. Press Alt+Shift+R to start or stop.
      </p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {!licenseLoading && (
        <div className="space-y-2 rounded-lg border bg-surface-1 p-3">
          <p className="flex items-center gap-2 text-[12px]">
            <span className={clsx("size-1.5 shrink-0 rounded-full", license ? "bg-[#70b38f]" : "bg-[#d9a45a]")} />
            <span className="truncate" title={license?.email}>{license ? `Licensed · ${license.email}` : "Free · exports have a watermark"}</span>
          </p>
          {license ? (
            <a href={LICENSE_PAGE} target="_blank" className="block text-[12px] text-ring hover:text-ring/80">
              Manage license
            </a>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={openLicensePricing} className="gold-button h-7 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs">
                Remove watermark
              </button>
              <a href={LICENSE_PAGE} target="_blank" className="whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground">
                Have a license key?
              </a>
            </div>
          )}
        </div>
      )}

      <a href="/editor.html" target="_blank" className="flex items-center gap-1.5 text-[12px] text-ring hover:text-ring/80">
        <IconLayoutGrid size={14} stroke={1.8} />
        Open recordings
      </a>
    </div>
  );
}
