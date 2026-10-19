import { addAudioChunk } from "@/shared/db";
import type { AudioTrackInfo, AudioTrackKind, ProjectId } from "@/shared/types";

const CHUNK_SECONDS = 1;
const MAX_GAP_SECONDS = 10;
const INT16_MAX = 0x7fff;

const epochNow = () => performance.timeOrigin + performance.now();

function toInt16(sample: number): number {
  return Math.max(-1, Math.min(1, sample)) * INT16_MAX;
}

export class AudioTrackRecorder {
  private readonly reader: ReadableStreamDefaultReader<AudioData>;
  private readonly writes: Promise<void>[] = [];
  private chunk: Int16Array<ArrayBuffer> | null = null;
  private chunkLength = 0;
  private seq = 0;
  private frameCount = 0;
  private sampleRate = 48_000;
  private startEpoch: number | null = null;
  private nextTimestampUs: number | null = null;
  private finished: Promise<void>;

  constructor(
    private readonly projectId: ProjectId,
    private readonly kind: AudioTrackKind,
    private readonly track: MediaStreamTrack,
    private readonly channels: number,
    private readonly startedAt: number,
  ) {
    this.reader = new MediaStreamTrackProcessor<AudioData>({ track }).readable.getReader();
    this.finished = this.read();
  }

  async stop(): Promise<AudioTrackInfo | null> {
    await this.reader.cancel().catch(() => undefined);
    this.track.stop();
    await this.finished;
    this.flush();
    await Promise.all(this.writes);
    if (this.startEpoch === null || this.frameCount === 0) return null;
    return {
      kind: this.kind,
      startT: Math.max(0, (this.startEpoch - this.startedAt) / 1000),
      sampleRate: this.sampleRate,
      channels: this.channels,
      frameCount: this.frameCount,
    };
  }

  private async read() {
    for (;;) {
      const { value, done } = await this.reader.read().catch(() => ({ value: undefined, done: true as const }));
      if (done || !value) return;
      this.append(value);
      value.close();
    }
  }

  private append(data: AudioData) {
    if (this.startEpoch === null) {
      this.startEpoch = epochNow() - (data.numberOfFrames / data.sampleRate) * 1000;
      this.sampleRate = data.sampleRate;
    }
    if (this.nextTimestampUs !== null) {
      const missingFrames = Math.round(((data.timestamp - this.nextTimestampUs) / 1_000_000) * this.sampleRate);
      if (missingFrames > data.numberOfFrames / 2) this.pushSilence(Math.min(missingFrames, this.sampleRate * MAX_GAP_SECONDS));
    }
    this.nextTimestampUs = data.timestamp + (data.numberOfFrames / data.sampleRate) * 1_000_000;

    const planes = Array.from({ length: data.numberOfChannels }, (_, planeIndex) => {
      const plane = new Float32Array(data.numberOfFrames);
      data.copyTo(plane, { planeIndex, format: "f32-planar" });
      return plane;
    });
    for (let frame = 0; frame < data.numberOfFrames; frame++) {
      if (this.channels === 1) {
        let sum = 0;
        for (const plane of planes) sum += plane[frame];
        this.pushSample(toInt16(sum / planes.length));
      } else {
        for (let channel = 0; channel < this.channels; channel++) {
          this.pushSample(toInt16(planes[Math.min(channel, planes.length - 1)][frame]));
        }
      }
    }
    this.frameCount += data.numberOfFrames;
  }

  private pushSilence(frames: number) {
    for (let index = 0; index < frames * this.channels; index++) this.pushSample(0);
    this.frameCount += frames;
  }

  private pushSample(value: number) {
    const chunkSize = this.sampleRate * this.channels * CHUNK_SECONDS;
    this.chunk ??= new Int16Array(chunkSize);
    this.chunk[this.chunkLength++] = value;
    if (this.chunkLength >= chunkSize) this.flush();
  }

  private flush() {
    if (!this.chunk || this.chunkLength === 0) return;
    const samples = this.chunk.slice(0, this.chunkLength);
    this.chunk = null;
    this.chunkLength = 0;
    this.writes.push(addAudioChunk({ projectId: this.projectId, track: this.kind, seq: this.seq++, samples }));
  }
}
