import type { CountdownCommand, CountdownReply, TabPoint } from "@/shared/countdown";

const OVERLAY_SCRIPT = "countdown-overlay.js";
const TICK_MS = 100;
const HIDE_TIMEOUT_MS = 400;
const BADGE_COLOR = "#c8b995";
const BADGE_INK = "#1c1a15";
const BADGE_DEFAULT_INK = "#ffffff";

export class Countdown {
  readonly endsAt: number;
  private readonly overlays = new Set<chrome.runtime.Port>();
  private readonly done: Promise<boolean>;
  private settle: (completed: boolean) => void = () => undefined;
  private shown = -1;
  private finished = false;
  private lastPointer: TabPoint | null = null;

  constructor(seconds: number) {
    this.endsAt = Date.now() + seconds * 1000;
    this.done = new Promise((resolve) => {
      this.settle = resolve;
    });
  }

  async run(tabId: number | undefined): Promise<boolean> {
    if (tabId !== undefined) void chrome.scripting.executeScript({ target: { tabId }, files: [OVERLAY_SCRIPT] }).catch(() => undefined);
    await Promise.all([
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR }),
      chrome.action.setBadgeTextColor({ color: BADGE_INK }),
    ]);
    const timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
    const completed = await this.done;
    clearInterval(timer);
    this.finished = true;
    await Promise.all([
      chrome.action.setBadgeText({ text: "" }),
      chrome.action.setBadgeTextColor({ color: BADGE_DEFAULT_INK }),
      this.hideOverlays(),
    ]);
    return completed;
  }

  get pointer(): TabPoint | null {
    return this.lastPointer;
  }

  attach(port: chrome.runtime.Port) {
    if (this.finished) {
      port.disconnect();
      return;
    }
    this.overlays.add(port);
    port.onMessage.addListener((reply: CountdownReply) => {
      if (reply.type === "cancel") this.cancel();
    });
    port.onDisconnect.addListener(() => this.overlays.delete(port));
    this.post(port, { type: "show", endsAt: this.endsAt });
  }

  cancel() {
    this.settle(false);
  }

  private async tick() {
    const left = Math.ceil((this.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      this.settle(true);
      return;
    }
    if (left === this.shown) return;
    this.shown = left;
    await chrome.action.setBadgeText({ text: String(left) });
  }

  private hideOverlays(): Promise<unknown> {
    return Promise.all([...this.overlays].map((port) => new Promise<void>((resolve) => {
      const finish = () => {
        port.disconnect();
        resolve();
      };
      port.onMessage.addListener((reply: CountdownReply) => {
        if (reply.type !== "hidden") return;
        const tabId = port.sender?.tab?.id;
        if (reply.pointer && tabId !== undefined) this.lastPointer = { ...reply.pointer, tabId };
        finish();
      });
      port.onDisconnect.addListener(() => resolve());
      setTimeout(finish, HIDE_TIMEOUT_MS);
      this.post(port, { type: "hide" });
    })));
  }

  private post(port: chrome.runtime.Port, command: CountdownCommand) {
    port.postMessage(command);
  }
}
