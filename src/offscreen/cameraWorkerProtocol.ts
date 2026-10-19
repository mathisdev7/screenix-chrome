import type { ProjectId } from "@/shared/types";

export type CameraWorkerRequest =
  | { type: "frame"; frame: VideoFrame; projectId: ProjectId; seq: number; t: number; width: number; height: number }
  | { type: "flush" };

export type CameraWorkerReply = { type: "encoded" } | { type: "flushed" };
