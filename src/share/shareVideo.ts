import { currentLicenseToken } from "@/shared/license";
import type { ProjectShare } from "@/shared/types";
import { SCREENIX_ORIGIN } from "@/shared/screenixOrigin";

const CREATE_URL = `${SCREENIX_ORIGIN}/api/chrome/share/create-upload`;
const CONFIRM_URL = `${SCREENIX_ORIGIN}/api/chrome/share/confirm`;
const CHECK_URL = `${SCREENIX_ORIGIN}/api/chrome/share/check`;
const GET_URL = `${SCREENIX_ORIGIN}/api/chrome/share/get`;
const UPDATE_URL = `${SCREENIX_ORIGIN}/api/chrome/share/update`;
const DELETE_URL = `${SCREENIX_ORIGIN}/api/chrome/share/delete`;
const OFFLINE_MESSAGE = "Couldn't reach Screenix. Check your connection and try again.";

export class ShareError extends Error {
  constructor(message: string, readonly needsPlan: boolean, readonly status = 0) {
    super(message);
  }
}

export interface ShareDetails {
  title: string;
  description: string | null;
  url: string;
}

export interface ShareRequest {
  video: Blob;
  thumbnail: Blob | null;
  title: string;
  durationSeconds: number;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}

interface CreateUploadResponse {
  success: boolean;
  error?: string;
  upgrade?: boolean;
  shareId?: string;
  shareUrl?: string;
  uploadUrl?: string;
  thumbnailUploadUrl?: string | null;
}

async function postJson<T>(url: string, token: string, body: object, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  }).catch((error: unknown) => {
    if (signal.aborted) throw error;
    throw new ShareError(OFFLINE_MESSAGE, false);
  });
  const payload = (await response.json().catch(() => ({}))) as T & { success?: boolean; error?: string; upgrade?: boolean };
  if (!response.ok || payload.success === false) {
    throw new ShareError(payload.error ?? "Something went wrong with this share link.", payload.upgrade === true, response.status);
  }
  return payload;
}

function upload(url: string, blob: Blob, contentType: string, signal: AbortSignal, onProgress?: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new ShareError("The upload was rejected. Try again.", false)));
    request.onerror = () => reject(new ShareError(OFFLINE_MESSAGE, false));
    request.onabort = () => reject(new DOMException("Share canceled", "AbortError"));
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(blob);
  });
}

async function requireToken(): Promise<string> {
  const token = await currentLicenseToken();
  if (!token) throw new ShareError("Shareable links come with a Screenix yearly or team plan.", true);
  return token;
}

export async function checkSharingAccess(signal: AbortSignal): Promise<void> {
  await postJson(CHECK_URL, await requireToken(), {}, signal);
}

export async function shareVideo({ video, thumbnail, title, durationSeconds, onProgress, signal }: ShareRequest): Promise<ProjectShare> {
  const token = await requireToken();

  const created = await postJson<CreateUploadResponse>(CREATE_URL, token, {
    title,
    durationSeconds: Math.max(1, Math.ceil(durationSeconds)),
    fileSizeBytes: video.size,
    thumbnailSizeBytes: thumbnail?.size ?? null,
    uploadRequestId: crypto.randomUUID(),
  }, signal);
  if (!created.shareId || !created.uploadUrl) throw new ShareError("Couldn't create the share link.", false);

  await upload(created.uploadUrl, video, "video/mp4", signal, onProgress);
  if (thumbnail && created.thumbnailUploadUrl) {
    await upload(created.thumbnailUploadUrl, thumbnail, "image/jpeg", signal).catch(() => undefined);
  }

  const confirmed = await postJson<{ shareUrl?: string }>(CONFIRM_URL, token, { shareId: created.shareId }, signal);
  return { id: created.shareId, url: confirmed.shareUrl ?? created.shareUrl ?? "" };
}

async function manageToken(): Promise<string> {
  const token = await currentLicenseToken();
  if (!token) throw new ShareError("Activate your license in this browser to manage this link.", false);
  return token;
}

export async function getShareDetails(shareId: string): Promise<ShareDetails | null> {
  const signal = new AbortController().signal;
  try {
    const details = await postJson<{ title: string; description: string | null; shareUrl: string }>(GET_URL, await manageToken(), { shareId }, signal);
    return { title: details.title, description: details.description, url: details.shareUrl };
  } catch (error) {
    if (error instanceof ShareError && error.status === 404) return null;
    throw error;
  }
}

export async function updateShareDetails(shareId: string, title: string, description: string): Promise<void> {
  await postJson(UPDATE_URL, await manageToken(), { shareId, title, description }, new AbortController().signal);
}

export async function deleteShare(shareId: string): Promise<void> {
  try {
    await postJson(DELETE_URL, await manageToken(), { shareId }, new AbortController().signal);
  } catch (error) {
    if (!(error instanceof ShareError && error.status === 404)) throw error;
  }
}
