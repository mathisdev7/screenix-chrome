import type { Size } from "@/render/geometry";

export type YuvWorkerRequest =
  | { type: "start"; size: Size }
  | { type: "convert"; id: number; image: ImageBitmap; timestamp: number; duration: number };

export type YuvWorkerReply =
  | { type: "started"; supported: boolean }
  | { type: "converted"; id: number; frame: VideoFrame }
  | { type: "failed"; id: number; error: string };
