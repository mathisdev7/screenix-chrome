import type { CursorShape } from "./cursorShapes";
import type { EditorSettings } from "./settings";

export type ProjectId = string;

export type PointerEventKind = "move" | "down" | "up" | "leave";

export interface PointerSample {
  t: number;
  x: number;
  y: number;
  kind: PointerEventKind;
  button: number;
  shape: CursorShape;
  tabId: number;
}

export interface CapturedPointerSample extends Omit<PointerSample, "t" | "tabId"> {
  epochMs: number;
}

export interface FrameRecord {
  projectId: ProjectId;
  seq: number;
  t: number;
  tabId: number;
  blob: Blob;
}

export interface PointerBatchRecord {
  projectId: ProjectId;
  seq: number;
  samples: PointerSample[];
}

export interface TabSegment {
  t: number;
  tabId: number;
  capturable: boolean;
}

export type AudioTrackKind = "microphone" | "tab";

export interface AudioTrackInfo {
  kind: AudioTrackKind;
  startT: number;
  sampleRate: number;
  channels: number;
  frameCount: number;
}

export interface AudioChunkRecord {
  projectId: ProjectId;
  track: AudioTrackKind;
  seq: number;
  samples: Int16Array<ArrayBuffer>;
}

export interface CameraInfo {
  width: number;
  height: number;
  frameCount: number;
}

export interface ProjectRecord {
  id: ProjectId;
  name: string;
  createdAt: number;
  duration: number;
  width: number;
  height: number;
  frameCount: number;
  tabSegments: TabSegment[];
  thumbnail: Blob | null;
  settings: EditorSettings | null;
  audioTracks?: AudioTrackInfo[];
  camera?: CameraInfo | null;
  share?: ProjectShare | null;
}

export interface ProjectShare {
  id: string;
  url: string;
}

export interface ProjectAsset {
  projectId: ProjectId;
  key: string;
  blob: Blob;
}
