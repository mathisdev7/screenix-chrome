import { IconAlertTriangle, IconLayoutGrid, IconPlayerRecordFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { openLicensePricing, useLicense } from "@/editor/hooks/useLicense";
import {
  RECORDING_STATUS_KEY,
  readRecordingStatus,
  sendBackgroundRequest,
  type BackgroundRequest,
  type RecordingStatus,
} from "@/shared/messages";
import type { License } from "@/shared/license";
import { uncapturableReason } from "@/shared/tabCapture";
import { RecordingView } from "./RecordingView";
import { SetupView } from "./SetupView";
import { useMediaState } from "./useMediaState";

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

function LicenseBadge({ license }: { license: License | null }) {
  if (!license) {
    return (
      <button type="button" onClick={openLicensePricing} className="gold-button h-7 shrink-0 rounded-lg px-2.5 text-[11px] font-medium">
        Remove watermark
      </button>
    );
  }
  return (
    <a
      href={LICENSE_PAGE}
      target="_blank"
      title={`Licensed to ${license.email}`}
      className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-muted-foreground hover:bg-surface-1 hover:text-foreground"
    >
      <span className="size-1.5 rounded-full bg-[#70b38f]" />
      Licensed
    </a>
  );
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
    <div className="screenix-editor screenix-popup w-[312px] space-y-3 px-4 py-3.5">
      <header className="flex items-center gap-2">
        <img src="/icons/icon-32.png" alt="" className="size-5" />
        <span className="flex-1 text-[13px] font-semibold">Screenix</span>
        {!licenseLoading && <LicenseBadge license={license} />}
        <a
          href="/editor.html"
          target="_blank"
          title="Open recordings"
          aria-label="Open recordings"
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-surface-1 hover:text-foreground"
        >
          <IconLayoutGrid size={15} stroke={1.8} />
        </a>
      </header>

      {status.state === "idle" ? (
        <>
          {media.state && <SetupView state={media.state} onChange={media.update} />}
          <div className="space-y-2">
            {tabWarning && (
              <p className="flex gap-2 text-[11px] leading-snug text-[#d9a45a]">
                <IconAlertTriangle size={14} className="mt-px shrink-0" />
                <span>{tabWarning} Switch to a website tab first, or the video stays black until you do.</span>
              </p>
            )}
            <button type="button" onClick={() => void start()} className="sidebar-action">
              <IconPlayerRecordFilled size={14} className="text-[#c93c42]" />
              Start recording
              <kbd className="ml-auto font-sans text-[11px] font-normal opacity-60">Alt+Shift+R</kbd>
            </button>
          </div>
        </>
      ) : (
        <RecordingView status={status} onStop={() => void send({ type: "recording/stop" })} />
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {!licenseLoading && !license && (
        <a href={LICENSE_PAGE} target="_blank" className="sidebar-choice flex h-8 items-center justify-center text-[12px] text-muted-foreground! hover:text-foreground!">
          Have a license key?
        </a>
      )}
    </div>
  );
}
