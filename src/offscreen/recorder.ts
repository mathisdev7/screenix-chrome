import type { LiveAudioChunk } from "@/instant/liveAudioMixer";
import { OFFSCREEN_TARGET, type BackgroundRequest, type CaptureDevices, type MediaCaptureRequest, type OffscreenRequest, type OffscreenResponse, type RecordedMedia } from "@/shared/messages";
import { cameraConstraints, microphoneConstraints } from "@/shared/mediaAccess";
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

interface OpenDevices extends CaptureDevices {
  microphone: MediaStreamTrack | null;
  camera: MediaStreamTrack | null;
}

let active: ActiveCapture | null = null;
let prepared: OpenDevices | null = null;
let finishing: InstantRecorder | null = null;

async function openMicrophone(deviceId: string): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: microphoneConstraints(deviceId) });
  return stream.getAudioTracks()[0];
}

async function openCamera(deviceId: string): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(deviceId) });
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

function closeDevices(devices: OpenDevices) {
  devices.microphone?.stop();
  devices.camera?.stop();
}

async function openDevices(devices: CaptureDevices): Promise<OpenDevices> {
  const [microphone, camera] = await Promise.allSettled([
    devices.microphoneId ? openMicrophone(devices.microphoneId) : null,
    devices.cameraId ? openCamera(devices.cameraId) : null,
  ]);
  const open: OpenDevices = {
    ...devices,
    microphone: microphone.status === "fulfilled" ? microphone.value : null,
    camera: camera.status === "fulfilled" ? camera.value : null,
  };
  const failure = [microphone, camera].find((result) => result.status === "rejected");
  if (failure) {
    closeDevices(open);
    throw failure.reason;
  }
  return open;
}

function isLive(track: MediaStreamTrack | null): boolean {
  return track === null || track.readyState === "live";
}

function takeDevices(devices: CaptureDevices): Promise<OpenDevices> {
  const ready = prepared;
  prepared = null;
  const matches = ready?.microphoneId === devices.microphoneId && ready.cameraId === devices.cameraId;
  if (ready && matches && isLive(ready.microphone) && isLive(ready.camera)) return Promise.resolve(ready);
  if (ready) closeDevices(ready);
  return openDevices(devices);
}

async function prepare(devices: CaptureDevices) {
  release();
  prepared = await openDevices(devices);
}

function release() {
  if (prepared) closeDevices(prepared);
  prepared = null;
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
    const devices = await takeDevices(capture);
    if (devices.microphone) audio.push(new AudioTrackRecorder(projectId, "microphone", devices.microphone, 1, capture.microphoneGain, startedAt, forward));
    if (devices.camera) camera = new CameraRecorder(projectId, devices.camera, startedAt);
    if (capture.tabStreamId) {
      const tab = await openTabAudio(capture.tabStreamId);
      playback = tab.playback;
      audio.push(new AudioTrackRecorder(projectId, "tab", tab.track, 2, 1, startedAt, forward));
    }
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
  if (!instant) throw new Error("This recording has no instant video to finish.");
  try {
    await instant.finish(duration);
  } finally {
    if (finishing === instant) finishing = null;
  }
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
      case "media/prepare":
        await prepare(request.devices);
        return { ok: true };
      case "media/release":
        release();
        return { ok: true };
      case "media/start":
        await start(request.capture);
        return { ok: true };
      case "media/stop":
        return { ok: true, media: await stop() };
      case "instant/page":
        active?.instant?.addPage(request.page);
        return { ok: true };
      case "instant/finish":
        await finishInstant(request.duration);
        return { ok: true };
      case "instant/cancel":
        finishing?.cancel();
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
