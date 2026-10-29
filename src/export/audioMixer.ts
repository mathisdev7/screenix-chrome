import { trackVolume, type LoadedAudioTrack } from "@/render/audioTracks";
import { clickSampleAt, type ClickSounds } from "@/render/clickSounds";
import { MAX_AUDIBLE_RATE, type TimeMap } from "@/render/timeMap";
import type { AudioSettings } from "@/shared/settings";
import { EXPORT_CHANNELS, EXPORT_SAMPLE_RATE } from "./audioEncoding";
import { timeStretch } from "./timeStretch";

const SPLICE_FADE_SECONDS = 0.01;

interface MixSource {
  volume: number;
  planes: Float32Array[];
}

function trackPlanes(track: LoadedAudioTrack): Float32Array[] {
  const planes = Array.from({ length: track.buffer.numberOfChannels }, (_, channel) => track.buffer.getChannelData(channel));
  return Array.from({ length: EXPORT_CHANNELS }, (_, channel) => planes[Math.min(channel, planes.length - 1)]);
}

function extract(track: LoadedAudioTrack, planes: readonly Float32Array[], fromSeconds: number, length: number): Float32Array[] {
  const ratio = track.info.sampleRate / EXPORT_SAMPLE_RATE;
  const origin = (fromSeconds - track.info.startT) * track.info.sampleRate;
  return planes.map((plane) => {
    const output = new Float32Array(length);
    for (let frame = 0; frame < length; frame++) {
      const position = origin + frame * ratio;
      const index = Math.floor(position);
      if (index < 0 || index + 1 >= plane.length) continue;
      output[frame] = plane[index] + (plane[index + 1] - plane[index]) * (position - index);
    }
    return output;
  });
}

function fadeSplices(planes: readonly Float32Array[], fadeIn: boolean, fadeOut: boolean) {
  const length = Math.min(Math.round(SPLICE_FADE_SECONDS * EXPORT_SAMPLE_RATE), Math.floor(planes[0].length / 2));
  for (const plane of planes) {
    for (let frame = 0; frame < length; frame++) {
      const gain = frame / length;
      if (fadeIn) plane[frame] *= gain;
      if (fadeOut) plane[plane.length - 1 - frame] *= gain;
    }
  }
}

function renderOnTimeline(track: LoadedAudioTrack, map: TimeMap, outputLength: number): Float32Array[] {
  const planes = trackPlanes(track);
  const output = planes.map(() => new Float32Array(outputLength));
  map.segments.forEach((segment, index) => {
    const at = Math.round(segment.outputStart * EXPORT_SAMPLE_RATE);
    const sourceLength = Math.round((segment.sourceEnd - segment.sourceStart) * EXPORT_SAMPLE_RATE);
    const targetLength = Math.min(outputLength - at, Math.round(((segment.sourceEnd - segment.sourceStart) / segment.rate) * EXPORT_SAMPLE_RATE));
    if (targetLength <= 0 || sourceLength <= 0 || segment.rate > MAX_AUDIBLE_RATE) return;
    const source = extract(track, planes, segment.sourceStart, sourceLength);
    const timed = (segment.rate === 1 ? source : timeStretch(source, targetLength)).map((plane) => plane.subarray(0, targetLength));
    const previous = map.segments[index - 1];
    const next = map.segments[index + 1];
    fadeSplices(timed, previous !== undefined && previous.sourceEnd < segment.sourceStart, next !== undefined && next.sourceStart > segment.sourceEnd);
    timed.forEach((plane, channel) => output[channel].set(plane, at));
  });
  return output;
}

function renderClicks({ times, samples }: ClickSounds, map: TimeMap, outputLength: number): Float32Array[] {
  const output = new Float32Array(outputLength);
  times.forEach((time, index) => {
    if (!map.includes(time) || map.rateAt(time) > MAX_AUDIBLE_RATE) return;
    const sample = clickSampleAt(samples, index);
    const at = Math.round(map.outputAt(time) * EXPORT_SAMPLE_RATE);
    const length = Math.min(sample.length, outputLength - at);
    for (let frame = 0; frame < length; frame++) output[at + frame] += sample[frame];
  });
  return Array.from({ length: EXPORT_CHANNELS }, () => output);
}

export class AudioMixer {
  private readonly sources: MixSource[];

  constructor(tracks: readonly LoadedAudioTrack[], settings: AudioSettings, map: TimeMap, clicks: ClickSounds | null = null) {
    const outputLength = Math.ceil(map.outputDuration * EXPORT_SAMPLE_RATE);
    this.sources = tracks
      .map((track) => ({ track, volume: trackVolume(track.info.kind, settings) }))
      .filter(({ volume }) => volume > 0)
      .map(({ track, volume }) => ({ volume, planes: renderOnTimeline(track, map, outputLength) }));
    if (clicks && clicks.times.length > 0 && settings.clickSounds && settings.clickVolume > 0) {
      this.sources.push({ volume: settings.clickVolume, planes: renderClicks(clicks, map, outputLength) });
    }
  }

  get hasAudio(): boolean {
    return this.sources.length > 0;
  }

  read(startFrame: number, frameCount: number): Float32Array<ArrayBuffer> {
    const output = new Float32Array(frameCount * EXPORT_CHANNELS);
    for (const { volume, planes } of this.sources) {
      for (let channel = 0; channel < EXPORT_CHANNELS; channel++) {
        const plane = planes[channel];
        for (let frame = 0; frame < frameCount; frame++) {
          const index = startFrame + frame;
          if (index < plane.length) output[channel * frameCount + frame] += plane[index] * volume;
        }
      }
    }
    for (let index = 0; index < output.length; index++) output[index] = Math.max(-1, Math.min(1, output[index]));
    return output;
  }
}
