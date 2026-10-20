import type { LiveAudioChunk } from "@/instant/liveAudioMixer";
import { OFFSCREEN_TARGET, type BackgroundRequest, type MediaCaptureRequest, type OffscreenRequest, type OffscreenResponse, type RecordedMedia } from "@/shared/messages";
import type { AudioTrackInfo, AudioTrackKind } from "@/shared/types";
import { AudioTrackRecorder } from "./audioTrackRecorder";
import { CameraRecorder } from "./cameraRecorder";
import { InstantRecorder } from "./instantRecorder";

interface ActiveCapture {
  audio: AudioTrackRecorder[];
  camera: CameraRecorder | null;
  playback: AudioContext | null;
  instant: InstantRecorder | null;
}

let active: ActiveCapture | null = null;
let finishing: InstantRecorder | null = null;

function deviceConstraint(deviceId: string): ConstrainDOMString | undefined {
  return deviceId === "default" ? undefined : { exact: deviceId };
}

async function openMicrophone(deviceId: string): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceConstraint(deviceId), echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  return stream.getAudioTracks()[0];
}

async function openCamera(deviceId: string): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: deviceConstraint(deviceId), width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  });
  return stream.getVideoTracks()[0];
}

async function openTabAudio(streamId: string): Promise<{ track: MediaStreamTrack; playback: AudioContext }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } } as MediaTrackConstraints,
    video: false,
  });
  const playback = new AudioContext();
  playback.createMediaStreamSource(stream).connect(playback.destination);
  return { track: stream.getAudioTracks()[0], playback };
}

function reportProgress(request: BackgroundRequest) {
  void chrome.runtime.sendMessage(request).catch(() => undefined);
}

function startInstant(capture: MediaCaptureRequest): InstantRecorder | null {
  if (!capture.instant) return null;
  const { projectId, startedAt } = capture;
  const audioTracks: AudioTrackKind[] = [];
  if (capture.microphoneId) audioTracks.push("microphone");
  if (capture.tabStreamId) audioTracks.push("tab");
  return new InstantRecorder(
    { ...capture.instant, projectId, startedAt, audioTracks },
    (progress) => reportProgress({ type: "instant/progress", projectId, progress }),
  );
}

async function start(capture: MediaCaptureRequest): Promise<void> {
  const { projectId, startedAt } = capture;
  const instant = startInstant(capture);
  const forward = (chunk: LiveAudioChunk) => instant?.addAudio(chunk);
  const audio: AudioTrackRecorder[] = [];
  let camera: CameraRecorder | null = null;
  let playback: AudioContext | null = null;

  try {
    if (capture.microphoneId) {
      audio.push(new AudioTrackRecorder(projectId, "microphone", await openMicrophone(capture.microphoneId), 1, startedAt, forward));
    }
    if (capture.tabStreamId) {
      const tab = await openTabAudio(capture.tabStreamId);
      playback = tab.playback;
      audio.push(new AudioTrackRecorder(projectId, "tab", tab.track, 2, startedAt, forward));
    }
    if (capture.cameraId) camera = new CameraRecorder(projectId, await openCamera(capture.cameraId), startedAt);
  } catch (error) {
    instant?.cancel();
    await Promise.all([...audio.map((recorder) => recorder.stop()), camera?.stop()]);
    await playback?.close();
    throw error;
  }
  active = { audio, camera, playback, instant };
}

async function stop(): Promise<RecordedMedia> {
  const capture = active;
  active = null;
  if (!capture) return { audioTracks: [], camera: null };
  const [audioTracks, camera] = await Promise.all([
    Promise.all(capture.audio.map((recorder) => recorder.stop())),
    capture.camera?.stop() ?? null,
  ]);
  await capture.playback?.close();
  finishing = capture.instant;
  return { audioTracks: audioTracks.filter((track): track is AudioTrackInfo => track !== null), camera };
}

async function finishInstant(duration: number): Promise<void> {
  const instant = finishing;
  finishing = null;
  if (!instant) throw new Error("This recording has no instant video to finish.");
  await instant.finish(duration);
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Screenix doesn't have access to your microphone or camera. Allow access from the popup and try again.";
  }
  return error instanceof Error ? error.message : String(error);
}

async function handle(request: OffscreenRequest): Promise<OffscreenResponse> {
  try {
    switch (request.type) {
      case "media/start":
        await start(request.capture);
        return { ok: true };
      case "media/stop":
        return { ok: true, media: await stop() };
      case "instant/finish":
        await finishInstant(request.duration);
        return { ok: true };
    }
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

chrome.runtime.onMessage.addListener((message: OffscreenRequest, _sender, sendResponse) => {
  if (message?.target !== OFFSCREEN_TARGET) return;
  void handle(message).then(sendResponse);
  return true;
});
