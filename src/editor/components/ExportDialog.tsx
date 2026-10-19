import { Dialog } from "@base-ui/react/dialog";
import { IconLoader2, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { encoderSupport, FORMAT_LABELS, type EncodedVideo, type EncoderPreference, type EncoderSupport } from "@/export/encoder";
import { saveVideoFile } from "@/export/saveVideo";
import { exportSize, exportVideo, type ExportFrameRate, type ExportOptions, type ExportResolution } from "@/export/exportVideo";
import type { SceneInputs } from "@/render/compositor";
import type { ProjectMedia } from "@/render/projectMedia";
import { ActionButton, SegmentedControl } from "./controls";
import { currentLicense, type License } from "@/shared/license";
import type { ProjectShare } from "@/shared/types";
import { openLicenseDialog, openLicensePricing } from "../hooks/useLicense";
import { isSharing, useShareLink } from "../hooks/useShareLink";
import { rememberExport } from "../lib/exportCache";
import { fileNameFor } from "../lib/format";
import { ShareStatus } from "./ShareStatus";

const RESOLUTIONS = [
  { value: "720", label: "720p" },
  { value: "1080", label: "1080p" },
  { value: "1440", label: "1440p" },
  { value: "2160", label: "4K" },
  { value: "source", label: "Source" },
] as const satisfies readonly { value: ExportResolution; label: string }[];

const FRAME_RATES = [
  { value: "30", label: "30 fps" },
  { value: "60", label: "60 fps" },
  { value: "120", label: "120 fps" },
] as const;

const FORMATS = (["mp4-av1", "mp4-h264", "webm-vp9"] as const).map((value) => ({ value, label: FORMAT_LABELS[value] }));

const ENCODERS = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware (GPU)" },
] as const satisfies readonly { value: EncoderPreference; label: string }[];

function OptionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{title}</span>
      {children}
    </div>
  );
}

function useEncoderSupport(options: ExportOptions, width: number, height: number): EncoderSupport | null {
  const [result, setResult] = useState<{ key: string; support: EncoderSupport } | null>(null);
  const key = `${options.format}:${options.encoder}:${options.fps}:${width}x${height}`;
  useEffect(() => {
    let active = true;
    void encoderSupport(options, { width, height }, options.fps).then((support) => {
      if (active) setResult({ key, support });
    });
    return () => {
      active = false;
    };
  }, [key, options, width, height]);
  return result?.key === key ? result.support : null;
}

type SaveState =
  | { status: "saving" }
  | { status: "saved"; fileName: string }
  | { status: "canceled" }
  | { status: "failed"; message: string };

type ExportIntent = "save" | "share";

const SECONDARY_BUTTON = "min-h-[38px] w-full rounded-[9px] border px-3 text-[12px] font-medium transition-colors hover:bg-accent/70 disabled:opacity-45";

type ExportState =
  | { status: "idle" }
  | { status: "exporting"; progress: number }
  | { status: "done"; video: EncodedVideo; fileName: string; save: SaveState | null }
  | { status: "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function SaveStatus({ save }: { save: SaveState }) {
  switch (save.status) {
    case "saving":
      return (
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <IconLoader2 size={14} className="animate-spin" />
          Opening the save dialog…
        </p>
      );
    case "saved":
      return <p className="text-[12px] text-muted-foreground">Saved {save.fileName}.</p>;
    case "canceled":
      return <p className="text-[12px] text-muted-foreground">Save canceled. Your video is still ready, click Save again.</p>;
    case "failed":
      return <p className="text-[12px] text-destructive">{save.message}</p>;
  }
}

function WatermarkNotice({ exported }: { exported: boolean }) {
  return (
    <div className="space-y-2 rounded-lg border bg-surface-1 p-3">
      <p className="flex items-center gap-2 text-[12px] font-semibold">
        <span className="size-1.5 shrink-0 rounded-full bg-[#d9a45a]" />
        {exported ? "This export includes a watermark" : "This export will include a Screenix watermark"}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {exported
          ? "Get a license or enter your key, then export this project again for a clean video."
          : "Get a license or enter your key once and every export is clean."}
      </p>
      <div className="flex gap-4">
        <button type="button" onClick={openLicensePricing} className="text-[12px] font-medium text-ring hover:text-ring/80">
          Remove watermark
        </button>
        <button type="button" onClick={openLicenseDialog} className="text-[12px] text-muted-foreground hover:text-foreground">
          Have a license key?
        </button>
      </div>
    </div>
  );
}

