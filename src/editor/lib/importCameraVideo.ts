import { replaceCameraFrames } from "@/shared/db";
import type { CameraInfo, FrameRecord, ProjectRecord } from "@/shared/types";

const FRAME_RATE = 30;
const MAX_FRAME_HEIGHT = 540;
const JPEG_QUALITY = 0.85;
const SEEK_TOLERANCE_SECONDS = 0.0005;

function waitFor(video: HTMLVideoElement, event: "loadeddata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Chrome can't play this video. Try an MP4 or WebM file."));
    };
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
  });
}

async function seek(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < SEEK_TOLERANCE_SECONDS) return;
  const seeked = waitFor(video, "seeked");
  video.currentTime = time;
  await seeked;
}

function frameSize(video: HTMLVideoElement): { width: number; height: number } {
  const scale = Math.min(1, MAX_FRAME_HEIGHT / video.videoHeight);
  const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return { width: even(video.videoWidth), height: even(video.videoHeight) };
}

export async function importCameraVideo(
  project: ProjectRecord,
  file: File,
  onProgress: (progress: number) => void,
): Promise<CameraInfo> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  const loaded = waitFor(video, "loadeddata");
  video.src = url;
  try {
    await loaded;
    if (!video.videoWidth || !Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("This file has no video to use as a camera.");
    }
    const { width, height } = frameSize(video);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a drawing surface for the camera.");

    const frameCount = Math.max(1, Math.ceil(project.duration * FRAME_RATE));
    const sourceFrameCount = Math.max(1, Math.floor(video.duration * FRAME_RATE));
    const encoded = new Map<number, Blob>();
    const frames: FrameRecord[] = [];
    for (let seq = 0; seq < frameCount; seq++) {
      const sourceFrame = seq % sourceFrameCount;
      let blob = encoded.get(sourceFrame);
      if (!blob) {
        await seek(video, sourceFrame / FRAME_RATE);
        ctx.drawImage(video, 0, 0, width, height);
        blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
        encoded.set(sourceFrame, blob);
      }
      frames.push({ projectId: project.id, seq, t: seq / FRAME_RATE, tabId: 0, blob });
      onProgress((seq + 1) / frameCount);
    }
    await replaceCameraFrames(project.id, frames);
    return { width, height, frameCount };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
