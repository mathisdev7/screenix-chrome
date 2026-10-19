import type { AudioTrackInfo, CameraInfo, CapturedPointerSample, ProjectId } from "./types";

export const POINTER_PORT_NAME = "screenix-pointer";

export type PointerPortMessage = { type: "samples"; samples: CapturedPointerSample[] };

export type TrackerControlMessage = { type: "start" } | { type: "stop" };

export type RecordingStatus =
  | { state: "idle" }
  | { state: "starting" }
  | { state: "recording"; projectId: ProjectId; startedAt: number }
  | { state: "saving" };

export type BackgroundRequest =
  | { type: "recording/start"; windowId: number }
  | { type: "recording/stop" }
  | { type: "license/activate-key"; licenseKey: string };

export type BackgroundResponse = { ok: true } | { ok: false; error: string };

export const RECORDING_STATUS_KEY = "recordingStatus";

export async function readRecordingStatus(): Promise<RecordingStatus> {
  const stored = await chrome.storage.session.get(RECORDING_STATUS_KEY);
  return (stored[RECORDING_STATUS_KEY] as RecordingStatus | undefined) ?? { state: "idle" };
}

export async function sendBackgroundRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage<BackgroundRequest, BackgroundResponse>(request);
}

export const OFFSCREEN_TARGET = "screenix-recorder";

export interface MediaCaptureRequest {
  projectId: ProjectId;
  startedAt: number;
  microphoneId: string | null;
  cameraId: string | null;
  tabStreamId: string | null;
}

export type OffscreenRequest =
  | { target: typeof OFFSCREEN_TARGET; type: "media/start"; capture: MediaCaptureRequest }
  | { target: typeof OFFSCREEN_TARGET; type: "media/stop" };

export interface RecordedMedia {
  audioTracks: AudioTrackInfo[];
  camera: CameraInfo | null;
}

export type OffscreenResponse = ({ ok: true } & RecordedMedia) | { ok: false; error: string };