export function ExportDialog({ open, onOpenChange, media, inputs, license, onShared }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: ProjectMedia;
  inputs: SceneInputs;
  license: License | null;
  onShared: (share: ProjectShare) => void;
}) {
  const [options, setOptions] = useState<ExportOptions>({ resolution: "1080", fps: 60, format: "mp4-av1", encoder: "software" });
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const size = exportSize(inputs.settings, media.source, options.resolution);
  const exporting = state.status === "exporting";
  const support = useEncoderSupport(options, size.width, size.height);
  const shareLink = useShareLink(media, inputs, onShared);
  const shareable = options.format !== "webm-vp9";
  const uploading = isSharing(shareLink.state);

  const start = async (intent: ExportIntent) => {
    shareLink.reset();
    if (intent === "share" && !(await shareLink.ensureAccess())) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "exporting", progress: 0 });
    try {
      const watermarked = !(await currentLicense());
      const video = await exportVideo(media, inputs, options, watermarked, (progress) => {
        setState((current) => (current.status === "exporting" ? { status: "exporting", progress } : current));
      }, controller.signal);
      rememberExport(media.project.id, inputs.settings, video, watermarked);
      const fileName = fileNameFor(media.project.name, video.extension);
      if (intent === "save") await save(video, fileName);
      else {
        setState({ status: "done", video, fileName, save: null });
        await shareLink.share(video);
      }
    } catch (error) {
      if (controller.signal.aborted) setState({ status: "idle" });
      else setState({ status: "error", message: errorMessage(error) });
    } finally {
      abortRef.current = null;
    }
  };

  const save = async (video: EncodedVideo, fileName: string) => {
    setState({ status: "done", video, fileName, save: { status: "saving" } });
    let result: SaveState;
    try {
      result = await saveVideoFile(video.blob, fileName);
    } catch (error) {
      result = { status: "failed", message: errorMessage(error) };
    }
    setState((current) => (current.status === "done" && current.video === video ? { ...current, save: result } : current));
  };

  const close = (next: boolean) => {
    if (next) return onOpenChange(true);
    abortRef.current?.abort();
    shareLink.reset();
    setState({ status: "idle" });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup className="screenix-editor fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-semibold">Export video</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-foreground" aria-label="Close">
              <IconX size={15} stroke={1.8} />
            </Dialog.Close>
          </div>

          <OptionGroup title="Resolution">
            <SegmentedControl
              label="Resolution"
              options={RESOLUTIONS}
              value={options.resolution}
              onChange={(resolution) => setOptions((current) => ({ ...current, resolution }))}
            />
          </OptionGroup>
          <OptionGroup title="Frame rate">
            <SegmentedControl
              label="Frame rate"
              options={FRAME_RATES}
              value={String(options.fps) as (typeof FRAME_RATES)[number]["value"]}
              onChange={(fps) => setOptions((current) => ({ ...current, fps: Number(fps) as ExportFrameRate }))}
            />
          </OptionGroup>
          <OptionGroup title="Format">
            <SegmentedControl label="Format" options={FORMATS} value={options.format} onChange={(format) => setOptions((current) => ({ ...current, format }))} />
          </OptionGroup>
          <OptionGroup title="Encoder">
            <SegmentedControl label="Encoder" options={ENCODERS} value={options.encoder} onChange={(encoder) => setOptions((current) => ({ ...current, encoder }))} />
          </OptionGroup>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Output: {size.width} × {size.height}
            {support?.available === false && <span className="text-destructive"> · This encoder isn't available in your browser at this size.</span>}
            {support?.available && !support.constantQuality && (
              <span className="block pt-1 text-[#d9a45a]">
                This encoder can't run at constant quality here, so dark pages may show blocky trails. MP4 · AV1 gives the cleanest result.
              </span>
            )}
          </p>

          {state.status === "exporting" && (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-ring transition-[width]" style={{ width: `${state.progress * 100}%` }} />
              </div>
              <p className="text-[11px] tabular-nums text-muted-foreground">Rendering… {Math.round(state.progress * 100)}%</p>
            </div>
          )}
          {state.status === "done" && state.save && <SaveStatus save={state.save} />}
          <ShareStatus share={shareLink.state} />
          {!shareable && <p className="text-[11px] text-muted-foreground">Share links need an MP4 format.</p>}
          {license ? (
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-[#70b38f]" />
              <span className="truncate">No watermark · licensed</span>
            </p>
          ) : (
            <WatermarkNotice exported={state.status === "done"} />
          )}
          {state.status === "error" && <p className="text-[12px] text-destructive">{state.message}</p>}

          <div className="flex gap-2">
            {exporting && <ActionButton variant="danger" onClick={() => abortRef.current?.abort()}>Cancel</ActionButton>}
            {uploading && <ActionButton variant="danger" onClick={shareLink.reset}>Cancel upload</ActionButton>}
            {state.status === "done" && !uploading && (
              <>
                <ActionButton disabled={state.save?.status === "saving"} onClick={() => void save(state.video, state.fileName)}>
                  {state.save ? "Save again" : "Save"}
                </ActionButton>
                {shareLink.state.status === "shared" ? (
                  <button type="button" onClick={() => void shareLink.copy()} className={SECONDARY_BUTTON}>Copy link</button>
                ) : (
                  <button
                    type="button"
                    disabled={state.video.extension !== "mp4"}
                    onClick={() => void shareLink.share(state.video)}
                    className={SECONDARY_BUTTON}
                  >
                    Get link
                  </button>
                )}
                <button
                  type="button"
                  disabled={state.save?.status === "saving" || support?.available !== true}
                  onClick={() => void start("save")}
                  className={SECONDARY_BUTTON}
                >
                  Export again
                </button>
              </>
            )}
            {(state.status === "idle" || state.status === "error") && (
              <>
                <ActionButton disabled={support?.available !== true} onClick={() => void start("save")}>Export</ActionButton>
                <button
                  type="button"
                  disabled={support?.available !== true || !shareable}
                  onClick={() => void start("share")}
                  className={SECONDARY_BUTTON}
                >
                  Get share link
                </button>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
