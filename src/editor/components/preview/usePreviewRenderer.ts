import { useEffect, useRef, type RefObject } from "react";
import { Compositor, type SceneInputs } from "@/render/compositor";
import type { ProjectMedia } from "@/render/projectMedia";
import type { PlaybackClock } from "../../playback/PlaybackClock";

const PREFETCH_FRAMES = 8;

export function usePreviewRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  media: ProjectMedia,
  inputs: SceneInputs,
  clock: PlaybackClock,
) {
  const compositorRef = useRef<Compositor | null>(null);
  const requestRenderRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let scheduled: number | null = null;

    const render = () => {
      scheduled = null;
      const compositor = compositorRef.current;
      if (!compositor || canvas.width === 0 || canvas.height === 0) return;
      const time = clock.time;
      const prefetch = clock.playing ? PREFETCH_FRAMES : 0;
      const frame = media.frames.frameForDisplay(time, prefetch, requestRender);
      const camera = media.camera?.frameForDisplay(time, prefetch, requestRender) ?? null;
      compositor.render(ctx, { width: canvas.width, height: canvas.height }, time, frame, camera);
    };

    const requestRender = () => {
      scheduled ??= requestAnimationFrame(render);
    };
    requestRenderRef.current = requestRender;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const box = entry.devicePixelContentBoxSize?.[0];
      const width = box ? box.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio);
      const height = box ? box.blockSize : Math.round(entry.contentRect.height * devicePixelRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      requestRender();
    });
    resizeObserver.observe(canvas);
    const unsubscribe = clock.subscribe(requestRender);
    requestRender();

    return () => {
      resizeObserver.disconnect();
      unsubscribe();
      if (scheduled !== null) cancelAnimationFrame(scheduled);
      requestRenderRef.current = () => undefined;
    };
  }, [canvasRef, media, clock]);

  useEffect(() => {
    if (compositorRef.current) compositorRef.current.update(inputs);
    else compositorRef.current = new Compositor(inputs);
    requestRenderRef.current();
  }, [inputs]);
}
