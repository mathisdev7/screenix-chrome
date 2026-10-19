import type { CameraInfo, ProjectId } from "@/shared/types";
import type { CameraWorkerReply, CameraWorkerRequest } from "./cameraWorkerProtocol";

const MAX_FRAME_HEIGHT = 540;
const MIN_FRAME_INTERVAL_MS = 1000 / 30;

const epochNow = () => performance.timeOrigin + performance.now();

export class CameraRecorder {
  private readonly reader: ReadableStreamDefaultReader<VideoFrame>;
  private readonly worker = new Worker(new URL("./cameraEncoderWorker.ts", import.meta.url), { type: "module" });
  private readonly finished: Promise<void>;
  private size: { width: number; height: number } | null = null;
  private encoding = false;
  private lastFrameAt = -Infinity;
  private seq = 0;
  private onFlushed: (() => void) | null = null;

  constructor(
    private readonly projectId: ProjectId,
    private readonly track: MediaStreamTrack,
    private readonly startedAt: number,
  ) {
    this.worker.addEventListener("message", (event: MessageEvent<CameraWorkerReply>) => {
      if (event.data.type === "encoded") this.encoding = false;
      else this.onFlushed?.();
    });
    this.reader = new MediaStreamTrackProcessor<VideoFrame>({ track }).readable.getReader();
    this.finished = this.read();
  }

  async stop(): Promise<CameraInfo | null> {
    await this.reader.cancel().catch(() => undefined);
    this.track.stop();
    await this.finished;
    await new Promise<void>((resolve) => {
      this.onFlushed = resolve;
      this.post({ type: "flush" });
    });
    this.worker.terminate();
    if (!this.size || this.seq === 0) return null;
    return { ...this.size, frameCount: this.seq };
  }

  private async read() {
    for (;;) {
      const { value, done } = await this.reader.read().catch(() => ({ value: undefined, done: true as const }));
      if (done || !value) return;
      this.capture(value);
    }
  }

  private capture(frame: VideoFrame) {
    const now = epochNow();
    if (this.encoding || now - this.lastFrameAt < MIN_FRAME_INTERVAL_MS) {
      frame.close();
      return;
    }
    this.lastFrameAt = now;
    if (!this.size) {
      const scale = Math.min(1, MAX_FRAME_HEIGHT / frame.displayHeight);
      this.size = { width: Math.round(frame.displayWidth * scale), height: Math.round(frame.displayHeight * scale) };
    }
    this.encoding = true;
    const t = Math.max(0, (now - this.startedAt) / 1000);
    this.post({ type: "frame", frame, projectId: this.projectId, seq: this.seq++, t, ...this.size }, [frame]);
  }

  private post(request: CameraWorkerRequest, transfer: Transferable[] = []) {
    this.worker.postMessage(request, transfer);
  }
}
