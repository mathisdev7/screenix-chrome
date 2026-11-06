import type { Size } from "@/render/geometry";
import type { EditorSettings } from "@/shared/settings";
import { encoderSupport, type EncoderChoice } from "./encoder";
import { exportSize, type ExportOptions } from "./exportVideo";

const SHARE_RESOLUTION = "1080";
const SHARE_FPS = 60;
const CANDIDATES: readonly EncoderChoice[] = [
  { format: "mp4-h264", encoder: "hardware" },
  { format: "mp4-h264", encoder: "software" },
  { format: "mp4-av1", encoder: "software" },
  { format: "mp4-av1", encoder: "hardware" },
];

export async function shareExportOptions(settings: EditorSettings, source: Size): Promise<ExportOptions> {
  const size = exportSize(settings, source, SHARE_RESOLUTION);
  for (const choice of CANDIDATES) {
    if ((await encoderSupport(choice, size, SHARE_FPS)).available) return { ...choice, resolution: SHARE_RESOLUTION, fps: SHARE_FPS };
  }
  throw new Error("Your browser can't encode MP4 video, so this recording can't be shared.");
}
