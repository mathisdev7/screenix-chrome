import type {
  AudioChunkRecord,
  AudioTrackKind,
  FrameRecord,
  PointerBatchRecord,
  PointerSample,
  ProjectAsset,
  ProjectId,
  ProjectRecord,
} from "./types";

const DATABASE_NAME = "screenix";
const DATABASE_VERSION = 2;

const STORES = {
  projects: "projects",
  frames: "frames",
  pointer: "pointer",
  assets: "assets",
  audio: "audio",
  camera: "camera",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

let databasePromise: Promise<IDBDatabase> | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        db.createObjectStore(STORES.projects, { keyPath: "id" });
        db.createObjectStore(STORES.frames, { keyPath: ["projectId", "seq"] });
        db.createObjectStore(STORES.pointer, { keyPath: ["projectId", "seq"] });
        db.createObjectStore(STORES.assets, { keyPath: ["projectId", "key"] });
      }
      if (event.oldVersion < 2) {
        db.createObjectStore(STORES.audio, { keyPath: ["projectId", "track", "seq"] });
        db.createObjectStore(STORES.camera, { keyPath: ["projectId", "seq"] });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

async function store(name: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDatabase();
  return db.transaction(name, mode).objectStore(name);
}

function projectRange(projectId: ProjectId): IDBKeyRange {
  return IDBKeyRange.bound([projectId, -Infinity], [projectId, Infinity]);
}

function afterSeqRange(projectId: ProjectId, seq: number): IDBKeyRange {
  return IDBKeyRange.bound([projectId, seq], [projectId, Infinity], true);
}

function projectAssetRange(projectId: ProjectId): IDBKeyRange {
  return IDBKeyRange.bound([projectId, ""], [projectId, "￿"]);
}

export async function putProject(project: ProjectRecord): Promise<void> {
  await promisify((await store(STORES.projects, "readwrite")).put(project));
}

export async function getProject(id: ProjectId): Promise<ProjectRecord | undefined> {
  return promisify((await store(STORES.projects, "readonly")).get(id));
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const projects: ProjectRecord[] = await promisify((await store(STORES.projects, "readonly")).getAll());
  return projects.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProject(id: ProjectId): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(Object.values(STORES), "readwrite");
  transaction.objectStore(STORES.projects).delete(id);
  transaction.objectStore(STORES.frames).delete(projectRange(id));
  transaction.objectStore(STORES.pointer).delete(projectRange(id));
  transaction.objectStore(STORES.assets).delete(projectAssetRange(id));
  transaction.objectStore(STORES.camera).delete(projectRange(id));
  transaction.objectStore(STORES.audio).delete(IDBKeyRange.bound([id, "", -Infinity], [id, "\uffff", Infinity]));
  await transactionDone(transaction);
}

export async function addFrame(frame: FrameRecord): Promise<void> {
  await promisify((await store(STORES.frames, "readwrite")).put(frame));
}

export async function getFrames(projectId: ProjectId): Promise<FrameRecord[]> {
  const frames: FrameRecord[] = await promisify((await store(STORES.frames, "readonly")).getAll(projectRange(projectId)));
  return frames.sort((a, b) => a.t - b.t || a.seq - b.seq);
}

export async function getFramesAfter(projectId: ProjectId, seq: number): Promise<FrameRecord[]> {
  return promisify((await store(STORES.frames, "readonly")).getAll(afterSeqRange(projectId, seq)));
}

export async function addPointerBatch(batch: PointerBatchRecord): Promise<void> {
  await promisify((await store(STORES.pointer, "readwrite")).put(batch));
}

export async function getPointerSamples(projectId: ProjectId): Promise<PointerSample[]> {
  const batches: PointerBatchRecord[] = await promisify((await store(STORES.pointer, "readonly")).getAll(projectRange(projectId)));
  return batches.flatMap((batch) => batch.samples).sort((a, b) => a.t - b.t);
}

export async function getPointerBatchesAfter(projectId: ProjectId, seq: number): Promise<PointerBatchRecord[]> {
  return promisify((await store(STORES.pointer, "readonly")).getAll(afterSeqRange(projectId, seq)));
}

export async function putAsset(asset: ProjectAsset): Promise<void> {
  await promisify((await store(STORES.assets, "readwrite")).put(asset));
}

export async function getAsset(projectId: ProjectId, key: string): Promise<Blob | undefined> {
  const asset: ProjectAsset | undefined = await promisify((await store(STORES.assets, "readonly")).get([projectId, key]));
  return asset?.blob;
}

export async function addCameraFrame(frame: FrameRecord): Promise<void> {
  await promisify((await store(STORES.camera, "readwrite")).put(frame));
}

export async function replaceCameraFrames(projectId: ProjectId, frames: FrameRecord[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORES.camera, "readwrite");
  const camera = transaction.objectStore(STORES.camera);
  camera.delete(projectRange(projectId));
  for (const frame of frames) camera.put(frame);
  await transactionDone(transaction);
}

export async function getCameraFrames(projectId: ProjectId): Promise<FrameRecord[]> {
  const frames: FrameRecord[] = await promisify((await store(STORES.camera, "readonly")).getAll(projectRange(projectId)));
  return frames.sort((a, b) => a.t - b.t || a.seq - b.seq);
}

export async function getCameraFramesAfter(projectId: ProjectId, seq: number): Promise<FrameRecord[]> {
  return promisify((await store(STORES.camera, "readonly")).getAll(afterSeqRange(projectId, seq)));
}

export async function addAudioChunk(chunk: AudioChunkRecord): Promise<void> {
  await promisify((await store(STORES.audio, "readwrite")).put(chunk));
}

export async function getAudioChunks(projectId: ProjectId, track: AudioTrackKind): Promise<AudioChunkRecord[]> {
  const range = IDBKeyRange.bound([projectId, track, -Infinity], [projectId, track, Infinity]);
  const chunks: AudioChunkRecord[] = await promisify((await store(STORES.audio, "readonly")).getAll(range));
  return chunks.sort((a, b) => a.seq - b.seq);
}
