import { POINTER_PORT_NAME, type PointerPortMessage, type TrackerControlMessage } from "@/shared/messages";
import type { CursorShape } from "@/shared/cursorShapes";
import type { CapturedPointerSample, PointerEventKind } from "@/shared/types";
import { cursorShapeAt } from "./cursorShape";

const FLUSH_INTERVAL_MS = 100;
const SHAPE_REFRESH_MS = 50;

declare global {
  interface Window {
    __screenixPointerTracker?: boolean;
  }
}

class PointerTracker {
  private buffer: CapturedPointerSample[] = [];
  private flushTimer: number | null = null;
  private shapeTarget: EventTarget | null = null;
  private shapeReadAt = -Infinity;
  private shape: CursorShape = "default";

  constructor(private readonly send: (samples: CapturedPointerSample[]) => void) {}

  start() {
    if (this.flushTimer !== null) return;
    window.addEventListener("pointermove", this.onMove, { capture: true, passive: true });
    window.addEventListener("pointerdown", this.onButton, { capture: true, passive: true });
    window.addEventListener("pointerup", this.onButton, { capture: true, passive: true });
    window.addEventListener("pointerout", this.onOut, { capture: true, passive: true });
    this.flushTimer = window.setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  stop() {
    this.detach();
    this.flush();
  }

  detach() {
    if (this.flushTimer === null) return;
    window.removeEventListener("pointermove", this.onMove, { capture: true });
    window.removeEventListener("pointerdown", this.onButton, { capture: true });
    window.removeEventListener("pointerup", this.onButton, { capture: true });
    window.removeEventListener("pointerout", this.onOut, { capture: true });
    window.clearInterval(this.flushTimer);
    this.flushTimer = null;
  }

  private flush() {
    if (this.buffer.length === 0) return;
    this.send(this.buffer);
    this.buffer = [];
  }

  private currentShape(event: PointerEvent): CursorShape {
    const target = event.composedPath()[0] ?? event.target;
    if (target !== this.shapeTarget || event.timeStamp - this.shapeReadAt >= SHAPE_REFRESH_MS) {
      this.shape = cursorShapeAt(target, event.clientX, event.clientY);
      this.shapeTarget = target;
      this.shapeReadAt = event.timeStamp;
    }
    return this.shape;
  }

  private push(event: PointerEvent, kind: PointerEventKind, shape: CursorShape) {
    this.buffer.push({
      epochMs: performance.timeOrigin + event.timeStamp,
      x: event.clientX / window.innerWidth,
      y: event.clientY / window.innerHeight,
      kind,
      button: event.button,
      shape,
    });
  }

  private readonly onMove = (event: PointerEvent) => {
    const shape = this.currentShape(event);
    const coalesced = event.getCoalescedEvents();
    for (const sample of coalesced.length > 0 ? coalesced : [event]) this.push(sample, "move", shape);
  };

  private readonly onButton = (event: PointerEvent) => {
    this.push(event, event.type === "pointerdown" ? "down" : "up", this.currentShape(event));
    this.flush();
  };

  private readonly onOut = (event: PointerEvent) => {
    if (event.relatedTarget !== null) return;
    this.push(event, "leave", this.shape);
    this.flush();
  };
}

export function connectPointerTracker() {
  window.__screenixPointerTracker = true;
  const port = chrome.runtime.connect({ name: POINTER_PORT_NAME });
  const tracker = new PointerTracker((samples) => {
    const message: PointerPortMessage = { type: "samples", samples };
    port.postMessage(message);
  });
  port.onMessage.addListener((message: TrackerControlMessage) => {
    if (message.type === "start") tracker.start();
    else tracker.stop();
  });
  port.onDisconnect.addListener(() => {
    tracker.detach();
    window.__screenixPointerTracker = false;
  });
}
