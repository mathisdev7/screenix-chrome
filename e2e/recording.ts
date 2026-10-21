import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const EXTENSION = join(ROOT, "dist");
const SITE = join(import.meta.dir, "site");
const CHROME = process.env.CHROME_PATH ?? "google-chrome";
const MAX_SCREEN_GAP_SECONDS = 0.25;
const MAX_CAMERA_GAP_SECONDS = 0.15;
const MAX_AUDIO_COVERAGE_ERROR_SECONDS = 0.3;
const MAX_INSTANT_FINISH_SECONDS = 10;
const MAX_INSTANT_DURATION_ERROR_SECONDS = 0.3;
const MAX_START_SECONDS = 0.5;
const INSTANT_TIMEOUT_MS = 60_000;
const INSTANT_VIDEO_PATH = process.env.INSTANT_VIDEO_PATH;

type Mode = "studio" | "instant";

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

interface RecordingReport {
  duration: number;
  screenFrames: number[];
  cameraFrames: number[];
  firstPointer: number | null;
  audioTracks: { kind: string; startT: number; frameCount: number; sampleRate: number }[];
  instant: InstantReport | null;
}

interface InstantReport {
  state: string;
  error?: string;
  finishSeconds: number;
  videoDuration: number;
  width: number;
  height: number;
  bytes: number;
  base64: string;
}

class DevTools {
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<number, (message: { result?: unknown; error?: unknown }) => void>();

  constructor(private readonly chrome: ChildProcess) {
    (chrome.stdio[4] as NodeJS.ReadableStream).on("data", (chunk: Buffer) => this.receive(chunk.toString()));
  }

  send<T = Record<string, unknown>>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    (this.chrome.stdio[3] as NodeJS.WritableStream).write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, ({ result, error }) => (error ? rejectSend(new Error(`${method}: ${JSON.stringify(error)}`)) : resolveSend(result as T)));
    });
  }

  async attach(targetId: string): Promise<string> {
    const { sessionId } = await this.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
    return sessionId;
  }

  async evaluate<T>(sessionId: string, expression: string): Promise<T> {
    const { result, exceptionDetails } = await this.send<{ result: { value: T }; exceptionDetails?: unknown }>(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
    return result.value;
  }

  private receive(text: string) {
    this.buffer += text;
    let end;
    while ((end = this.buffer.indexOf("\0")) >= 0) {
      const message = JSON.parse(this.buffer.slice(0, end));
      this.buffer = this.buffer.slice(end + 1);
      this.pending.get(message.id)?.(message);
      this.pending.delete(message.id);
    }
  }
}

function serveSite() {
  return Bun.serve({
    port: 0,
    fetch: async (request) => {
      const file = Bun.file(join(SITE, new URL(request.url).pathname));
      return (await file.exists()) ? new Response(file) : new Response(null, { status: 404 });
    },
  });
}

function largestGap(times: number[]): number {
  let largest = 0;
  for (let index = 1; index < times.length; index++) largest = Math.max(largest, times[index] - times[index - 1]);
  return largest;
}

const READ_INSTANT = (stoppedAt: number) => `(async () => {
  const deadline = Date.now() + ${INSTANT_TIMEOUT_MS};
  let status;
  while (Date.now() < deadline) {
    status = (await chrome.storage.session.get("instantStatus")).instantStatus;
    if (status && status.state !== "rendering") break;
    await new Promise((done) => setTimeout(done, 50));
  }
  const finishSeconds = (Date.now() - ${stoppedAt}) / 1000;
  if (!status || status.state !== "ready") return { state: status?.state ?? "timeout", error: status?.error, finishSeconds, videoDuration: 0, width: 0, height: 0, bytes: 0, base64: "" };
  const db = await new Promise((done) => { const request = indexedDB.open("screenix"); request.onsuccess = () => done(request.result); });
  const asset = await new Promise((done) => { const request = db.transaction("assets").objectStore("assets").get([status.projectId, "instant-video"]); request.onsuccess = () => done(request.result); });
  const video = document.createElement("video");
  video.muted = true;
  video.src = URL.createObjectURL(asset.blob);
  await new Promise((done, fail) => { video.onloadedmetadata = done; video.onerror = () => fail(new Error("The instant video can't be decoded")); });
  const bytes = new Uint8Array(await asset.blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return { state: status.state, finishSeconds, videoDuration: video.duration, width: video.videoWidth, height: video.videoHeight, bytes: bytes.length, base64: btoa(binary) };
})()`;

