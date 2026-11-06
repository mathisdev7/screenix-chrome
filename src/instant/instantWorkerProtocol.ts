import type { BrowserPage } from "@/render/browserBar";
import type { CursorSprites } from "@/render/cursor/theme";
import type { LiveAudioChunk } from "./liveAudioMixer";
import type { LiveRenderOptions } from "./liveRender";

export type InstantWorkerRequest =
  | { type: "start"; options: LiveRenderOptions }
  | { type: "sprites"; sprites: CursorSprites | null }
  | { type: "audio"; chunk: LiveAudioChunk }
  | { type: "page"; page: BrowserPage }
  | { type: "finish"; duration: number };

export type InstantWorkerReply =
  | { type: "sprites"; width: number }
  | { type: "progress"; progress: number }
  | { type: "done" }
  | { type: "failed"; error: string };
