import type { PageCameraBubble } from "./cameraBubbleStyle";
import type { PagePoint } from "./countdown";
import type { EditorSettings } from "./settings";
import type { AudioTrackInfo, CameraInfo, CapturedPointerSample, PageVisit, ProjectId } from "./types";

export const POINTER_PORT_NAME = "screenix-pointer";

export type PointerPortMessage = { type: "samples"; samples: CapturedPointerSample[] };

export type TrackerControlMessage = { type: "start"; pointer: PagePoint | null; cameraBubble: PageCameraBubble | null } | { type: "stop" };

export type RecordingStatus =
  | { state: "idle" }
  | { state: "starting" }
  | { state: "countdown"; endsAt: number }
  | { state: "recording"; projectId: ProjectId; startedAt: number }
  | { state: "saving" };

export type BackgroundRequest =
  | { type: "recording/start"; windowId: number }
  | { type: "recording/stop" }
  | { type: "license/activate-key"; licenseKey: string }
  | { type: "instant/progress"; projectId: ProjectId; progress: number };

export type BackgroundResponse = { ok: true } | { ok: false; error: string; code?: string; licenseId?: string };

export const RECORDING_STATUS_KEY = "recordingStatus";

export async function readRecordingStatus(): Promise<RecordingStatus> {
  const stored = await chrome.storage.session.get(RECORDING_STATUS_KEY);
  return (stored[RECORDING_STATUS_KEY] as RecordingStatus | undefined) ?? { state: "idle" };
}

export async function sendBackgroundRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage<BackgroundRequest, BackgroundResponse>(request);
}

export const OFFSCREEN_TARGET = "screenix-recorder";

export interface InstantRenderRequest {
  settings: EditorSettings;
  watermarked: boolean;
  autoZoom: boolean;
}

export interface CaptureDevices {
  microphoneId: string | null;
  cameraId: string | null;
}

export interface MediaCaptureRequest extends CaptureDevices {
  projectId: ProjectId;
  microphoneGain: number;
  startedAt: number;
  tabStreamId: string | null;
  instant: InstantRenderRequest | null;
}

export type OffscreenRequest =
  | { target: typeof OFFSCREEN_TARGET; type: "media/prepare"; devices: CaptureDevices }
  | { target: typeof OFFSCREEN_TARGET; type: "media/release" }
  | { target: typeof OFFSCREEN_TARGET; type: "media/start"; capture: MediaCaptureRequest }
  | { target: typeof OFFSCREEN_TARGET; type: "media/stop" }
  | { target: typeof OFFSCREEN_TARGET; type: "instant/page"; page: PageVisit }
  | { target: typeof OFFSCREEN_TARGET; type: "instant/finish"; duration: number };

export interface RecordedMedia {
  audioTracks: AudioTrackInfo[];
  camera: CameraInfo | null;
}

export type OffscreenResponse = { ok: true; media?: RecordedMedia } | { ok: false; error: string };