async function movePointer(devtools: DevTools, sessionId: string, seconds: number) {
  const steps = Math.round(seconds * 60);
  for (let step = 0; step <= steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const x = 960 + Math.cos(angle) * 560 + Math.sin(angle * 3) * 80;
    const y = 560 + Math.sin(angle) * 360;
    await devtools.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId);
    await sleep(16);
  }
}

async function clickAt(devtools: DevTools, sessionId: string, x: number, y: number) {
  await devtools.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, sessionId);
  await sleep(80);
  await devtools.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, sessionId);
}

const READ_REPORT = `(async () => {
  const db = await new Promise((done) => { const request = indexedDB.open("screenix"); request.onsuccess = () => done(request.result); });
  const all = (store, range) => new Promise((done) => { const request = db.transaction(store).objectStore(store).getAll(range); request.onsuccess = () => done(request.result); });
  const [project] = (await all("projects")).sort((a, b) => b.createdAt - a.createdAt);
  const range = IDBKeyRange.bound([project.id, -Infinity], [project.id, Infinity]);
  const times = async (store) => (await all(store, range)).map((frame) => frame.t).sort((a, b) => a - b);
  const pointer = (await all("pointer", range)).flatMap((batch) => batch.samples.map((sample) => sample.t));
  const firstPointer = pointer.length > 0 ? Math.min(...pointer) : null;
  return { duration: project.duration, screenFrames: await times("frames"), cameraFrames: await times("camera"), firstPointer, audioTracks: project.audioTracks };
})()`;

async function run(mode: Mode): Promise<RecordingReport> {
  const site = serveSite();
  const origin = `http://127.0.0.1:${site.port}`;
  const profile = mkdtempSync(join(tmpdir(), "screenix-e2e-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1920,1200",
    "--screen-info={0,0 1920x1200}",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });

  try {
    const devtools = new DevTools(chrome);
    await sleep(1500);
    const { id: extensionId } = await devtools.send<{ id: string }>("Extensions.loadUnpacked", { path: EXTENSION });
    const { targetId: pageTarget } = await devtools.send<{ targetId: string }>("Target.createTarget", { url: `${origin}/a.html` });
    const page = await devtools.attach(pageTarget);
    const { targetId: editorTarget } = await devtools.send<{ targetId: string }>("Target.createTarget", {
      url: `chrome-extension://${extensionId}/editor.html`,
      background: true,
    });
    const editor = await devtools.attach(editorTarget);
    await sleep(1500);

    await devtools.evaluate(editor, `(async () => {
      const [tab] = await chrome.tabs.query({ url: "${origin}/*" });
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.storage.local.set({ captureSettings: { microphoneId: "default", cameraId: "default", tabAudio: false, mode: "${mode}", instantLook: "full", instantZoom: true } });
      window.recordingStarted = chrome.runtime.sendMessage({ type: "recording/start", windowId: tab.windowId });
    })()`);
    await sleep(500);
    await movePointer(devtools, page, 1);
    await devtools.evaluate(editor, `window.recordingStarted.then((response) => { if (!response.ok) throw new Error(response.error); })`);
    await sleep(1000);

    for (const step of ["next", "route", "next"]) {
      await movePointer(devtools, page, 2);
      await clickAt(devtools, page, 960, 560);
      await sleep(400);
      await devtools.evaluate(page, `document.getElementById("${step}").click()`);
    }
    await movePointer(devtools, page, 2);

    const stoppedAt = Date.now();
    await devtools.evaluate(editor, `chrome.runtime.sendMessage({ type: "recording/stop" })`);
    if (mode === "instant") await devtools.send("Target.activateTarget", { targetId: editorTarget });
    const instant = mode === "instant" ? await devtools.evaluate<InstantReport>(editor, READ_INSTANT(stoppedAt)) : null;
    await sleep(2000);
    return { ...(await devtools.evaluate<Omit<RecordingReport, "instant">>(editor, READ_REPORT)), instant };
  } finally {
    chrome.kill();
    await site.stop(true);
    rmSync(profile, { recursive: true, force: true });
  }
}

