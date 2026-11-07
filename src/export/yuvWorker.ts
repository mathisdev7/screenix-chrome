import { YuvConverter } from "./yuvConverter";
import type { YuvWorkerReply, YuvWorkerRequest } from "./yuvWorkerProtocol";

const scope = self as unknown as {
  postMessage(message: YuvWorkerReply, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<YuvWorkerRequest>) => void): void;
};

let converter: YuvConverter | null = null;

async function convert(id: number, image: ImageBitmap, timestamp: number, duration: number) {
  try {
    if (!converter) throw new Error("The color converter isn't ready.");
    const frame = await converter.convert(image, timestamp, duration);
    scope.postMessage({ type: "converted", id, frame }, [frame]);
  } catch (error) {
    scope.postMessage({ type: "failed", id, error: error instanceof Error ? error.message : String(error) });
  } finally {
    image.close();
  }
}

scope.addEventListener("message", ({ data }) => {
  if (data.type === "start") {
    converter = YuvConverter.create(data.size);
    scope.postMessage({ type: "started", supported: converter !== null });
  } else {
    void convert(data.id, data.image, data.timestamp, data.duration);
  }
});
