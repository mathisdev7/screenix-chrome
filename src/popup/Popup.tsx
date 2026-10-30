import { IconAlertTriangle, IconMovie } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLicense } from "@/editor/hooks/useLicense";
import {
  RECORDING_STATUS_KEY,
  readRecordingStatus,
  sendBackgroundRequest,
  type BackgroundRequest,
  type RecordingStatus,
} from "@/shared/messages";
import { uncapturableReason } from "@/shared/tabCapture";
import { LicenseMenu } from "./LicenseMenu";
import { RecordingView } from "./RecordingView";
import { SetupView } from "./SetupView";
import { StartButton } from "./StartButton";
import { useMediaState } from "./useMediaState";

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

function useActiveTabWarning(): string | null {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      chrome.extension.isAllowedFileSchemeAccess(),
    ]).then(([[tab], fileAccess]) => {
      setWarning(tab ? uncapturableReason(tab.url ?? "", chrome.runtime.getURL(""), fileAccess) : null);
    });
  }, []);

  return warning;
}

export function Popup() {
  const status = useRecordingStatus();
  const media = useMediaState();
  const tabWarning = useActiveTabWarning();
  const { license, loading: licenseLoading } = useLicense();
  const [error, setError] = useState<string | null>(null);

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
    <div className="screenix-editor screenix-popup w-[312px] px-3.5 pb-3.5 pt-3">
      <header className="mb-3 flex h-7 items-center gap-1.5">
        <img src="/icons/icon-32.png" alt="" className="mr-0.5 size-5" />
        <span className="flex-1 text-[13px] font-semibold">Screenix</span>
        {!licenseLoading && <LicenseMenu license={license} />}
        <a href="/editor.html" target="_blank" title="Recordings" aria-label="Recordings" className="popup-ghost w-7 justify-center px-0">
          <IconMovie size={15} stroke={1.8} />
        </a>
      </header>

      {status.state === "idle" ? (
        media.state && (
          <div className="space-y-3">
            <SetupView state={media.state} onChange={media.update} />
            {tabWarning && (
              <p className="flex gap-2 px-0.5 text-[11px] leading-snug text-[#d9a45a]">
                <IconAlertTriangle size={14} className="mt-px shrink-0" />
                <span>{tabWarning} Switch to a website tab first, or the video stays black until you do.</span>
              </p>
            )}
            <StartButton
              countdown={media.state.settings.countdown}
              onCountdownChange={(countdown) => media.update({ countdown })}
              onStart={() => void start()}
            />
          </div>
        )
      ) : (
        <RecordingView status={status} onStop={() => void send({ type: "recording/stop" })} />
      )}

      {error && <p className="mt-3 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