function check(mode: Mode, report: RecordingReport): string[] {
  const screenGap = largestGap(report.screenFrames);
  const cameraGap = largestGap(report.cameraFrames);
  const microphone = report.audioTracks.find((track) => track.kind === "microphone");
  const audioSeconds = microphone ? microphone.frameCount / microphone.sampleRate : 0;
  const audioError = microphone ? Math.abs(report.duration - microphone.startT - audioSeconds) : Infinity;
  const firstScreen = report.screenFrames[0] ?? Infinity;
  const firstPointer = report.firstPointer ?? Infinity;
  console.log(`${mode}: cursor from ${firstPointer.toFixed(2)}s`);
  console.log(`${mode}: recorded ${report.duration.toFixed(2)}s: ${report.screenFrames.length} screen frames from ${(report.screenFrames[0] ?? 0).toFixed(2)}s (largest gap ${screenGap.toFixed(2)}s), ${report.cameraFrames.length} camera frames from ${(report.cameraFrames[0] ?? 0).toFixed(2)}s (largest gap ${cameraGap.toFixed(2)}s), ${audioSeconds.toFixed(2)}s of microphone audio`);
  const failures = [
    report.screenFrames.length === 0 && "no screen frames were recorded",
    firstScreen > MAX_START_SECONDS && `the screen starts at ${firstScreen.toFixed(2)}s`,
    firstPointer > MAX_START_SECONDS && `the cursor starts at ${firstPointer.toFixed(2)}s, though the mouse moved during the countdown`,
    screenGap > MAX_SCREEN_GAP_SECONDS && `screen froze for ${screenGap.toFixed(2)}s`,
    report.cameraFrames.length === 0 && "no camera frames were recorded",
    cameraGap > MAX_CAMERA_GAP_SECONDS && `camera froze for ${cameraGap.toFixed(2)}s`,
    !microphone && "no microphone audio was recorded",
    microphone && audioError > MAX_AUDIO_COVERAGE_ERROR_SECONDS && `microphone audio is ${audioError.toFixed(2)}s off the recording length`,
  ];

  const { instant } = report;
  if (instant) {
    console.log(`${mode}: ${instant.state} ${instant.finishSeconds.toFixed(2)}s after stopping, ${instant.width}x${instant.height}, ${instant.videoDuration.toFixed(2)}s, ${(instant.bytes / 1e6).toFixed(1)} MB`);
    if (INSTANT_VIDEO_PATH && instant.base64) writeFileSync(INSTANT_VIDEO_PATH, Buffer.from(instant.base64, "base64"));
    const durationError = Math.abs(instant.videoDuration - report.duration);
    failures.push(
      instant.state !== "ready" && `the instant video is ${instant.state}${instant.error ? `: ${instant.error}` : ""}`,
      instant.state === "ready" && instant.finishSeconds > MAX_INSTANT_FINISH_SECONDS && `the instant video took ${instant.finishSeconds.toFixed(1)}s after stopping`,
      instant.state === "ready" && durationError > MAX_INSTANT_DURATION_ERROR_SECONDS && `the instant video is ${durationError.toFixed(2)}s off the recording length`,
    );
  }
  return failures.filter((failure): failure is string => typeof failure === "string").map((failure) => `${mode}: ${failure}`);
}

const failures: string[] = [];
for (const mode of ["studio", "instant"] as const) failures.push(...check(mode, await run(mode)));
if (failures.length > 0) {
  console.error(`FAIL: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("PASS");
process.exit(0);
