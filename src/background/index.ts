import {
  POINTER_PORT_NAME,
  RECORDING_STATUS_KEY,
  type BackgroundRequest,
  type BackgroundResponse,
  type RecordingStatus,
  type TrackerControlMessage,
} from "@/shared/messages";
import { cameraBubbleOf, readCaptureSettings, separateMediaSettings, type CaptureSettings } from "@/shared/captureSettings";
import { readCameraBubbleStyle } from "@/shared/cameraBubbleStyle";
import { cameraPageUrl, issueCameraPageToken, revokeCameraPageToken } from "@/shared/cameraPage";
import { COUNTDOWN_PORT_NAME, type CountdownCamera } from "@/shared/countdown";
import { readInstantStatus, writeInstantStatus } from "@/shared/instant";
import { activateLicenseKey, LicenseActivationError, refreshLicense } from "@/shared/license";
import type { ProjectId, ProjectRecord } from "@/shared/types";
import { Countdown } from "./countdown";
import { MediaCapture } from "./mediaCapture";
import { RecordingSession } from "./recordingSession";

const LICENSE_REFRESH_ALARM = "license-refresh";
const LICENSE_REFRESH_PERIOD_MINUTES = 12 * 60;
const DEBUGGER_BAR_SETTLE_MS = 500;

let session: RecordingSession | null = null;
let countdown: Countdown | null = null;
let status: RecordingStatus = { state: "idle" };

async function setStatus(next: RecordingStatus) {
  status = next;
  await chrome.storage.session.set({ [RECORDING_STATUS_KEY]: next });
  const recording = next.state === "recording";
  await chrome.action.setBadgeText({ text: recording ? "REC" : "" });
  if (recording) await chrome.action.setBadgeBackgroundColor({ color: "#e5484d" });
}

async function countdownCamera(capture: CaptureSettings, cameraToken: string | null): Promise<CountdownCamera | null> {
  const bubble = cameraBubbleOf(capture);
  if (!cameraToken || bubble === "off") return null;
  return { url: cameraPageUrl(cameraToken), style: await readCameraBubbleStyle(), recorded: bubble === "recording" };
}

function recordedCameraBubbleUrl(capture: CaptureSettings, cameraToken: string | null): string | null {
  return cameraToken && cameraBubbleOf(capture) === "recording" ? cameraPageUrl(cameraToken) : null;
}

async function countDown(windowId: number, capture: CaptureSettings, cameraToken: string | null, upcoming: RecordingSession): Promise<Countdown | null> {
  const running = new Countdown(capture.countdown, await countdownCamera(capture, cameraToken));
  countdown = running;
  try {
    await setStatus({ state: "countdown", endsAt: running.endsAt });
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.id !== undefined) void upcoming.prepare(tab.id);
    const preparing = MediaCapture.prepare(separateMediaSettings(capture)).then(
      () => null,
      (error: unknown) => {
        running.cancel();
        return error instanceof Error ? error : new Error(String(error));
      },
    );
    const completed = await running.run(tab?.id);
    const failure = await preparing;
    if (failure) throw failure;
    if (completed) return running;
    await MediaCapture.release();
    return null;
  } finally {
    countdown = null;
  }
}

async function attachBeforeRecording(windowId: number, upcoming: RecordingSession) {
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id === undefined) return;
  await upcoming.prepare(tab.id);
  await new Promise((resolve) => setTimeout(resolve, DEBUGGER_BAR_SETTLE_MS));
}

async function startRecording(windowId: number) {
  if (status.state !== "idle") return;
  await setStatus({ state: "starting" });
  let started: RecordingSession | null = null;
  try {
    const capture = await readCaptureSettings();
    const cameraToken = capture.cameraId ? await issueCameraPageToken() : null;
    started = new RecordingSession(windowId, capture, recordedCameraBubbleUrl(capture, cameraToken), () => void stopRecording());
    if (capture.countdown > 0) {
      const finished = await countDown(windowId, capture, cameraToken, started);
      if (!finished) {
        await started.abort();
        await revokeCameraPageToken();
        await setStatus({ state: "idle" });
        return;
      }
      started.setStartPointer(finished.pointer);
    } else {
      await attachBeforeRecording(windowId, started);
    }
    await setStatus({ state: "starting" });
    session = started;
    await started.start();
    await setStatus({ state: "recording", projectId: started.projectId, startedAt: started.startedAt });
  } catch (error) {
    session = null;
    await started?.abort();
    await revokeCameraPageToken();
    await setStatus({ state: "idle" });
    throw error;
  }
}

async function stopRecording() {
  countdown?.cancel();
  if (status.state !== "recording" || !session) return;
  const finished = session;
  session = null;
  await revokeCameraPageToken();
  await setStatus({ state: "saving" });
  const project = await finished.stop().catch(async (error: unknown) => {
    await setStatus({ state: "idle" });
    throw error;
  });
  if (!finished.isInstant) {
    await setStatus({ state: "idle" });
    await chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html?project=${project.id}`) });
    return;
  }
  await writeInstantStatus({ projectId: project.id, state: "rendering", progress: 0 });
  void finishInstant(finished, project);
  await chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html?instant=${project.id}`) });
}

async function finishInstant(finished: RecordingSession, project: ProjectRecord) {
  const projectId = project.id;
  try {
    await finished.finishInstant(project.duration);
    await writeInstantStatus({ projectId, state: "ready" });
  } catch (error) {
    await writeInstantStatus({ projectId, state: "failed", error: error instanceof Error ? error.message : String(error) });
  } finally {
    await setStatus({ state: "idle" });
  }
}

async function updateInstantProgress(projectId: ProjectId, progress: number) {
  const current = await readInstantStatus();
  if (current?.projectId === projectId && current.state === "rendering") await writeInstantStatus({ projectId, state: "rendering", progress });
}

async function handleRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  try {
    switch (request.type) {
      case "recording/start":
        await startRecording(request.windowId);
        break;
      case "recording/stop":
        await stopRecording();
        break;
      case "license/activate-key":
        await activateLicenseKey(request.licenseKey);
        break;
      case "instant/progress":
        await updateInstantProgress(request.projectId, request.progress);
        break;
    }
    return { ok: true };
  } catch (error) {
    const details = error instanceof LicenseActivationError
      ? { ...(error.code ? { code: error.code } : {}), ...(error.licenseId ? { licenseId: error.licenseId } : {}) }
      : {};
    return { ok: false, error: error instanceof Error ? error.message : String(error), ...details };
  }
}

void setStatus({ state: "idle" });

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create(LICENSE_REFRESH_ALARM, { delayInMinutes: 1, periodInMinutes: LICENSE_REFRESH_PERIOD_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === LICENSE_REFRESH_ALARM) void refreshLicense();
});

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  void handleRequest(request).then(sendResponse);
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === COUNTDOWN_PORT_NAME) {
    if (countdown) countdown.attach(port);
    else port.disconnect();
    return;
  }
  if (port.name !== POINTER_PORT_NAME) return;
  if (session) {
    session.addTrackerPort(port);
    return;
  }
  const stop: TrackerControlMessage = { type: "stop" };
  port.postMessage(stop);
  port.disconnect();
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => session?.handleTabActivated(tabId, windowId));
chrome.tabs.onUpdated.addListener((tabId, change) => session?.handleTabUpdated(tabId, change));

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-recording") return;
  if (status.state === "recording" || status.state === "countdown") {
    await stopRecording();
    return;
  }
  const window = await chrome.windows.getLastFocused();
  if (window.id !== undefined) await startRecording(window.id);
});
