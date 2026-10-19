import { useRef, useState } from "react";
import type { EncodedVideo } from "@/export/encoder";
import { exportVideo } from "@/export/exportVideo";
import { TimeMap } from "@/render/timeMap";
import { shareExportOptions } from "@/export/shareOptions";
import { renderThumbnail } from "@/export/thumbnail";
import type { SceneInputs } from "@/render/compositor";
import type { ProjectMedia } from "@/render/projectMedia";
import { checkSharingAccess, ShareError, shareVideo } from "@/share/shareVideo";
import type { ProjectShare } from "@/shared/types";
import { rememberExport, rememberShare, shareableExport } from "../lib/exportCache";

export type ShareState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "rendering"; progress: number }
  | { status: "uploading"; progress: number }
  | { status: "shared"; url: string; copied: boolean }
  | { status: "failed"; message: string; needsPlan: boolean };

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function failure(error: unknown): ShareState {
  return {
    status: "failed",
    message: error instanceof Error ? error.message : String(error),
    needsPlan: error instanceof ShareError && error.needsPlan,
  };
}

export function isSharing(state: ShareState): boolean {
  return state.status === "checking" || state.status === "rendering" || state.status === "uploading";
}

export function useShareLink(media: ProjectMedia, inputs: SceneInputs, onShared: (share: ProjectShare) => void) {
  const [state, setState] = useState<ShareState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const run = async (task: (signal: AbortSignal) => Promise<ProjectShare>) => {
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const share = await task(controller.signal);
      onShared(share);
      setState({ status: "shared", url: share.url, copied: await copyToClipboard(share.url) });
    } catch (error) {
      if (!controller.signal.aborted) setState(failure(error));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const upload = async (video: EncodedVideo, signal: AbortSignal): Promise<ProjectShare> => {
    setState({ status: "uploading", progress: 0 });
    const durationSeconds = TimeMap.fromSettings(inputs.settings, media.project.duration).outputDuration;
    const share = await shareVideo({
      video: video.blob,
      thumbnail: await renderThumbnail(media, inputs).catch(() => null),
      title: media.project.name,
      durationSeconds,
      onProgress: (progress) => setState((current) => (current.status === "uploading" ? { status: "uploading", progress } : current)),
      signal,
    });
    rememberShare(video, share);
    return share;
  };

  const ensureAccess = async (): Promise<boolean> => {
    setState({ status: "checking" });
    try {
      await checkSharingAccess(new AbortController().signal);
      setState({ status: "idle" });
      return true;
    } catch (error) {
      setState(failure(error));
      return false;
    }
  };

  const share = (video: EncodedVideo) => run((signal) => upload(video, signal));

  const shareProject = () => run(async (signal) => {
    setState({ status: "checking" });
    await checkSharingAccess(signal);
    const cached = shareableExport(media.project.id, inputs.settings);
    if (cached?.share) return cached.share;
    let video = cached?.video;
    if (!video) {
      setState({ status: "rendering", progress: 0 });
      const options = await shareExportOptions(inputs.settings, media.source);
      video = await exportVideo(media, inputs, options, false, (progress) => {
        setState((current) => (current.status === "rendering" ? { status: "rendering", progress } : current));
      }, signal);
      rememberExport(media.project.id, inputs.settings, video, false);
    }
    return upload(video, signal);
  });

  const copy = async () => {
    if (state.status !== "shared") return;
    const copied = await copyToClipboard(state.url);
    setState((current) => (current.status === "shared" ? { ...current, copied } : current));
  };

  const reset = () => {
    abortRef.current?.abort();
    setState({ status: "idle" });
  };

  return { state, ensureAccess, share, shareProject, copy, reset };
}
