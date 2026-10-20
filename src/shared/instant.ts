import { createDefaultSettings, type EditorSettings } from "./settings";
import type { ProjectId } from "./types";

export type RecordingMode = "studio" | "instant";

export type InstantLook = "full" | "framed";

export const INSTANT_LOOKS: readonly { value: InstantLook; label: string }[] = [
  { value: "full", label: "Edge to edge" },
  { value: "framed", label: "With background" },
];

export const INSTANT_HIDPI_LONG_SIDE = 1920;

export const INSTANT_VIDEO_ASSET_KEY = "instant-video";
export const INSTANT_POSTER_ASSET_KEY = "instant-poster";

export type InstantStatus =
  | { projectId: ProjectId; state: "rendering"; progress: number }
  | { projectId: ProjectId; state: "ready" }
  | { projectId: ProjectId; state: "failed"; error: string };

export const INSTANT_STATUS_KEY = "instantStatus";

export function instantSettings(look: InstantLook): EditorSettings {
  const settings = createDefaultSettings();
  return { ...settings, background: { ...settings.background, enabled: look === "framed" } };
}

export async function readInstantStatus(): Promise<InstantStatus | null> {
  const stored = await chrome.storage.session.get(INSTANT_STATUS_KEY);
  return (stored[INSTANT_STATUS_KEY] as InstantStatus | undefined) ?? null;
}

export async function writeInstantStatus(status: InstantStatus): Promise<void> {
  await chrome.storage.session.set({ [INSTANT_STATUS_KEY]: status });
}
