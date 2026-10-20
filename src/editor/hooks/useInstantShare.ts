import { useEffect, useRef, useState } from "react";
import { checkSharingAccess, shareVideo } from "@/share/shareVideo";
import type { ProjectRecord, ProjectShare } from "@/shared/types";
import { copyToClipboard, isSharing, shareFailure, type ShareState } from "./useShareLink";

export function useInstantShare(project: ProjectRecord, video: Blob | null, poster: Blob | null, onShared: (share: ProjectShare) => void) {
  const [state, setState] = useState<ShareState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const showLink = async (url: string) => {
    setState({ status: "shared", url, copied: await copyToClipboard(url) });
  };

  const share = async () => {
    if (isSharing(state)) return;
    if (project.share) {
      await showLink(project.share.url);
      return;
    }
    if (!video) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setState({ status: "checking" });
      await checkSharingAccess(controller.signal);
      setState({ status: "uploading", progress: 0 });
      const shared = await shareVideo({
        video,
        thumbnail: poster,
        title: project.name,
        durationSeconds: project.duration,
        onProgress: (progress) => setState((current) => (current.status === "uploading" ? { status: "uploading", progress } : current)),
        signal: controller.signal,
      });
      onShared(shared);
      await showLink(shared.url);
    } catch (error) {
      if (!controller.signal.aborted) setState(shareFailure(error));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return { state, share };
}
