import type { Size } from "@/render/geometry";
import type { YuvWorkerReply, YuvWorkerRequest } from "./yuvWorkerProtocol";

const WORKER_COUNT = 2;

interface Pending {
  resolve: (frame: VideoFrame) => void;
  reject: (error: Error) => void;
}

class YuvWorker {
  private readonly worker = new Worker(new URL("./yuvWorker.ts", import.meta.url), { type: "module" });
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private onStarted: (supported: boolean) => void = () => undefined;

  constructor() {
    this.worker.addEventListener("message", ({ data }: MessageEvent<YuvWorkerReply>) => this.receive(data));
    this.worker.addEventListener("error", () => this.onStarted(false));
  }

  start(size: Size): Promise<boolean> {
    return new Promise((resolve) => {
      this.onStarted = resolve;
      this.post({ type: "start", size });
    });
  }

  convert(image: ImageBitmap, timestamp: number, duration: number): Promise<VideoFrame> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ type: "convert", id, image, timestamp, duration }, [image]);
    });
  }

  terminate() {
    this.worker.terminate();
    for (const { reject } of this.pending.values()) reject(new Error("The color converter was stopped."));
    this.pending.clear();
  }

  private receive(reply: YuvWorkerReply) {
    if (reply.type === "started") return this.onStarted(reply.supported);
    const pending = this.pending.get(reply.id);
    this.pending.delete(reply.id);
    if (reply.type === "converted") pending?.resolve(reply.frame);
    else pending?.reject(new Error(reply.error));
  }

  private post(message: YuvWorkerRequest, transfer: Transferable[] = []) {
    this.worker.postMessage(message, transfer);
  }
}

export class YuvReader {
  private next = 0;

  private constructor(private readonly workers: YuvWorker[]) {}

  static async create(size: Size): Promise<YuvReader | null> {
    const workers = Array.from({ length: WORKER_COUNT }, () => new YuvWorker());
    const started = await Promise.all(workers.map((worker) => worker.start(size)));
    if (started.every(Boolean)) return new YuvReader(workers);
    for (const worker of workers) worker.terminate();
    return null;
  }

  async read(canvas: OffscreenCanvas, timestamp: number, duration: number): Promise<VideoFrame> {
    const image = await createImageBitmap(canvas);
    const worker = this.workers[this.next];
    this.next = (this.next + 1) % this.workers.length;
    return worker.convert(image, timestamp, duration);
  }

  dispose() {
    for (const worker of this.workers) worker.terminate();
  }
}
