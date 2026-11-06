import { encoderSupport, type EncoderChoice } from "@/export/encoder";
import type { Size } from "@/render/geometry";

const CANDIDATES: readonly EncoderChoice[] = [
  { format: "mp4-h264", encoder: "hardware", latency: "realtime" },
  { format: "mp4-h264", encoder: "software", latency: "realtime" },
  { format: "mp4-av1", encoder: "hardware", latency: "realtime" },
  { format: "mp4-av1", encoder: "software", latency: "realtime" },
];

export async function instantEncoderChoice(size: Size, fps: number): Promise<EncoderChoice> {
  for (const choice of CANDIDATES) {
    if ((await encoderSupport(choice, size, fps)).available) return choice;
  }
  throw new Error("This browser can't encode MP4 video.");
}
