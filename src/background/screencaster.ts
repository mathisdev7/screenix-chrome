const PROTOCOL_VERSION = "1.3";
const JPEG_QUALITY = 100;
const MAX_CLOCK_SKEW_MS = 5000;
const STALL_TIMEOUT_MS = 1000;
const WATCHDOG_INTERVAL_MS = 250;
const RESTART_EVENTS = new Set(["Page.frameNavigated", "Page.navigatedWithinDocument", "Page.domContentEventFired", "Page.loadEventFired"]);

export interface ScreencastFrame {
  tabId: number;
  epochMs: number;
  jpegBase64: string;
}

interface ScreencastFrameParams {
  data: string;
  sessionId: number;
  metadata: { timestamp?: number };
}

interface FrameNavigatedParams {
  frame?: { parentId?: string };
}

interface EvaluateResult {
  result: { value: [number, number, number] };
}

function frameEpochMs(timestampSeconds: number | undefined): number {
  const now = Date.now();
  const reported = (timestampSeconds ?? 0) * 1000;
  return Math.abs(reported - now) < MAX_CLOCK_SKEW_MS ? reported : now;
}

function isMainFrameNavigation(method: string, params: object | undefined): boolean {
  if (method !== "Page.frameNavigated") return true;
  return !(params as FrameNavigatedParams | undefined)?.frame?.parentId;
}

const SCREEN_EXPRESSION = "[screen.width, screen.height, devicePixelRatio]";

export class Screencaster {
  private readonly attached = new Set<number>();
  private readonly attaching = new Map<number, Promise<void>>();
  private readonly maxSizes = new Map<number, [number, number]>();
  private readonly watchdog: ReturnType<typeof setInterval>;
  private streamingTabId: number | null = null;
  private lastFrameAt = 0;
  private restarting = false;

  constructor(
    private readonly onFrame: (frame: ScreencastFrame) => void,
    private readonly onCanceledByUser: () => void,
    private readonly maxLongSide: number | null,
  ) {
    chrome.debugger.onEvent.addListener(this.handleEvent);
    chrome.debugger.onDetach.addListener(this.handleDetach);
    this.watchdog = setInterval(this.checkForStall, WATCHDOG_INTERVAL_MS);
  }

  async stream(tabId: number): Promise<boolean> {
    if (this.streamingTabId === tabId) return true;
    if (this.streamingTabId !== null) await this.pause(this.streamingTabId);
    try {
      await this.attach(tabId);
      await this.startScreencast(tabId);
      this.streamingTabId = tabId;
      this.lastFrameAt = performance.now();
      return true;
    } catch {
      this.streamingTabId = null;
      return false;
    }
  }

  async dispose(): Promise<void> {
    clearInterval(this.watchdog);
    chrome.debugger.onEvent.removeListener(this.handleEvent);
    chrome.debugger.onDetach.removeListener(this.handleDetach);
    const tabs = [...this.attached];
    this.attached.clear();
    this.streamingTabId = null;
    await Promise.all(tabs.map((tabId) => chrome.debugger.detach({ tabId }).catch(() => undefined)));
  }

  attach(tabId: number): Promise<void> {
    if (this.attached.has(tabId)) return Promise.resolve();
    let pending = this.attaching.get(tabId);
    if (!pending) {
      pending = this.attachNow(tabId).finally(() => this.attaching.delete(tabId));
      this.attaching.set(tabId, pending);
    }
    return pending;
  }

  private async attachNow(tabId: number) {
    await chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
    this.attached.add(tabId);
    await chrome.debugger.sendCommand({ tabId }, "Page.enable");
  }

  private async maxSize(tabId: number): Promise<[number, number]> {
    const cached = this.maxSizes.get(tabId);
    if (cached) return cached;
    const { result } = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
      expression: SCREEN_EXPRESSION,
      returnByValue: true,
    })) as EvaluateResult;
    const [width, height, pixelRatio] = result.value;
    const longSide = Math.max(width, height) * pixelRatio;
    const scale = this.maxLongSide === null ? 1 : Math.min(1, Math.max(1 / pixelRatio, this.maxLongSide / longSide));
    const size: [number, number] = [Math.round(width * pixelRatio * scale), Math.round(height * pixelRatio * scale)];
    this.maxSizes.set(tabId, size);
    return size;
  }

  private async startScreencast(tabId: number) {
    const [maxWidth, maxHeight] = await this.maxSize(tabId);
    await chrome.debugger.sendCommand({ tabId }, "Page.stopScreencast").catch(() => undefined);
    await chrome.debugger.sendCommand({ tabId }, "Page.startScreencast", {
      format: "jpeg",
      quality: JPEG_QUALITY,
      maxWidth,
      maxHeight,
      everyNthFrame: 1,
    });
  }

  private async restart(tabId: number) {
    if (this.restarting || tabId !== this.streamingTabId) return;
    this.restarting = true;
    this.lastFrameAt = performance.now();
    try {
      await this.startScreencast(tabId).catch(() => undefined);
    } finally {
      this.restarting = false;
    }
  }

  private async pause(tabId: number) {
    this.streamingTabId = null;
    await chrome.debugger.sendCommand({ tabId }, "Page.stopScreencast").catch(() => undefined);
  }

  private readonly checkForStall = () => {
    if (this.streamingTabId === null || performance.now() - this.lastFrameAt < STALL_TIMEOUT_MS) return;
    void this.restart(this.streamingTabId);
  };

  private readonly handleEvent = (source: chrome.debugger.Debuggee, method: string, params?: object) => {
    const tabId = source.tabId;
    if (tabId === undefined || !this.attached.has(tabId)) return;
    if (RESTART_EVENTS.has(method)) {
      if (isMainFrameNavigation(method, params)) void this.restart(tabId);
      return;
    }
    if (method !== "Page.screencastFrame") return;
    const frame = params as ScreencastFrameParams;
    chrome.debugger.sendCommand(source, "Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
    if (tabId !== this.streamingTabId) return;
    this.lastFrameAt = performance.now();
    this.onFrame({ tabId, epochMs: frameEpochMs(frame.metadata.timestamp), jpegBase64: frame.data });
  };

  private readonly handleDetach = (source: chrome.debugger.Debuggee, reason: string) => {
    if (source.tabId === undefined || !this.attached.delete(source.tabId)) return;
    if (source.tabId === this.streamingTabId) this.streamingTabId = null;
    if (reason === "canceled_by_user") this.onCanceledByUser();
  };
}
