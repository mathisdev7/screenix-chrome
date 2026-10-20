import { EXPORT_CHANNELS, EXPORT_SAMPLE_RATE } from "@/export/audioEncoding";
import { trackVolume } from "@/render/audioTracks";
import type { AudioSettings } from "@/shared/settings";
import type { AudioTrackKind } from "@/shared/types";

const INT16_SCALE = 1 / 0x7fff;

export interface LiveAudioChunk {
  kind: AudioTrackKind;
  startT: number;
  sampleRate: number;
  channels: number;
  samples: Int16Array<ArrayBuffer>;
}

interface StoredChunk {
  first: number;
  frames: number;
  samples: Int16Array<ArrayBuffer>;
}

class LiveTrack {
  private readonly chunks: StoredChunk[] = [];
  private received = 0;
  private cursor = 0;

  constructor(
    readonly startT: number,
    private readonly sampleRate: number,
    private readonly channels: number,
    private readonly volume: number,
  ) {}

  append(samples: Int16Array<ArrayBuffer>) {
    const frames = samples.length / this.channels;
    this.chunks.push({ first: this.received, frames, samples });
    this.received += frames;
  }

  get coveredUntil(): number {
    return this.startT + Math.max(0, this.received - 1) / this.sampleRate;
  }

  mixInto(output: Float32Array, startFrame: number, count: number) {
    if (this.volume <= 0) return;
    const ratio = this.sampleRate / EXPORT_SAMPLE_RATE;
    const origin = (startFrame / EXPORT_SAMPLE_RATE - this.startT) * this.sampleRate;
    for (let frame = 0; frame < count; frame++) {
      const position = origin + frame * ratio;
      const index = Math.floor(position);
      if (index < 0) continue;
      const fraction = position - index;
      for (let channel = 0; channel < EXPORT_CHANNELS; channel++) {
        const source = Math.min(channel, this.channels - 1);
        const a = this.valueAt(index, source);
        const b = this.valueAt(index + 1, source);
        output[channel * count + frame] += (a + (b - a) * fraction) * this.volume;
      }
    }
    this.discardBefore(Math.floor(origin + count * ratio) - 1);
  }

  private valueAt(frame: number, channel: number): number {
    const { chunks } = this;
    if (chunks.length === 0 || frame < chunks[0].first || frame >= this.received) return 0;
    while (this.cursor > 0 && frame < chunks[this.cursor].first) this.cursor--;
    while (frame >= chunks[this.cursor].first + chunks[this.cursor].frames) this.cursor++;
    const chunk = chunks[this.cursor];
    return chunk.samples[(frame - chunk.first) * this.channels + channel] * INT16_SCALE;
  }

  private discardBefore(frame: number) {
    while (this.chunks.length > 1 && this.chunks[0].first + this.chunks[0].frames <= frame) {
      this.chunks.shift();
      this.cursor = Math.max(0, this.cursor - 1);
    }
  }
}

export class LiveAudioMixer {
  private readonly tracks = new Map<AudioTrackKind, LiveTrack>();

  constructor(private readonly expected: readonly AudioTrackKind[], private readonly settings: AudioSettings) {}

  get hasAudio(): boolean {
    return this.expected.length > 0;
  }

  add({ kind, startT, sampleRate, channels, samples }: LiveAudioChunk) {
    let track = this.tracks.get(kind);
    if (!track) {
      track = new LiveTrack(startT, sampleRate, channels, trackVolume(kind, this.settings));
      this.tracks.set(kind, track);
    }
    track.append(samples);
  }

  availableFrames(): number {
    let until = Infinity;
    for (const kind of this.expected) {
      const track = this.tracks.get(kind);
      if (!track) return 0;
      until = Math.min(until, track.coveredUntil);
    }
    return Number.isFinite(until) ? Math.max(0, Math.floor(until * EXPORT_SAMPLE_RATE)) : 0;
  }

  read(startFrame: number, count: number): Float32Array<ArrayBuffer> {
    const output = new Float32Array(count * EXPORT_CHANNELS);
    for (const track of this.tracks.values()) track.mixInto(output, startFrame, count);
    for (let index = 0; index < output.length; index++) output[index] = Math.max(-1, Math.min(1, output[index]));
    return output;
  }
}
