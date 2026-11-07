import type { CountdownCamera, CountdownCommand, CountdownReply, TabPoint } from "@/shared/countdown";

const OVERLAY_SCRIPT = "countdown-overlay.js";
const TICK_MS = 100;
const HIDE_TIMEOUT_MS = 400;
const BADGE_COLOR = "#c8b995";
const BADGE_INK = "#1c1a15";
const BADGE_DEFAULT_INK = "#ffffff";

type Phase = "waiting" | "notice" | "counting" | "finished";

export class Countdown {
  private readonly overlays = new Set<chrome.runtime.Port>();
  private readonly done: Promise<boolean>;
  private settle: (completed: boolean) => void = () => undefined;
  private readonly noticed: Promise<void>;
  private answerNotice: () => void = () => undefined;
  private phase: Phase = "waiting";
  private canceled = false;
  private noticeHiddenForever = false;
  private endsAtMs = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private shown = -1;
  private lastPointer: TabPoint | null = null;

  constructor(private readonly seconds: number, private readonly camera: CountdownCamera | null, private readonly dial: boolean) {
    this.done = new Promise((resolve) => {
      this.settle = resolve;
    });
    this.noticed = new Promise((resolve) => {
      this.answerNotice = resolve;
    });
  }

  async confirm(tabId: number | undefined, notice: boolean): Promise<boolean> {
    if (notice) this.phase = "notice";
    const injected = tabId === undefined
      ? Promise.resolve(false)
      : chrome.scripting.executeScript({ target: { tabId }, files: [OVERLAY_SCRIPT] }).then(() => true, () => false);
    if (notice && await injected) await Promise.race([this.noticed, this.done]);
    return !this.canceled;
  }

  start(): number {
    this.endsAtMs = Date.now() + this.seconds * 1000;
    this.phase = "counting";
    this.overlays.forEach((port) => this.greet(port));
    void Promise.all([
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR }),
      chrome.action.setBadgeTextColor({ color: BADGE_INK }),
    ]);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
    return this.endsAtMs;
  }

  async finish(): Promise<boolean> {
    const completed = await this.done;
    clearInterval(this.timer);
    this.phase = "finished";
    await Promise.all([
      chrome.action.setBadgeText({ text: "" }),
      chrome.action.setBadgeTextColor({ color: BADGE_DEFAULT_INK }),
      this.hideOverlays(completed),
    ]);
    return completed;
  }

  get pointer(): TabPoint | null {
    return this.lastPointer;
  }

  get hidesNoticeForever(): boolean {
    return this.noticeHiddenForever;
  }

  attach(port: chrome.runtime.Port) {
    if (this.phase === "finished") {
      port.disconnect();
      return;
    }
    this.overlays.add(port);
    port.onMessage.addListener((reply: CountdownReply) => {
      if (reply.type === "cancel") this.cancel();
      if (reply.type === "noticed") {
        this.noticeHiddenForever = reply.hideForever;
        this.answerNotice();
      }
    });
    port.onDisconnect.addListener(() => {
      this.overlays.delete(port);
      if (this.overlays.size === 0) this.answerNotice();
    });
    this.greet(port);
  }

  cancel() {
    this.canceled = true;
    this.settle(false);
  }

  private greet(port: chrome.runtime.Port) {
    if (this.phase === "notice") this.post(port, { type: "notice" });
    if (this.phase === "counting") this.post(port, { type: "show", endsAt: this.endsAtMs, camera: this.camera, dial: this.dial });
  }

  private async tick() {
    const left = Math.ceil((this.endsAtMs - Date.now()) / 1000);
    if (left <= 0) {
      this.settle(true);
      return;
    }
    if (!this.dial || left === this.shown) return;
    this.shown = left;
    await chrome.action.setBadgeText({ text: String(left) });
  }

  private hideOverlays(completed: boolean): Promise<unknown> {
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
      this.post(port, { type: "hide", completed });
    })));
  }

  private post(port: chrome.runtime.Port, command: CountdownCommand) {
    port.postMessage(command);
  }
}
