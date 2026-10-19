import { addCameraFrame } from "@/shared/db";
import type { CameraWorkerReply, CameraWorkerRequest } from "./cameraWorkerProtocol";

const JPEG_QUALITY = 0.85;

const scope = self as unknown as {
  postMessage(message: CameraWorkerReply): void;
  addEventListener(type: "message", listener: (event: MessageEvent<CameraWorkerRequest>) => void): void;
};

let canvas: OffscreenCanvas | null = null;
const writes: Promise<void>[] = [];

async function encode(request: Extract<CameraWorkerRequest, { type: "frame" }>) {
  const { frame, projectId, seq, t, width, height } = request;
  canvas ??= new OffscreenCanvas(width, height);
  canvas.getContext("2d")?.drawImage(frame, 0, 0, width, height);
  frame.close();
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  scope.postMessage({ type: "encoded" });
  writes.push(addCameraFrame({ projectId, seq, t, tabId: 0, blob }));
}

scope.addEventListener("message", (event) => {
  const request = event.data;
  if (request.type === "frame") {
    void encode(request);
    return;
  }
  void Promise.all(writes).then(() => scope.postMessage({ type: "flushed" }));
});
