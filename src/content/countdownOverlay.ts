import { COUNTDOWN_PORT_NAME, type CountdownCommand, type CountdownReply, type PagePoint } from "@/shared/countdown";

const TICK_MS = 100;

const STYLE = `
  :host {
    all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
    --background: #101010; --foreground: #f4f4f5; --muted-foreground: #a1a1aa; --border: #343437;
    --surface-1: #19191b; --gold: #c8b995; --gold-light: #d6c9aa;
    --font-sans: "Inter Variable", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .backdrop {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
    background: color-mix(in srgb, var(--background) 55%, transparent);
    font-family: var(--font-sans); color: var(--foreground);
    animation: fade 160ms ease-out;
  }
  .dial {
    position: relative; width: 168px; height: 168px; border-radius: 50%; background: var(--surface-1);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), inset 0 0 0 1px var(--border), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  circle { fill: none; stroke-width: 5; }
  .track { stroke: var(--border); }
  .ring { stroke: url(#gold); stroke-linecap: round; stroke-dasharray: 490; animation: drain 1s linear forwards; }
  .number { position: absolute; inset: 0; display: grid; place-items: center; font-size: 84px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; animation: pop 280ms cubic-bezier(0.16, 1, 0.3, 1); }
  .hint { margin: 0; padding: 6px 12px; border-radius: 999px; background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--border); font-size: 12px; color: var(--muted-foreground); }
  kbd { font: inherit; color: var(--foreground); }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: scale(1.3); } }
  @keyframes drain { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 490; } }
  @media (prefers-reduced-motion: reduce) { .backdrop, .number, .ring { animation: none; } }
`;

const MARKUP = `
  <div class="backdrop">
    <div class="dial">
      <svg viewBox="0 0 168 168">
        <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--gold-light)" /><stop offset="1" style="stop-color: var(--gold)" /></linearGradient></defs>
        <circle class="track" cx="84" cy="84" r="78" />
        <circle class="ring" cx="84" cy="84" r="78" />
      </svg>
      <span class="number"></span>
    </div>
    <p class="hint">Recording starts soon · <kbd>Esc</kbd> to cancel</p>
  </div>
`;

function restartAnimation(element: Element) {
  element.getAnimations().forEach((animation) => {
    animation.cancel();
    animation.play();
  });
}

function showCountdown(port: chrome.runtime.Port, endsAt: number): () => void {
  const host = document.createElement("screenix-countdown");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>${STYLE}</style>${MARKUP}`;
  const number = root.querySelector(".number");
  const ring = root.querySelector(".ring");
  document.documentElement.append(host);

  let shown = -1;
  const tick = () => {
    const left = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
    if (left === shown || !number || !ring) return;
    shown = left;
    number.textContent = String(left);
    restartAnimation(number);
    restartAnimation(ring);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    const reply: CountdownReply = { type: "cancel" };
    port.postMessage(reply);
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);
  window.addEventListener("keydown", onKeyDown, true);

  return () => {
    window.clearInterval(timer);
    window.removeEventListener("keydown", onKeyDown, true);
    host.remove();
  };
}

function afterRepaint(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

const port = chrome.runtime.connect({ name: COUNTDOWN_PORT_NAME });
let hide: (() => void) | null = null;
let pointer: PagePoint | null = null;

const onPointerMove = (event: PointerEvent) => {
  pointer = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight };
};
const onPointerOut = (event: PointerEvent) => {
  if (event.relatedTarget === null) pointer = null;
};
window.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
window.addEventListener("pointerout", onPointerOut, { capture: true, passive: true });

function stopTrackingPointer() {
  window.removeEventListener("pointermove", onPointerMove, { capture: true });
  window.removeEventListener("pointerout", onPointerOut, { capture: true });
}

port.onMessage.addListener((command: CountdownCommand) => {
  if (command.type === "show") {
    hide?.();
    hide = showCountdown(port, command.endsAt);
    return;
  }
  hide?.();
  hide = null;
  stopTrackingPointer();
  afterRepaint(() => {
    const reply: CountdownReply = { type: "hidden", pointer };
    port.postMessage(reply);
  });
});

port.onDisconnect.addListener(() => {
  hide?.();
  stopTrackingPointer();
});
