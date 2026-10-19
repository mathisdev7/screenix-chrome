import { capturesMedia, type CaptureSettings } from "@/shared/captureSettings";
import { OFFSCREEN_TARGET, type OffscreenRequest, type OffscreenResponse, type RecordedMedia } from "@/shared/messages";
import type { ProjectId } from "@/shared/types";

const RECORDER_DOCUMENT = "recorder.html";
const NO_MEDIA: RecordedMedia = { audioTracks: [], camera: null };

async function openRecorderDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: RECORDER_DOCUMENT,
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Records the microphone, camera and tab audio while Screenix records a tab.",
  });
}

async function closeRecorderDocument() {
  if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
}

function sendToRecorder(request: OffscreenRequest): Promise<OffscreenResponse> {
  return chrome.runtime.sendMessage<OffscreenRequest, OffscreenResponse>(request);
}

async function tabAudioStreamId(settings: CaptureSettings, tabId: number | null): Promise<string | null> {
  if (!settings.tabAudio || tabId === null) return null;
  return chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }).catch(() => null);
}

export class MediaCapture {
  private constructor() {}

  static async start(settings: CaptureSettings, projectId: ProjectId, startedAt: number, tabId: number | null): Promise<MediaCapture | null> {
    if (!capturesMedia(settings)) return null;
    const tabStreamId = await tabAudioStreamId(settings, tabId);
    if (!settings.microphoneId && !settings.cameraId && !tabStreamId) return null;

    await openRecorderDocument();
    const response = await sendToRecorder({
      target: OFFSCREEN_TARGET,
      type: "media/start",
      capture: { projectId, startedAt, microphoneId: settings.microphoneId, cameraId: settings.cameraId, tabStreamId },
    });
    if (!response.ok) {
      await closeRecorderDocument();
      throw new Error(response.error);
    }
    return new MediaCapture();
  }

  async stop(): Promise<RecordedMedia> {
    const response = await sendToRecorder({ target: OFFSCREEN_TARGET, type: "media/stop" }).catch(() => null);
    await closeRecorderDocument();
    return response?.ok ? { audioTracks: response.audioTracks, camera: response.camera } : NO_MEDIA;
  }
}
