import {
  POINTER_PORT_NAME,
  RECORDING_STATUS_KEY,
  type BackgroundRequest,
  type BackgroundResponse,
  type RecordingStatus,
  type TrackerControlMessage,
} from "@/shared/messages";
import { activateLicenseKey, LicenseActivationError, refreshLicense } from "@/shared/license";
import { RecordingSession } from "./recordingSession";

const LICENSE_REFRESH_ALARM = "license-refresh";
const LICENSE_REFRESH_PERIOD_MINUTES = 12 * 60;

let session: RecordingSession | null = null;
let status: RecordingStatus = { state: "idle" };

async function setStatus(next: RecordingStatus) {
  status = next;
  await chrome.storage.session.set({ [RECORDING_STATUS_KEY]: next });
  const recording = next.state === "recording";
  await chrome.action.setBadgeText({ text: recording ? "REC" : "" });
  if (recording) await chrome.action.setBadgeBackgroundColor({ color: "#e5484d" });
}

async function startRecording(windowId: number) {
  if (status.state !== "idle") return;
  await setStatus({ state: "starting" });
  try {
    const started = new RecordingSession(windowId, () => void stopRecording());
    session = started;
    await started.start().catch(async (error: unknown) => {
      await started.abort();
      throw error;
    });
    await setStatus({ state: "recording", projectId: started.projectId, startedAt: started.startedAt });
  } catch (error) {
    session = null;
    await setStatus({ state: "idle" });
    throw error;
  }
}

async function stopRecording() {
  if (status.state !== "recording" || !session) return;
  const finished = session;
  session = null;
  await setStatus({ state: "saving" });
  try {
    const project = await finished.stop();
    await chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html?project=${project.id}`) });
  } finally {
    await setStatus({ state: "idle" });
  }
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
    }
    return { ok: true };
  } catch (error) {
    const code = error instanceof LicenseActivationError && error.code ? { code: error.code } : {};
    return { ok: false, error: error instanceof Error ? error.message : String(error), ...code };
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
  if (status.state === "recording") {
    await stopRecording();
    return;
  }
  const window = await chrome.windows.getLastFocused();
  if (window.id !== undefined) await startRecording(window.id);
});
