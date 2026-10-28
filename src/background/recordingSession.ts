import { autoZoomClips } from "@/editor/lib/zoomClips";
import { separateMediaSettings, type CaptureSettings } from "@/shared/captureSettings";
import { readCameraBubbleStyle, type PageCameraBubble } from "@/shared/cameraBubbleStyle";
import type { TabPoint } from "@/shared/countdown";
import { addFrame, addPointerBatch, putProject } from "@/shared/db";
import { INSTANT_HIDPI_LONG_SIDE, instantSettings } from "@/shared/instant";
import { readLicense } from "@/shared/license";
import type { InstantRenderRequest, PointerPortMessage, TrackerControlMessage } from "@/shared/messages";
import type { CapturedPointerSample, PageVisit, PointerSample, ProjectId, ProjectRecord, TabSegment } from "@/shared/types";
import { MediaCapture } from "./mediaCapture";
import { Screencaster, type ScreencastFrame } from "./screencaster";

const TRACKER_SCRIPT = "pointer-tracker.js";
const TRACKER_REGISTRATION_ID = "screenix-pointer-tracker";
const THUMBNAIL_WIDTH = 480;

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

function defaultProjectName(date: Date): string {
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `Recording ${date.toLocaleDateString()} ${time}`;
}

async function createThumbnail(frame: Blob): Promise<{ thumbnail: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(frame);
  const height = Math.round((bitmap.height / bitmap.width) * THUMBNAIL_WIDTH);
  const canvas = new OffscreenCanvas(THUMBNAIL_WIDTH, height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, THUMBNAIL_WIDTH, height);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { ...result, thumbnail: await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 }) };
}

export class RecordingSession {
  readonly projectId: ProjectId = crypto.randomUUID();
  private readonly screencaster: Screencaster;
  private readonly trackerPorts = new Map<number, chrome.runtime.Port>();
  private readonly pendingWrites = new Set<Promise<void>>();
  private readonly tabSegments: TabSegment[] = [];
  private readonly pages: PageVisit[] = [];
  private readonly presses: PointerSample[] = [];
  private activeTabId: number | null = null;
  private startPointer: TabPoint | null = null;
  private startedAtMs = 0;
  private frameSeq = 0;
  private pointerSeq = 0;
  private sampleFrame: Blob | null = null;
  private media: MediaCapture | null = null;
  private instant: InstantRenderRequest | null = null;
  private stopped = false;

  constructor(
    private readonly windowId: number,
    private readonly capture: CaptureSettings,
    private readonly cameraBubbleUrl: string | null,
    onCanceledByUser: () => void,
  ) {
    this.screencaster = new Screencaster(this.handleFrame, onCanceledByUser, this.isInstant ? INSTANT_HIDPI_LONG_SIDE : null);
  }

  get startedAt(): number {
    return this.startedAtMs;
  }

  get isInstant(): boolean {
    return this.capture.mode === "instant";
  }

  async prepare(tabId: number): Promise<void> {
    await this.screencaster.attach(tabId).catch(() => undefined);
  }

  setStartPointer(pointer: TabPoint | null) {
    this.startPointer = pointer;
  }

