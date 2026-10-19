import { trackVolume, type LoadedAudioTrack } from "@/render/audioTracks";
import type { AudioSettings } from "@/shared/settings";
import { EXPORT_CHANNELS, EXPORT_SAMPLE_RATE } from "./audioEncoding";

interface MixSource {
  track: LoadedAudioTrack;
  volume: number;
  planes: Float32Array[];
}

export class AudioMixer {
  private readonly sources: MixSource[];

  constructor(tracks: readonly LoadedAudioTrack[], settings: AudioSettings, private readonly startTime: number) {
    this.sources = tracks
      .map((track) => ({
        track,
        volume: trackVolume(track.info.kind, settings),
        planes: Array.from({ length: track.buffer.numberOfChannels }, (_, channel) => track.buffer.getChannelData(channel)),
      }))
      .filter((source) => source.volume > 0);
  }

  get hasAudio(): boolean {
    return this.sources.length > 0;
  }

  read(startFrame: number, frameCount: number): Float32Array<ArrayBuffer> {
    const output = new Float32Array(frameCount * EXPORT_CHANNELS);
    for (const { track, volume, planes } of this.sources) {
      const ratio = track.info.sampleRate / EXPORT_SAMPLE_RATE;
      const origin = (this.startTime + startFrame / EXPORT_SAMPLE_RATE - track.info.startT) * track.info.sampleRate;
      for (let frame = 0; frame < frameCount; frame++) {
        const position = origin + frame * ratio;
        const index = Math.floor(position);
        if (index < 0 || index + 1 >= track.buffer.length) continue;
        const fraction = position - index;
        for (let channel = 0; channel < EXPORT_CHANNELS; channel++) {
          const plane = planes[Math.min(channel, planes.length - 1)];
          output[channel * frameCount + frame] += (plane[index] + (plane[index + 1] - plane[index]) * fraction) * volume;
        }
      }
    }
    for (let index = 0; index < output.length; index++) output[index] = Math.max(-1, Math.min(1, output[index]));
    return output;
  }
}
