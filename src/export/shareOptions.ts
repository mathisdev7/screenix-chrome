import type { Size } from "@/render/geometry";
import type { EditorSettings } from "@/shared/settings";
import { firstWorkingEncoder, H264_ENCODERS } from "./encoder";
import { exportSize, type ExportOptions } from "./exportVideo";

const SHARE_RESOLUTION = "1080";
const SHARE_FPS = 60;

export async function shareExportOptions(settings: EditorSettings, source: Size): Promise<ExportOptions> {
  const size = exportSize(settings, source, SHARE_RESOLUTION);
  const choice = await firstWorkingEncoder(H264_ENCODERS, size, SHARE_FPS);
  if (choice) return { ...choice, resolution: SHARE_RESOLUTION, fps: SHARE_FPS };
  throw new Error("Your browser can't encode MP4 video, so this recording can't be shared.");
}
