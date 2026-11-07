import { useEffect, useState } from "react";
import { getAsset } from "@/shared/db";
import { INSTANT_POSTER_ASSET_KEY, INSTANT_STATUS_KEY, INSTANT_VIDEO_ASSET_KEY, readInstantStatus } from "@/shared/instant";
import type { ProjectId } from "@/shared/types";

export type InstantVideoState =
  | { status: "loading" }
  | { status: "rendering"; progress: number; watermarked: boolean }
  | { status: "ready"; video: Blob; poster: Blob | null }
  | { status: "failed"; message: string };

async function readInstantVideo(projectId: ProjectId): Promise<InstantVideoState> {
  const [video, poster, instant] = await Promise.all([
    getAsset(projectId, INSTANT_VIDEO_ASSET_KEY),
    getAsset(projectId, INSTANT_POSTER_ASSET_KEY),
    readInstantStatus(),
  ]);
  if (video) return { status: "ready", video, poster: poster ?? null };
  if (instant?.projectId === projectId && instant.state === "rendering") {
    return { status: "rendering", progress: instant.progress, watermarked: instant.watermarked };
  }
  if (instant?.projectId === projectId && instant.state === "failed") return { status: "failed", message: instant.error };
  return { status: "failed", message: "This recording has no instant video. You can still edit and export it in Studio." };
}

export function useInstantVideo(projectId: ProjectId): InstantVideoState {
  const [state, setState] = useState<InstantVideoState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const load = () => {
      void readInstantVideo(projectId).then((next) => {
        if (active) setState(next);
      });
    };
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session" && INSTANT_STATUS_KEY in changes) load();
    };
    chrome.storage.onChanged.addListener(onChanged);
    load();
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [projectId]);

  return state;
}
