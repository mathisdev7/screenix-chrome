import type { CaptureSettings } from "@/shared/captureSettings";
import { OFFSCREEN_TARGET, type InstantRenderRequest, type OffscreenRequest, type OffscreenResponse, type RecordedMedia } from "@/shared/messages";
import type { ProjectId } from "@/shared/types";

const RECORDER_DOCUMENT = "recorder.html";
const NO_MEDIA: RecordedMedia = { audioTracks: [], camera: null };

async function openRecorderDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: RECORDER_DOCUMENT,
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK, chrome.offscreen.Reason.WORKERS],
    justification: "Records the microphone, camera and tab audio, and renders instant videos, while Screenix records a tab.",
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

function needsRecorderDocument(settings: CaptureSettings): boolean {
  return !!settings.microphoneId || !!settings.cameraId || settings.tabAudio || settings.mode === "instant";
}

export class MediaCapture {
  private constructor() {}

  static async prepare(settings: CaptureSettings): Promise<void> {
    if (!needsRecorderDocument(settings)) return;
    await openRecorderDocument();
    if (!settings.microphoneId && !settings.cameraId) return;
    const devices = { microphoneId: settings.microphoneId, cameraId: settings.cameraId };
    const response = await sendToRecorder({ target: OFFSCREEN_TARGET, type: "media/prepare", devices });
    if (!response.ok) {
      await closeRecorderDocument();
      throw new Error(response.error);
    }
  }

  static async release(): Promise<void> {
    if (!(await chrome.offscreen.hasDocument())) return;
    await sendToRecorder({ target: OFFSCREEN_TARGET, type: "media/release" }).catch(() => undefined);
    await closeRecorderDocument();
  }

  static async start(
    settings: CaptureSettings,
    projectId: ProjectId,
    startedAt: number,
    tabId: number | null,
    instant: InstantRenderRequest | null,
  ): Promise<MediaCapture | null> {
    const tabStreamId = await tabAudioStreamId(settings, tabId);
    if (!settings.microphoneId && !settings.cameraId && !tabStreamId && !instant) {
      await closeRecorderDocument();
      return null;
    }

    await openRecorderDocument();
    const response = await sendToRecorder({
      target: OFFSCREEN_TARGET,
      type: "media/start",
      capture: { projectId, startedAt, microphoneId: settings.microphoneId, microphoneGain: settings.microphoneGain, cameraId: settings.cameraId, tabStreamId, instant },
    });
    if (!response.ok) {
      await closeRecorderDocument();
      throw new Error(response.error);
    }
    return new MediaCapture();
  }

  async stop(): Promise<RecordedMedia> {
    const response = await sendToRecorder({ target: OFFSCREEN_TARGET, type: "media/stop" }).catch(() => null);
    return response?.ok && response.media ? response.media : NO_MEDIA;
  }

  async finishInstant(duration: number): Promise<void> {
    const response = await sendToRecorder({ target: OFFSCREEN_TARGET, type: "instant/finish", duration });
    if (!response.ok) throw new Error(response.error);
  }

  async close(): Promise<void> {
    await closeRecorderDocument();
  }
}
