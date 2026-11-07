import { COUNTDOWN_PORT_NAME, type CountdownCamera, type CountdownCommand, type CountdownReply, type PagePoint } from "@/shared/countdown";
import { handOverCameraBubble, hideCameraBubble, showCameraBubble } from "./cameraBubble";

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
  .dial svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  circle { fill: none; stroke-width: 5; }
  .track { stroke: var(--border); }
  .ring { stroke: url(#gold); stroke-linecap: round; stroke-dasharray: 490; animation: drain 1s linear forwards; }
  .number { position: absolute; inset: 0; display: grid; place-items: center; font-size: 84px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; animation: pop 280ms cubic-bezier(0.16, 1, 0.3, 1); }
  .hint { margin: 0; padding: 6px 12px; border-radius: 999px; background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--border); font-size: 12px; color: var(--muted-foreground); }
  kbd { font: inherit; color: var(--foreground); }
  .bar-note {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%); box-sizing: border-box; width: max-content; max-width: calc(100% - 32px);
    display: flex; align-items: center; gap: 12px; padding: 10px 16px 10px 12px; border-radius: 12px; background: var(--surface-1);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35), inset 0 0 0 1px var(--border);
    font-size: 13px; line-height: 1.4; animation: fade 200ms ease-out 400ms backwards;
  }
  .bar-note p { margin: 0; color: var(--muted-foreground); }
  .bar-note strong { display: block; font-weight: 600; color: var(--foreground); }
  .arrow { flex: none; width: 20px; height: 20px; fill: none; stroke: var(--gold-light); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; animation: nudge 1.2s ease-in-out infinite; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: scale(1.3); } }
  @keyframes nudge { 50% { transform: translateY(-3px); } }
  @keyframes drain { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 490; } }
  .notice { justify-content: flex-start; gap: 12px; box-sizing: border-box; padding: 12px 16px; background: color-mix(in srgb, var(--background) 72%, transparent); pointer-events: auto; }
  .notice .arrow { width: 28px; height: 28px; }
  .card {
    box-sizing: border-box; width: 100%; max-width: 360px; padding: 20px; border-radius: 16px; background: var(--surface-1);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), inset 0 0 0 1px var(--border), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .card h2 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
  .card p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted-foreground); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
  button { height: 34px; padding: 0 14px; border: 0; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--gold-light); outline-offset: 2px; }
  .secondary { background: none; color: var(--muted-foreground); box-shadow: inset 0 0 0 1px var(--border); }
  .secondary:hover { color: var(--foreground); }
  .primary { background: var(--gold); color: #1c1a15; font-weight: 600; }
  .primary:hover { background: var(--gold-light); }
  @media (prefers-reduced-motion: reduce) { .backdrop, .number, .ring, .bar-note, .arrow { animation: none; } }
`;

const COUNTDOWN_MARKUP = `
  <div class="backdrop">
    <div class="bar-note">
      <svg class="arrow" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
      <p><strong>Keep the bar above open</strong>Screenix needs it to record. Cancel stops the recording.</p>
    </div>
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

const NOTICE_MARKUP = `
  <div class="backdrop notice">
    <svg class="arrow" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
    <div class="card" role="alertdialog" aria-labelledby="title" aria-describedby="text">
      <h2 id="title">Keep Chrome's bar above open</h2>
      <p id="text">Screenix needs it to record. Clicking Cancel on it stops the recording.</p>
      <div class="actions">
        <button type="button" class="secondary">Don't show again</button>
        <button type="button" class="primary">Okay</button>
      </div>
    </div>
  </div>
`;

function restartAnimation(element: Element) {
  element.getAnimations().forEach((animation) => {
    animation.cancel();
    animation.play();
  });
}

function mount(markup: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement("screenix-countdown");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>${STYLE}</style>${markup}`;
  document.documentElement.append(host);
  return { host, root };
}

function cancelOnEscape(port: chrome.runtime.Port): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    const reply: CountdownReply = { type: "cancel" };
    port.postMessage(reply);
  };
  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}

function showNotice(port: chrome.runtime.Port): () => void {
  const { host, root } = mount(NOTICE_MARKUP);
  const answer = (hideForever: boolean) => {
    const reply: CountdownReply = { type: "noticed", hideForever };
    port.postMessage(reply);
  };
  const okay = root.querySelector<HTMLButtonElement>(".primary");
  okay?.addEventListener("click", () => answer(false));
  root.querySelector(".secondary")?.addEventListener("click", () => answer(true));
  okay?.focus();
  const stopCancelOnEscape = cancelOnEscape(port);

  return () => {
    stopCancelOnEscape();
    host.remove();
  };
}

function showCountdown(port: chrome.runtime.Port, endsAt: number): () => void {
  const { host, root } = mount(COUNTDOWN_MARKUP);
  const number = root.querySelector(".number");
  const ring = root.querySelector(".ring");

  let shown = -1;
  const tick = () => {
    const left = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
    if (left === shown || !number || !ring) return;
    shown = left;
    number.textContent = String(left);
    restartAnimation(number);
    restartAnimation(ring);
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);
  const stopCancelOnEscape = cancelOnEscape(port);

  return () => {
    window.clearInterval(timer);
    stopCancelOnEscape();
    host.remove();
  };
}

function afterRepaint(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

const port = chrome.runtime.connect({ name: COUNTDOWN_PORT_NAME });
let hide: (() => void) | null = null;
let pointer: PagePoint | null = null;
let camera: CountdownCamera | null = null;

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
  if (command.type === "notice") {
    hide?.();
    hide = showNotice(port);
    return;
  }
  if (command.type === "show") {
    hide?.();
    hide = command.dial ? showCountdown(port, command.endsAt) : null;
    camera = command.camera;
    if (camera) showCameraBubble(camera);
    return;
  }
  hide?.();
  hide = null;
  if (camera?.recorded && command.completed) handOverCameraBubble();
  else hideCameraBubble();
  camera = null;
  stopTrackingPointer();
  afterRepaint(() => {
    const reply: CountdownReply = { type: "hidden", pointer };
    port.postMessage(reply);
  });
});

port.onDisconnect.addListener(() => {
  hide?.();
  if (camera) hideCameraBubble();
  stopTrackingPointer();
});
