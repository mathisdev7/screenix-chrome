export type MediaKind = "microphone" | "camera";

export const PERMISSIONS_PAGE = "permissions.html";

export function deviceConstraint(deviceId: string): ConstrainDOMString | undefined {
  return deviceId === "default" ? undefined : { exact: deviceId };
}

export function microphoneConstraints(deviceId: string): MediaTrackConstraints {
  return { deviceId: deviceConstraint(deviceId), echoCancellation: false, noiseSuppression: false, autoGainControl: false };
}

export function cameraConstraints(deviceId: string): MediaTrackConstraints {
  return { deviceId: deviceConstraint(deviceId), width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
}

export async function hasMediaAccess(kind: MediaKind): Promise<boolean> {
  const status = await navigator.permissions.query({ name: kind as PermissionName }).catch(() => null);
  return status?.state === "granted";
}

export function openMediaAccessPage(kinds: readonly MediaKind[]) {
  void chrome.tabs.create({ url: chrome.runtime.getURL(`${PERMISSIONS_PAGE}?kinds=${kinds.join(",")}`) });
}

export async function requestMediaAccess(kinds: readonly MediaKind[]): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: kinds.includes("microphone"),
    video: kinds.includes("camera"),
  });
  stream.getTracks().forEach((track) => track.stop());
}
