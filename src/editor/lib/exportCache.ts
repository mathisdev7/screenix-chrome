import type { EncodedVideo } from "@/export/encoder";
import type { EditorSettings } from "@/shared/settings";
import type { ProjectShare } from "@/shared/types";

interface CachedExport {
  key: string;
  video: EncodedVideo;
  watermarked: boolean;
  share: ProjectShare | null;
}

let latest: CachedExport | null = null;

function exportKey(projectId: string, settings: EditorSettings): string {
  return `${projectId}:${JSON.stringify(settings)}`;
}

export function rememberExport(projectId: string, settings: EditorSettings, video: EncodedVideo, watermarked: boolean) {
  latest = { key: exportKey(projectId, settings), video, watermarked, share: null };
}

export function shareableExport(projectId: string, settings: EditorSettings): CachedExport | null {
  const cached = latest;
  if (!cached || cached.key !== exportKey(projectId, settings)) return null;
  return !cached.watermarked && cached.video.format === "mp4-h264" ? cached : null;
}

export function rememberShare(video: EncodedVideo, share: ProjectShare) {
  if (latest?.video === video) latest = { ...latest, share };
}

export function forgetShare(shareId: string) {
  if (latest?.share?.id === shareId) latest = { ...latest, share: null };
}
