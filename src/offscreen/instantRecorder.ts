import type { InstantWorkerReply, InstantWorkerRequest } from "@/instant/instantWorkerProtocol";
import type { LiveAudioChunk } from "@/instant/liveAudioMixer";
import type { LiveRenderOptions } from "@/instant/liveRender";
import { rasterizeCursorSprites } from "@/render/cursor/theme";

export class InstantRecorder {
  private readonly worker = new Worker(new URL("../instant/instantRenderWorker.ts", import.meta.url), { type: "module" });
  private readonly result: Promise<void>;

  constructor(private readonly options: LiveRenderOptions, onProgress: (progress: number) => void) {
    this.result = new Promise((resolve, reject) => {
      this.worker.addEventListener("message", (event: MessageEvent<InstantWorkerReply>) => {
        const reply = event.data;
        switch (reply.type) {
          case "sprites":
            void this.sendSprites(reply.width);
            break;
          case "progress":
            onProgress(reply.progress);
            break;
          case "done":
            resolve();
            break;
          case "failed":
            reject(new Error(reply.error));
            break;
        }
      });
      this.worker.addEventListener("error", (event) => reject(new Error(event.message || "The instant video renderer stopped.")));
    });
    this.result.catch(() => undefined);
    this.post({ type: "start", options });
  }

  addAudio(chunk: LiveAudioChunk) {
    this.post({ type: "audio", chunk });
  }

  async finish(duration: number): Promise<void> {
    this.post({ type: "finish", duration });
    try {
      await this.result;
    } finally {
      this.worker.terminate();
    }
  }

  cancel() {
    this.worker.terminate();
  }

  private async sendSprites(width: number) {
    const sprites = await rasterizeCursorSprites(this.options.settings.cursor.theme, width).catch(() => null);
    this.post({ type: "sprites", sprites }, sprites ? Object.values(sprites).map((sprite) => sprite.image) : []);
  }

  private post(request: InstantWorkerRequest, transfer: Transferable[] = []) {
    this.worker.postMessage(request, transfer);
  }
}
