import { IconCheck, IconExternalLink, IconLoader2 } from "@tabler/icons-react";
import { SHARES_DASHBOARD_URL } from "@/shared/license";
import type { ShareState } from "../hooks/useShareLink";
import { openLicensePricing } from "../hooks/useLicense";

function openUrl(url: string) {
  void chrome.tabs.create({ url });
}

export function ProgressBar({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-ring transition-[width]" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground">{label}… {Math.round(progress * 100)}%</p>
    </div>
  );
}

export function ShareStatus({ share }: { share: ShareState }) {
  switch (share.status) {
    case "idle":
      return null;
    case "checking":
      return (
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <IconLoader2 size={14} className="animate-spin" />
          Checking your plan…
        </p>
      );
    case "rendering":
      return <ProgressBar label="Rendering" progress={share.progress} />;
    case "uploading":
      return <ProgressBar label="Uploading" progress={share.progress} />;
    case "shared":
      return (
        <div className="space-y-2 rounded-lg border bg-surface-1 p-3">
          <p className="flex items-center gap-2 text-[12px] font-semibold">
            <IconCheck size={14} className="shrink-0 text-[#70b38f]" />
            {share.copied ? "Link copied to your clipboard" : "Your link is ready"}
          </p>
          <button
            type="button"
            onClick={() => openUrl(share.url)}
            className="flex w-full items-center gap-1.5 truncate text-left text-[12px] text-ring hover:text-ring/80"
          >
            <span className="truncate">{share.url}</span>
            <IconExternalLink size={13} className="shrink-0" />
          </button>
          <button type="button" onClick={() => openUrl(SHARES_DASHBOARD_URL)} className="text-[11px] text-muted-foreground hover:text-foreground">
            Manage your links
          </button>
        </div>
      );
    case "failed":
      return (
        <div className="space-y-2">
          <p className="text-[12px] text-destructive">{share.message}</p>
          {share.needsPlan && (
            <button type="button" onClick={openLicensePricing} className="text-[12px] font-medium text-ring hover:text-ring/80">
              See plans with share links
            </button>
          )}
        </div>
      );
  }
}
