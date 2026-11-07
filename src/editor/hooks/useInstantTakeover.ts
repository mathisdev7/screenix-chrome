import { useEffect, useEffectEvent, useRef, useState } from "react";
import { firstWorkingEncoder, H264_ENCODERS } from "@/export/encoder";
import { exportSize, exportVideo, type ExportResolution } from "@/export/exportVideo";
import { renderThumbnail } from "@/export/thumbnail";
import { loadProjectMedia, type ProjectMedia } from "@/render/projectMedia";
import { loadSceneInputs } from "@/render/sceneInputs";
import { putAsset } from "@/shared/db";
import type { ProjectRecord } from "@/shared/types";
import { INSTANT_POSTER_ASSET_KEY, INSTANT_VIDEO_ASSET_KEY, writeInstantStatus } from "@/shared/instant";
import { currentLicense } from "@/shared/license";
import { sendBackgroundRequest } from "@/shared/messages";
import { withDefaults } from "@/shared/settings";
import type { InstantVideoState } from "./useInstantVideo";

const OBSERVE_MS = 3000;
const RATE_WINDOW_MS = 4000;
const CHECK_INTERVAL_MS = 1000;
const FPS = 60;
const MAX_SHORT_SIDE = 1440;

export type InstantTakeover =
  | { status: "waiting" }
  | { status: "rendering"; progress: number }
  | { status: "failed"; message: string };

function takeoverResolution(media: ProjectMedia): ExportResolution {
  return Math.min(media.source.width, media.source.height) > MAX_SHORT_SIDE ? "1440" : "source";
}

async function renderInstantVideo(media: ProjectMedia, watermarked: boolean, onProgress: (progress: number) => void, signal: AbortSignal) {
  const inputs = await loadSceneInputs(media, withDefaults(media.project.settings));
  const resolution = takeoverResolution(media);
  const choice = await firstWorkingEncoder(H264_ENCODERS, exportSize(inputs.settings, media.source, resolution), FPS);
  if (!choice) throw new Error("This browser can't encode MP4 video. You can still edit and export it in Studio.");
  const video = await exportVideo(media, inputs, { ...choice, resolution, fps: FPS }, watermarked, onProgress, signal);
  const poster = await renderThumbnail(media, inputs).catch(() => null);
  if (signal.aborted) return;
  const projectId = media.project.id;
  await putAsset({ projectId, key: INSTANT_VIDEO_ASSET_KEY, blob: video.blob });
  if (poster) await putAsset({ projectId, key: INSTANT_POSTER_ASSET_KEY, blob: poster });
  await writeInstantStatus({ projectId, state: "ready" });
}

interface ProgressSample {
  at: number;
  progress: number;
}

function secondsLeft(samples: readonly ProgressSample[], now: number): number {
  const last = samples.at(-1);
  if (!last) return Infinity;
  const first = samples.find((sample) => now - sample.at <= RATE_WINDOW_MS) ?? last;
  const rate = (last.progress - first.progress) / ((now - first.at) / 1000);
  return rate > 0 ? (1 - last.progress) / rate : Infinity;
}

function useTooSlow(progress: number | null, duration: number): boolean {
  const [tooSlow, setTooSlow] = useState(false);
  const samples = useRef<ProgressSample[]>([]);
  const rendering = progress !== null;

  useEffect(() => {
    if (progress !== null) samples.current.push({ at: performance.now(), progress });
  }, [progress]);

  useEffect(() => {
    if (!rendering) return;
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      if (now - startedAt >= OBSERVE_MS && secondsLeft(samples.current, now) > duration) setTooSlow(true);
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [rendering, duration]);

  return tooSlow;
}

export function useInstantTakeover(instant: InstantVideoState, project: ProjectRecord): InstantTakeover {
  const [takeover, setTakeover] = useState<InstantTakeover>({ status: "waiting" });
  const rendering = instant.status === "rendering";
  const tooSlow = useTooSlow(rendering ? instant.progress : null, project.duration);
  const needed = instant.status === "failed" || (rendering && tooSlow);
  const projectId = project.id;

  const handover = useEffectEvent(async () => ({
    watermarked: rendering ? instant.watermarked : !(await currentLicense()),
    from: rendering ? instant.progress : 0,
  }));

  useEffect(() => {
    if (!needed) return;
    const controller = new AbortController();
    let media: ProjectMedia | null = null;
    const report = (next: InstantTakeover) => {
      if (!controller.signal.aborted) setTakeover(next);
    };
    void (async () => {
      try {
        const { watermarked, from } = await handover();
        await sendBackgroundRequest({ type: "instant/cancel", projectId }).catch(() => undefined);
        report({ status: "rendering", progress: from });
        media = await loadProjectMedia(projectId);
        await renderInstantVideo(media, watermarked, (progress) => report({ status: "rendering", progress: from + (1 - from) * progress }), controller.signal);
      } catch (error) {
        report({ status: "failed", message: error instanceof Error ? error.message : String(error) });
      } finally {
        media?.frames.dispose();
        media?.camera?.dispose();
      }
    })();
    return () => controller.abort();
  }, [needed, projectId]);

  return takeover;
}
