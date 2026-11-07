import { firstWorkingEncoder, H264_ENCODERS, type EncoderChoice } from "@/export/encoder";
import type { Size } from "@/render/geometry";

const CANDIDATES = H264_ENCODERS.map((choice): EncoderChoice => ({ ...choice, latency: "realtime" }));

export async function instantEncoderChoice(size: Size, fps: number): Promise<EncoderChoice> {
  const choice = await firstWorkingEncoder(CANDIDATES, size, fps);
  if (!choice) throw new Error("This browser can't encode MP4 video.");
  return choice;
}
