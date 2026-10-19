import type { Container, Muxer, MuxerAudioTrack } from "./muxer";

export const EXPORT_SAMPLE_RATE = 48_000;
export const EXPORT_CHANNELS = 2;

const AUDIO_BITRATE = 192_000;
const MAX_ENCODE_QUEUE = 8;

interface AudioCodecCandidate {
  codec: string;
  muxerCodec: MuxerAudioTrack["codec"];
}

const AUDIO_CANDIDATES: Record<Container, readonly AudioCodecCandidate[]> = {
  mp4: [
    { codec: "mp4a.40.2", muxerCodec: "aac" },
    { codec: "opus", muxerCodec: "opus" },
  ],
  webm: [{ codec: "opus", muxerCodec: "A_OPUS" }],
};

export interface AudioPlan {
  config: AudioEncoderConfig;
  track: MuxerAudioTrack;
}

export async function planAudio(container: Container): Promise<AudioPlan | null> {
  for (const candidate of AUDIO_CANDIDATES[container]) {
    const config: AudioEncoderConfig = {
      codec: candidate.codec,
      sampleRate: EXPORT_SAMPLE_RATE,
      numberOfChannels: EXPORT_CHANNELS,
      bitrate: AUDIO_BITRATE,
    };
    if ((await AudioEncoder.isConfigSupported(config)).supported) {
      return { config, track: { codec: candidate.muxerCodec, sampleRate: EXPORT_SAMPLE_RATE, channels: EXPORT_CHANNELS } };
    }
  }
  return null;
}

export class AudioTrackEncoder {
  private readonly encoder: AudioEncoder;
  private error: Error | null = null;

  constructor(plan: AudioPlan, muxer: Muxer) {
    this.encoder = new AudioEncoder({
      output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
      error: (error) => {
        this.error = error;
      },
    });
    this.encoder.configure(plan.config);
  }

  async addSamples(planar: Float32Array<ArrayBuffer>, frameCount: number, startFrame: number) {
    if (this.error) throw this.error;
    while (this.encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
      await new Promise((resolve) => this.encoder.addEventListener("dequeue", resolve, { once: true }));
    }
    const data = new AudioData({
      format: "f32-planar",
      sampleRate: EXPORT_SAMPLE_RATE,
      numberOfChannels: EXPORT_CHANNELS,
      numberOfFrames: frameCount,
      timestamp: Math.round((startFrame * 1_000_000) / EXPORT_SAMPLE_RATE),
      data: planar,
    });
    this.encoder.encode(data);
    data.close();
  }

  async flush() {
    await this.encoder.flush();
    if (this.error) throw this.error;
    this.encoder.close();
  }

  cancel() {
    if (this.encoder.state !== "closed") this.encoder.close();
  }
}