  async start(): Promise<void> {
    this.startedAtMs = Date.now();
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: this.windowId });
    if (this.isInstant) {
      this.instant = {
        settings: instantSettings(this.capture.instantLook),
        watermarked: (await readLicense()) === null,
        autoZoom: this.capture.instantZoom,
      };
    }
    this.media = await MediaCapture.start(separateMediaSettings(this.capture), this.projectId, this.startedAt, activeTab?.id ?? null, this.instant);
    await chrome.scripting.unregisterContentScripts({ ids: [TRACKER_REGISTRATION_ID] }).catch(() => undefined);
    await chrome.scripting.registerContentScripts([{
      id: TRACKER_REGISTRATION_ID,
      js: [TRACKER_SCRIPT],
      matches: ["<all_urls>"],
      runAt: "document_start",
      persistAcrossSessions: false,
    }]);
    if (activeTab?.id !== undefined) await this.follow(activeTab.id);
  }

  handleTabActivated(tabId: number, windowId: number) {
    if (windowId === this.windowId && tabId !== this.activeTabId) void this.follow(tabId);
  }

  handleTabUpdated(tabId: number, change: chrome.tabs.OnUpdatedInfo) {
    if (tabId !== this.activeTabId) return;
    if (change.status === "complete") void this.follow(tabId);
    else if (change.url || change.favIconUrl) void this.recordPage(tabId);
  }

  addTrackerPort(port: chrome.runtime.Port) {
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) {
      port.disconnect();
      return;
    }
    this.trackerPorts.get(tabId)?.disconnect();
    this.trackerPorts.set(tabId, port);
    port.onMessage.addListener((message: PointerPortMessage) => this.handlePointerSamples(tabId, message.samples));
    port.onDisconnect.addListener(() => {
      if (this.trackerPorts.get(tabId) === port) this.trackerPorts.delete(tabId);
    });
    const pointer = this.startPointer?.tabId === tabId ? { x: this.startPointer.x, y: this.startPointer.y } : null;
    this.startPointer = null;
    void this.cameraBubbleFor(port).then((cameraBubble) => {
      const start: TrackerControlMessage = { type: "start", pointer, cameraBubble };
      port.postMessage(start);
    });
  }

  private async cameraBubbleFor(port: chrome.runtime.Port): Promise<PageCameraBubble | null> {
    if (!this.cameraBubbleUrl || port.sender?.tab?.windowId !== this.windowId) return null;
    return { url: this.cameraBubbleUrl, style: await readCameraBubbleStyle() };
  }

  async abort(): Promise<void> {
    this.stopped = true;
    await this.screencaster.dispose();
    await this.media?.close();
  }

  async stop(): Promise<ProjectRecord> {
    this.stopped = true;
    const media = this.media?.stop();
    await this.screencaster.dispose();
    await chrome.scripting.unregisterContentScripts({ ids: [TRACKER_REGISTRATION_ID] }).catch(() => undefined);
    const stop: TrackerControlMessage = { type: "stop" };
    for (const port of this.trackerPorts.values()) {
      port.postMessage(stop);
      port.disconnect();
    }
    this.trackerPorts.clear();
    await Promise.all(this.pendingWrites);

    const recordedMedia = await media;
    const preview = this.sampleFrame ? await createThumbnail(this.sampleFrame) : null;
    const duration = this.secondsSinceStart(Date.now());
    const project: ProjectRecord = {
      id: this.projectId,
      name: defaultProjectName(new Date(this.startedAt)),
      createdAt: this.startedAt,
      duration,
      width: preview?.width ?? 0,
      height: preview?.height ?? 0,
      frameCount: this.frameSeq,
      tabSegments: this.tabSegments,
      pages: this.pages,
      thumbnail: preview?.thumbnail ?? null,
      settings: this.instant && { ...this.instant.settings, zoom: this.instant.autoZoom ? autoZoomClips(this.presses, duration, () => crypto.randomUUID()) : [] },
      audioTracks: recordedMedia?.audioTracks ?? [],
      camera: recordedMedia?.camera ?? null,
    };
    await putProject(project);
    if (!this.instant) await this.media?.close();
    return project;
  }

  async finishInstant(duration: number): Promise<void> {
    try {
      if (!this.media) throw new Error("The instant video didn't start.");
      await this.media.finishInstant(duration);
    } finally {
      await this.media?.close();
    }
  }

  private async follow(tabId: number) {
    this.activeTabId = tabId;
    await chrome.scripting.executeScript({ target: { tabId }, files: [TRACKER_SCRIPT] }).catch(() => undefined);
    const capturable = await this.screencaster.stream(tabId);
    if (this.stopped || this.activeTabId !== tabId) return;
    const t = this.secondsSinceStart(Date.now());
    const last = this.tabSegments.at(-1);
    if (last?.tabId !== tabId || last.capturable !== capturable) this.tabSegments.push({ t, tabId, capturable });
    await this.recordPage(tabId);
  }

  private async recordPage(tabId: number) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab?.url || this.stopped || this.activeTabId !== tabId) return;
    const last = this.pages.at(-1);
    const sameSite = last !== undefined && URL.parse(last.url)?.host === URL.parse(tab.url)?.host;
    const favIconUrl = tab.favIconUrl ?? (sameSite ? last.favIconUrl : null);
    if (last?.url === tab.url && last.favIconUrl === favIconUrl) return;
    this.pages.push({ t: this.secondsSinceStart(Date.now()), url: tab.url, favIconUrl });
  }

  private secondsSinceStart(epochMs: number): number {
    return Math.max(0, (epochMs - this.startedAt) / 1000);
  }

  private track(write: Promise<void>) {
    this.pendingWrites.add(write);
    void write.finally(() => this.pendingWrites.delete(write));
  }

  private readonly handleFrame = (frame: ScreencastFrame) => {
    if (this.stopped || frame.tabId !== this.activeTabId) return;
    const blob = base64ToBlob(frame.jpegBase64, "image/jpeg");
    if (this.frameSeq % 30 === 0) this.sampleFrame = blob;
    this.track(addFrame({
      projectId: this.projectId,
      seq: this.frameSeq++,
      t: this.secondsSinceStart(frame.epochMs),
      tabId: frame.tabId,
      blob,
    }));
  };

  private handlePointerSamples(tabId: number, samples: CapturedPointerSample[]) {
    if (this.stopped || samples.length === 0 || tabId !== this.activeTabId) return;
    const timed = samples.map(({ epochMs, ...sample }) => ({ ...sample, t: this.secondsSinceStart(epochMs), tabId }));
    if (this.instant?.autoZoom) this.presses.push(...timed.filter((sample) => sample.kind === "down"));
    this.track(addPointerBatch({ projectId: this.projectId, seq: this.pointerSeq++, samples: timed }));
  }
}
