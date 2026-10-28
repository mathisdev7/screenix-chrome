import {
  CAMERA_BUBBLE_MAX_SIZE,
  CAMERA_BUBBLE_MIN_SIZE,
  DEFAULT_CAMERA_BUBBLE_STYLE,
  onCameraBubbleStyleChanged,
  readCameraBubbleStyle,
  writeCameraBubbleStyle,
  type CameraBubbleStyle,
  type PageCameraBubble,
} from "@/shared/cameraBubbleStyle";

const HOST_TAG = "screenix-camera";
const MARGIN = 32;
const HAND_OVER_TIMEOUT_MS = 5000;

const STYLE = `
  :host {
    all: initial; display: block; position: fixed; z-index: 2147483647; border-radius: var(--radius);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08);
  }
  .content {
    display: block; width: 100%; height: 100%; border: 0; border-radius: var(--radius);
    background: #19191b; object-fit: cover; pointer-events: none;
  }
  .handle { position: absolute; inset: 0; border-radius: var(--radius); cursor: grab; touch-action: none; }
  .handle:active { cursor: grabbing; }
  .resize {
    position: absolute; right: var(--resize-inset); bottom: var(--resize-inset); width: 18px; height: 18px;
    border-radius: 50%; background: #f4f4f5; translate: 50% 50%; cursor: nwse-resize; touch-action: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
`;

interface BubbleHost extends HTMLElement {
  bubbleStyle: CameraBubbleStyle;
  handOverTimer?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function freeSpace(size: number) {
  return { width: Math.max(0, window.innerWidth - size - 2 * MARGIN), height: Math.max(0, window.innerHeight - size - 2 * MARGIN) };
}

function render(host: BubbleHost, style: CameraBubbleStyle) {
  const free = freeSpace(style.size);
  const radius = (style.size / 2) * style.roundness;
  host.bubbleStyle = style;
  host.style.width = `${style.size}px`;
  host.style.height = `${style.size}px`;
  host.style.left = `${MARGIN + style.x * free.width}px`;
  host.style.top = `${MARGIN + style.y * free.height}px`;
  host.style.setProperty("--radius", `${radius}px`);
  host.style.setProperty("--resize-inset", `${radius * (1 - Math.SQRT1_2)}px`);
}

function placedAt(style: CameraBubbleStyle, left: number, top: number, size = style.size): CameraBubbleStyle {
  const free = freeSpace(size);
  return {
    ...style,
    size,
    x: free.width > 0 ? clamp((left - MARGIN) / free.width, 0, 1) : 0,
    y: free.height > 0 ? clamp((top - MARGIN) / free.height, 0, 1) : 1,
  };
}

function onDrag(target: HTMLElement, move: (event: PointerEvent, start: DOMRect) => void, done: () => void) {
  let start: { rect: DOMRect; x: number; y: number } | null = null;
  target.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    start = { rect: (target.getRootNode() as ShadowRoot).host.getBoundingClientRect(), x: event.clientX, y: event.clientY };
    target.setPointerCapture(event.pointerId);
  });
  target.addEventListener("pointermove", (event) => {
    if (!start) return;
    const { rect, x, y } = start;
    move(event, new DOMRect(rect.left + event.clientX - x, rect.top + event.clientY - y, rect.width, rect.height));
  });
  const release = () => {
    if (!start) return;
    start = null;
    done();
  };
  target.addEventListener("pointerup", release);
  target.addEventListener("pointercancel", release);
  target.addEventListener("click", (event) => event.stopPropagation());
}

function existingBubble(): BubbleHost | null {
  return document.querySelector<BubbleHost>(HOST_TAG);
}

export function mountCameraBubble(content: HTMLElement, resizable: boolean, style?: CameraBubbleStyle): HTMLElement {
  const host = document.createElement(HOST_TAG) as BubbleHost;
  const root = host.attachShadow({ mode: "closed" });
  const sheet = document.createElement("style");
  sheet.textContent = STYLE;
  content.classList.add("content");
  const handle = document.createElement("div");
  handle.className = "handle";
  root.append(sheet, content, handle);
  render(host, style ?? DEFAULT_CAMERA_BUBBLE_STYLE);
  document.documentElement.append(host);

  let dragging = false;
  const save = () => {
    dragging = false;
    void writeCameraBubbleStyle(host.bubbleStyle).catch(() => undefined);
  };
  onDrag(handle, (_event, moved) => {
    dragging = true;
    render(host, placedAt(host.bubbleStyle, moved.left, moved.top));
  }, save);
  if (resizable) {
    const resize = document.createElement("div");
    resize.className = "resize";
    root.append(resize);
    onDrag(resize, (event) => {
      dragging = true;
      const { left, top } = host.getBoundingClientRect();
      const size = clamp(Math.round(Math.max(event.clientX - left, event.clientY - top)), CAMERA_BUBBLE_MIN_SIZE, CAMERA_BUBBLE_MAX_SIZE);
      render(host, placedAt(host.bubbleStyle, left, top, size));
    }, save);
  }

  const stopListening = onCameraBubbleStyleChanged((next) => {
    if (!host.isConnected) stopListening();
    else if (!dragging) render(host, next);
  });
  const onResize = () => {
    if (host.isConnected) render(host, host.bubbleStyle);
    else window.removeEventListener("resize", onResize);
  };
  window.addEventListener("resize", onResize);
  if (!style) {
    void readCameraBubbleStyle().then((stored) => {
      if (host.isConnected && !dragging) render(host, stored);
    });
  }
  return host;
}

export function showCameraBubble({ url, style }: PageCameraBubble) {
  const existing = existingBubble();
  if (existing) {
    window.clearTimeout(existing.handOverTimer);
    return;
  }
  const frame = document.createElement("iframe");
  frame.allow = "camera";
  frame.src = url;
  mountCameraBubble(frame, false, style);
}

export function hideCameraBubble() {
  existingBubble()?.remove();
}

export function handOverCameraBubble() {
  const host = existingBubble();
  if (host) host.handOverTimer = window.setTimeout(() => host.remove(), HAND_OVER_TIMEOUT_MS);
}
