import { IconPlayerStopFilled, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { RecordingStatus } from "@/shared/messages";

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function StatusCard({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-surface-1 px-4 py-5">
      <span className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
        {live && <span className="size-2 animate-pulse rounded-full bg-[#e5484d]" />}
        {label}
      </span>
      <span className="text-[34px] font-semibold leading-none tabular-nums tracking-tight">{value}</span>
    </div>
  );
}

export function RecordingView({ status, onStop }: { status: Exclude<RecordingStatus, { state: "idle" }>; onStop: () => void }) {
  const now = useNow(100);

  if (status.state === "recording") {
    return (
      <div className="space-y-3">
        <StatusCard label="Recording" value={formatElapsed(Math.max(0, Math.floor((now - status.startedAt) / 1000)))} live />
        <button type="button" onClick={onStop} className="sidebar-action sidebar-action-danger">
          <IconPlayerStopFilled size={14} />
          Stop recording
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          Or press <kbd className="font-sans text-foreground">Alt+Shift+R</kbd> on any tab.
        </p>
      </div>
    );
  }

  if (status.state === "countdown") {
    return (
      <div className="space-y-3">
        <StatusCard label="Starting in" value={String(Math.max(1, Math.ceil((status.endsAt - now) / 1000)))} live={false} />
        <button type="button" onClick={onStop} className="sidebar-action">
          <IconX size={14} />
          Cancel
        </button>
      </div>
    );
  }

  return <StatusCard label={status.state === "saving" ? "Saving your recording" : "Starting"} value="…" live={false} />;
}
