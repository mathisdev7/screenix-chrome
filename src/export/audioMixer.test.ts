import { describe, expect, test } from "bun:test";
import type { LoadedAudioTrack } from "@/render/audioTracks";
import { DEFAULT_AUDIO_SETTINGS } from "@/shared/settings";
import type { AudioTrackInfo } from "@/shared/types";
import { EXPORT_SAMPLE_RATE } from "./audioEncoding";
import { AudioMixer } from "./audioMixer";

function track(info: Partial<AudioTrackInfo>, planes: Float32Array[]): LoadedAudioTrack {
  const fullInfo: AudioTrackInfo = { kind: "microphone", startT: 0, sampleRate: EXPORT_SAMPLE_RATE, channels: planes.length, frameCount: planes[0].length, ...info };
  const buffer = { numberOfChannels: planes.length, length: planes[0].length, getChannelData: (channel: number) => planes[channel] };
  return { info: fullInfo, buffer: buffer as unknown as AudioBuffer };
}

const constant = (value: number, length = EXPORT_SAMPLE_RATE) => new Float32Array(length).fill(value);

describe("AudioMixer", () => {
  test("spreads a mono microphone to both channels at its volume", () => {
    const mixer = new AudioMixer([track({}, [constant(0.5)])], { ...DEFAULT_AUDIO_SETTINGS, microphoneVolume: 0.5 }, 0);
    const out = mixer.read(0, 10);
    expect(out[0]).toBeCloseTo(0.25);
    expect(out[10]).toBeCloseTo(0.25);
  });

  test("respects the track start time and the export start", () => {
    const mixer = new AudioMixer([track({ startT: 1 }, [constant(0.5)])], DEFAULT_AUDIO_SETTINGS, 0.5);
    expect(mixer.read(0, 1)[0]).toBe(0);
    expect(mixer.read(EXPORT_SAMPLE_RATE / 2 + 10, 1)[0]).toBeCloseTo(0.5);
  });

  test("sums tracks, clamps and skips muted ones", () => {
    const tracks = [track({}, [constant(0.8)]), track({ kind: "tab" }, [constant(0.8), constant(0.8)])];
    expect(new AudioMixer(tracks, DEFAULT_AUDIO_SETTINGS, 0).read(0, 1)[0]).toBe(1);
    const muted = new AudioMixer(tracks, { ...DEFAULT_AUDIO_SETTINGS, tabVolume: 0 }, 0);
    expect(muted.read(0, 1)[0]).toBeCloseTo(0.8);
    expect(new AudioMixer(tracks, { microphoneVolume: 0, tabVolume: 0 }, 0).hasAudio).toBe(false);
  });

  test("resamples tracks recorded at other rates", () => {
    const ramp = Float32Array.from({ length: 44_100 }, (_, index) => index / 44_100);
    const mixer = new AudioMixer([track({ sampleRate: 44_100 }, [ramp])], DEFAULT_AUDIO_SETTINGS, 0);
    expect(mixer.read(EXPORT_SAMPLE_RATE / 2, 1)[0]).toBeCloseTo(0.5, 3);
  });
});
