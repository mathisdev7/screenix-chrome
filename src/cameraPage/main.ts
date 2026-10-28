import "@fontsource-variable/inter";
import { isCameraPageTokenValid } from "@/shared/cameraPage";
import { readCaptureSettings } from "@/shared/captureSettings";
import { cameraConstraints } from "@/shared/mediaAccess";

const video = document.querySelector("video") as HTMLVideoElement;
const unavailable = document.querySelector("p") as HTMLParagraphElement;

async function showCamera() {
  const [{ cameraId }, allowed] = await Promise.all([
    readCaptureSettings(),
    isCameraPageTokenValid(new URLSearchParams(location.search).get("token")),
  ]);
  if (!cameraId || !allowed) return;
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(cameraId) });
  } catch {
    unavailable.hidden = false;
  }
}

void showCamera();
