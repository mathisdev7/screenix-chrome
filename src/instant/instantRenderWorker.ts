import type { CursorSprites } from "@/render/cursor/theme";
import { putAsset } from "@/shared/db";
import { INSTANT_POSTER_ASSET_KEY, INSTANT_VIDEO_ASSET_KEY } from "@/shared/instant";
import type { InstantWorkerReply, InstantWorkerRequest } from "./instantWorkerProtocol";
import { LiveRender, type LiveRenderOptions } from "./liveRender";

const scope = self as unknown as {
  postMessage(message: InstantWorkerReply): void;
  addEventListener(type: "message", listener: (event: MessageEvent<InstantWorkerRequest>) => void): void;
};

let render: LiveRender | null = null;
let pendingSprites: { resolve: (sprites: CursorSprites) => void; reject: (error: Error) => void } | null = null;

function requestSprites(width: number): Promise<CursorSprites> {
  return new Promise((resolve, reject) => {
    pendingSprites = { resolve, reject };
    scope.postMessage({ type: "sprites", width });
  });
}

function receiveSprites(sprites: CursorSprites | null) {
  if (sprites) pendingSprites?.resolve(sprites);
  else pendingSprites?.reject(new Error("The cursor images couldn't be loaded."));
  pendingSprites = null;
}

async function start(options: LiveRenderOptions) {
  render = new LiveRender(options, requestSprites, (progress) => scope.postMessage({ type: "progress", progress }));
  try {
    const { video, poster } = await render.run();
    await putAsset({ projectId: options.projectId, key: INSTANT_VIDEO_ASSET_KEY, blob: video.blob });
    if (poster) await putAsset({ projectId: options.projectId, key: INSTANT_POSTER_ASSET_KEY, blob: poster });
    scope.postMessage({ type: "done" });
  } catch (error) {
    scope.postMessage({ type: "failed", error: error instanceof Error ? error.message : String(error) });
  }
}

scope.addEventListener("message", (event) => {
  const request = event.data;
  switch (request.type) {
    case "start":
      void start(request.options);
      break;
    case "sprites":
      receiveSprites(request.sprites);
      break;
    case "audio":
      render?.addAudio(request.chunk);
      break;
    case "finish":
      render?.finish(request.duration);
      break;
  }
});
