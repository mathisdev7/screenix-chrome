import { useEffect, useMemo, useRef, useState } from "react";
import { autoZoomClips } from "@/editor/lib/zoomClips";
import { BrowserPages } from "@/render/browserBar";
import { Compositor, type SceneInputs } from "@/render/compositor";
import { loadCursorSprites } from "@/render/cursor/theme";
import { buildCursorTimeline } from "@/render/cursor/timeline";
import { outputAspect } from "@/render/geometry";
import { loadWallpaper } from "@/render/wallpapers";
import { ZoomTimeline } from "@/render/zoom/zoomTimeline";
import { cameraBubbleOf, type CaptureSettings } from "@/shared/captureSettings";
import { instantSettings } from "@/shared/instant";
import { cameraConstraints } from "@/shared/mediaAccess";
import { DEMO_DURATION, DEMO_SOURCE, DEMO_URL, demoPage, demoPointer } from "./demoScene";

const DEMO_POINTER = demoPointer();
const DEMO_PAGES = new BrowserPages([{ t: 0, url: DEMO_URL, favicon: null }]);

function useLoaded<K, T>(key: K, load: (key: K) => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let active = true;
    void load(key).then((loaded) => {
      if (active) setValue(loaded);
    });
    return () => {
      active = false;
    };
  }, [key, load]);
  return value;
}

function loadDemoWallpaper(value: string | null): Promise<ImageBitmap | null> {
  return loadWallpaper(value, "").catch(() => null);
}

function useCameraVideo(cameraId: string | null): HTMLVideoElement | null {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!cameraId) return;
    let active = true;
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: cameraConstraints(cameraId) }).then(
      (opened) => {
        if (!active) return opened.getTracks().forEach((track) => track.stop());
        stream = opened;
        const element = document.createElement("video");
        element.muted = true;
        element.playsInline = true;
        element.srcObject = opened;
        void element.play().catch(() => undefined);
        setVideo(element);
      },
      () => undefined,
    );
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      setVideo(null);
    };
  }, [cameraId]);

  return video;
}

export function InstantPreview({ capture }: { capture: CaptureSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { instantLook, instantStyle, instantZoom } = capture;
  const settings = useMemo(() => instantSettings(instantLook, instantStyle), [instantLook, instantStyle]);
  const page = useLoaded(null, demoPage);
  const sprites = useLoaded(settings.cursor.theme, loadCursorSprites);
  const wallpaper = useLoaded(settings.background.wallpaper, loadDemoWallpaper);
  const camera = useCameraVideo(cameraBubbleOf(capture) === "recording" ? null : capture.cameraId);
  const timeline = useMemo(() => buildCursorTimeline(DEMO_POINTER, settings.cursor.speed), [settings.cursor.speed]);
  const zoom = useMemo(
    () => (instantZoom ? ZoomTimeline.build(autoZoomClips(DEMO_POINTER, DEMO_DURATION, () => crypto.randomUUID()), timeline.raw, DEMO_DURATION) : ZoomTimeline.empty),
    [instantZoom, timeline],
  );
  const aspect = outputAspect(settings, DEMO_SOURCE);

  const inputs = useMemo((): SceneInputs | null => (
    sprites ? { settings, source: DEMO_SOURCE, timeline, zoom, sprites, wallpaper, browser: DEMO_PAGES } : null
  ), [settings, timeline, zoom, sprites, wallpaper]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !inputs || !page) return;
    const compositor = new Compositor(inputs);
    let cameraFrame: ImageBitmap | null = null;
    let grabbing = false;
    let scheduled = 0;

    const grabCamera = () => {
      if (!camera || grabbing || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      grabbing = true;
      void createImageBitmap(camera).then((bitmap) => {
        cameraFrame?.close();
        cameraFrame = bitmap;
      }).finally(() => {
        grabbing = false;
      });
    };

    const render = (now: number) => {
      scheduled = requestAnimationFrame(render);
      grabCamera();
      if (canvas.width === 0 || canvas.height === 0) return;
      compositor.render(ctx, { width: canvas.width, height: canvas.height }, (now / 1000) % DEMO_DURATION, page, cameraFrame);
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      const box = entry.devicePixelContentBoxSize?.[0];
      canvas.width = box ? box.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio);
      canvas.height = box ? box.blockSize : Math.round(entry.contentRect.height * devicePixelRatio);
    });
    resizeObserver.observe(canvas);
    scheduled = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(scheduled);
      resizeObserver.disconnect();
      cameraFrame?.close();
    };
  }, [inputs, page, camera]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl ring-1 ring-[var(--editor-preview-ring)]" style={{ aspectRatio: aspect }}>
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
