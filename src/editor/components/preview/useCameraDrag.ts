import { useRef, useState, type PointerEvent, type RefObject } from "react";
import { cameraBubbleRect, cameraPositionAt } from "@/render/cameraBubble";
import type { CameraSettings, SettingsPatch } from "@/shared/settings";

const CLICK_TOLERANCE_PX = 3;

interface DragStart {
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) * canvas.width) / bounds.width,
    y: ((event.clientY - bounds.top) * canvas.height) / bounds.height,
  };
}

function canvasSize(canvas: HTMLCanvasElement) {
  return { width: canvas.width, height: canvas.height };
}

export function useCameraDrag(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: CameraSettings,
  draggable: boolean,
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void,
) {
  const drag = useRef<DragStart | null>(null);
  const suppressClick = useRef(false);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isOverCamera = (event: PointerEvent): boolean => {
    const canvas = canvasRef.current;
    if (!draggable || !canvas || canvas.width === 0) return false;
    const point = canvasPoint(canvas, event);
    const rect = cameraBubbleRect(canvasSize(canvas), camera);
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    if (event.button !== 0 || !canvas || !isOverCamera(event)) return;
    const point = canvasPoint(canvas, event);
    const rect = cameraBubbleRect(canvasSize(canvas), camera);
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: point.x - rect.x, offsetY: point.y - rect.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    const start = drag.current;
    if (!start || !canvas) {
      setHovering(isOverCamera(event));
      return;
    }
    if (!start.moved && Math.hypot(event.clientX - start.pointerX, event.clientY - start.pointerY) < CLICK_TOLERANCE_PX) return;
    start.moved = true;
    const point = canvasPoint(canvas, event);
    onChange({ camera: cameraPositionAt(canvasSize(canvas), camera, point.x - start.offsetX, point.y - start.offsetY) }, "camera.position");
  };

  const endDrag = () => {
    suppressClick.current = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
  };

  const consumeClick = (): boolean => {
    const suppressed = suppressClick.current;
    suppressClick.current = false;
    return suppressed;
  };

  return {
    cursor: dragging ? "grabbing" : hovering && draggable ? "grab" : undefined,
    consumeClick,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onPointerLeave: () => setHovering(false),
    },
  };
}
