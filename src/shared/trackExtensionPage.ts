import { connectPointerTracker } from "@/content/pointerTracking";
import { readRecordingStatus, RECORDING_STATUS_KEY, type RecordingStatus } from "./messages";

function connectWhileRecording(status: RecordingStatus | undefined) {
  if (status?.state === "recording" && !window.__screenixPointerTracker) connectPointerTracker();
}

export function trackPointerOnExtensionPage() {
  void readRecordingStatus().then(connectWhileRecording);
  chrome.storage.session.onChanged.addListener((changes) => {
    connectWhileRecording(changes[RECORDING_STATUS_KEY]?.newValue as RecordingStatus | undefined);
  });
}
