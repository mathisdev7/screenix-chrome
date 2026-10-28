const CAMERA_PAGE = "camera.html";
const TOKEN_KEY = "cameraPageToken";

export function cameraPageUrl(token: string): string {
  return chrome.runtime.getURL(`${CAMERA_PAGE}?${new URLSearchParams({ token })}`);
}

export async function issueCameraPageToken(): Promise<string> {
  const token = crypto.randomUUID();
  await chrome.storage.session.set({ [TOKEN_KEY]: token });
  return token;
}

export async function revokeCameraPageToken(): Promise<void> {
  await chrome.storage.session.remove(TOKEN_KEY);
}

export async function isCameraPageTokenValid(token: string | null): Promise<boolean> {
  if (!token) return false;
  const stored = await chrome.storage.session.get(TOKEN_KEY);
  return stored[TOKEN_KEY] === token;
}
