import { addFrame, addPointerBatch, putProject } from "@/shared/db";
import type { PointerPortMessage, TrackerControlMessage } from "@/shared/messages";
import type { CapturedPointerSample, ProjectId, ProjectRecord, TabSegment } from "@/shared/types";
import { readCaptureSettings } from "@/shared/captureSettings";
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
  readonly startedAt = Date.now();
  private readonly screencaster: Screencaster;
  private readonly trackerPorts = new Map<number, chrome.runtime.Port>();
  private readonly pendingWrites = new Set<Promise<void>>();
  private readonly tabSegments: TabSegment[] = [];
  private activeTabId: number | null = null;
  private frameSeq = 0;
  private pointerSeq = 0;
  private sampleFrame: Blob | null = null;
  private media: MediaCapture | null = null;
  private stopped = false;

  constructor(
    private readonly windowId: number,
    onCanceledByUser: () => void,
  ) {
    this.screencaster = new Screencaster(this.handleFrame, onCanceledByUser);
  }

  async start(): Promise<void> {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: this.windowId });
    this.media = await MediaCapture.start(await readCaptureSettings(), this.projectId, this.startedAt, activeTab?.id ?? null);
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
    if (tabId === this.activeTabId && change.status === "complete") void this.follow(tabId);
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
    const start: TrackerControlMessage = { type: "start" };
    port.postMessage(start);
  }

  async abort(): Promise<void> {
    this.stopped = true;
    await this.screencaster.dispose();
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
    const project: ProjectRecord = {
      id: this.projectId,
      name: defaultProjectName(new Date(this.startedAt)),
      createdAt: this.startedAt,
      duration: this.secondsSinceStart(Date.now()),
      width: preview?.width ?? 0,
      height: preview?.height ?? 0,
      frameCount: this.frameSeq,
      tabSegments: this.tabSegments,
      thumbnail: preview?.thumbnail ?? null,
      settings: null,
      audioTracks: recordedMedia?.audioTracks ?? [],
      camera: recordedMedia?.camera ?? null,
    };
    await putProject(project);
    return project;
  }

  private async follow(tabId: number) {
    this.activeTabId = tabId;
    await chrome.scripting.executeScript({ target: { tabId }, files: [TRACKER_SCRIPT] }).catch(() => undefined);
    const capturable = await this.screencaster.stream(tabId);
    if (this.stopped || this.activeTabId !== tabId) return;
    const t = this.secondsSinceStart(Date.now());
    const last = this.tabSegments.at(-1);
    if (last?.tabId !== tabId || last.capturable !== capturable) this.tabSegments.push({ t, tabId, capturable });
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
    this.track(addPointerBatch({
      projectId: this.projectId,
      seq: this.pointerSeq++,
      samples: samples.map(({ epochMs, ...sample }) => ({ ...sample, t: this.secondsSinceStart(epochMs), tabId })),
    }));
  }
}
