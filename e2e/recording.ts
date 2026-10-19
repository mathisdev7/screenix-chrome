import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const EXTENSION = join(ROOT, "dist");
const SITE = join(import.meta.dir, "site");
const CHROME = process.env.CHROME_PATH ?? "google-chrome";
const MAX_SCREEN_GAP_SECONDS = 0.25;
const MAX_CAMERA_GAP_SECONDS = 0.15;

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

interface RecordingReport {
  duration: number;
  screenFrames: number[];
  cameraFrames: number[];
  audioTracks: { kind: string; frameCount: number; sampleRate: number }[];
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

const READ_REPORT = `(async () => {
  const db = await new Promise((done) => { const request = indexedDB.open("screenix"); request.onsuccess = () => done(request.result); });
  const all = (store, range) => new Promise((done) => { const request = db.transaction(store).objectStore(store).getAll(range); request.onsuccess = () => done(request.result); });
  const [project] = (await all("projects")).sort((a, b) => b.createdAt - a.createdAt);
  const range = IDBKeyRange.bound([project.id, -Infinity], [project.id, Infinity]);
  const times = async (store) => (await all(store, range)).map((frame) => frame.t).sort((a, b) => a - b);
  return { duration: project.duration, screenFrames: await times("frames"), cameraFrames: await times("camera"), audioTracks: project.audioTracks };
})()`;

async function run(): Promise<RecordingReport> {
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
    "--window-size=1280,800",
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
      await chrome.storage.local.set({ captureSettings: { microphoneId: "default", cameraId: "default", tabAudio: false } });
      const response = await chrome.runtime.sendMessage({ type: "recording/start", windowId: tab.windowId });
      if (!response.ok) throw new Error(response.error);
    })()`);

    for (const step of ["next", "route", "next"]) {
      await sleep(2500);
      await devtools.evaluate(page, `document.getElementById("${step}").click()`);
    }
    await sleep(2500);

    await devtools.evaluate(editor, `chrome.runtime.sendMessage({ type: "recording/stop" })`);
    await sleep(2000);
    return await devtools.evaluate<RecordingReport>(editor, READ_REPORT);
  } finally {
    chrome.kill();
    await site.stop(true);
    rmSync(profile, { recursive: true, force: true });
  }
}

const report = await run();
const screenGap = largestGap(report.screenFrames);
const cameraGap = largestGap(report.cameraFrames);
const failures = [
  report.screenFrames.length === 0 && "no screen frames were recorded",
  screenGap > MAX_SCREEN_GAP_SECONDS && `screen froze for ${screenGap.toFixed(2)}s`,
  report.cameraFrames.length === 0 && "no camera frames were recorded",
  cameraGap > MAX_CAMERA_GAP_SECONDS && `camera froze for ${cameraGap.toFixed(2)}s`,
  !report.audioTracks.some((track) => track.kind === "microphone" && track.frameCount > 0) && "no microphone audio was recorded",
].filter(Boolean);

console.log(`Recorded ${report.duration.toFixed(2)}s: ${report.screenFrames.length} screen frames (largest gap ${screenGap.toFixed(2)}s), ${report.cameraFrames.length} camera frames (largest gap ${cameraGap.toFixed(2)}s)`);
if (failures.length > 0) {
  console.error(`FAIL: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("PASS");
process.exit(0);
