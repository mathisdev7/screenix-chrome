import { describe, expect, test } from "bun:test";
import type { LoadedAudioTrack } from "@/render/audioTracks";
import { DEFAULT_AUDIO_SETTINGS } from "@/shared/settings";
import type { AudioTrackInfo } from "@/shared/types";
import { EXPORT_SAMPLE_RATE } from "./audioEncoding";
import { TimeMap } from "@/render/timeMap";
import { AudioMixer } from "./audioMixer";
import { timeStretch } from "./timeStretch";

function track(info: Partial<AudioTrackInfo>, planes: Float32Array[]): LoadedAudioTrack {
  const fullInfo: AudioTrackInfo = { kind: "microphone", startT: 0, sampleRate: EXPORT_SAMPLE_RATE, channels: planes.length, frameCount: planes[0].length, ...info };
  const buffer = { numberOfChannels: planes.length, length: planes[0].length, getChannelData: (channel: number) => planes[channel] };
  return { info: fullInfo, buffer: buffer as unknown as AudioBuffer };
}

const constant = (value: number, length = EXPORT_SAMPLE_RATE) => new Float32Array(length).fill(value);
const span = (start: number, end: number) => new TimeMap(start, end, []);

describe("AudioMixer", () => {
  test("spreads a mono microphone to both channels at its volume", () => {
    const mixer = new AudioMixer([track({}, [constant(0.5)])], { ...DEFAULT_AUDIO_SETTINGS, microphoneVolume: 0.5 }, span(0, 1));
    const out = mixer.read(0, 10);
    expect(out[0]).toBeCloseTo(0.25);
    expect(out[10]).toBeCloseTo(0.25);
  });

  test("respects the track start time and the export start", () => {
    const mixer = new AudioMixer([track({ startT: 1 }, [constant(0.5)])], DEFAULT_AUDIO_SETTINGS, span(0.5, 2));
    expect(mixer.read(0, 1)[0]).toBe(0);
    expect(mixer.read(EXPORT_SAMPLE_RATE / 2 + 10, 1)[0]).toBeCloseTo(0.5);
  });

  test("sums tracks, clamps and skips muted ones", () => {
    const tracks = [track({}, [constant(0.8)]), track({ kind: "tab" }, [constant(0.8), constant(0.8)])];
    expect(new AudioMixer(tracks, DEFAULT_AUDIO_SETTINGS, span(0, 1)).read(0, 1)[0]).toBe(1);
    const muted = new AudioMixer(tracks, { ...DEFAULT_AUDIO_SETTINGS, tabVolume: 0 }, span(0, 1));
    expect(muted.read(0, 1)[0]).toBeCloseTo(0.8);
    expect(new AudioMixer(tracks, { ...DEFAULT_AUDIO_SETTINGS, microphoneVolume: 0, tabVolume: 0 }, span(0, 1)).hasAudio).toBe(false);
  });

  test("resamples tracks recorded at other rates", () => {
    const ramp = Float32Array.from({ length: 44_100 }, (_, index) => index / 44_100);
    const mixer = new AudioMixer([track({ sampleRate: 44_100 }, [ramp])], DEFAULT_AUDIO_SETTINGS, span(0, 1));
    expect(mixer.read(EXPORT_SAMPLE_RATE / 2, 1)[0]).toBeCloseTo(0.5, 3);
  });

  test("plays a sped-up range in less time", () => {
    const map = new TimeMap(0, 2, [{ id: "fast", start: 0.5, end: 1.5, rate: 2 }]);
    const mixer = new AudioMixer([track({}, [constant(0.5, EXPORT_SAMPLE_RATE * 2)])], DEFAULT_AUDIO_SETTINGS, map);
    expect(map.outputDuration).toBeCloseTo(1.5);
    expect(mixer.read(Math.round(EXPORT_SAMPLE_RATE * 0.75), 1)[0]).toBeCloseTo(0.5, 2);
    expect(mixer.read(Math.round(EXPORT_SAMPLE_RATE * 1.4), 1)[0]).toBeCloseTo(0.5, 2);
  });

  test("leaves ranges faster than 4x silent", () => {
    const map = new TimeMap(0, 2, [{ id: "skip", start: 0.5, end: 1.5, rate: 8 }]);
    const mixer = new AudioMixer([track({}, [constant(0.5, EXPORT_SAMPLE_RATE * 2)])], DEFAULT_AUDIO_SETTINGS, map);
    expect(mixer.read(Math.round(EXPORT_SAMPLE_RATE * 0.55), 1)[0]).toBe(0);
    expect(mixer.read(Math.round(EXPORT_SAMPLE_RATE * 0.8), 1)[0]).toBeCloseTo(0.5, 2);
  });

  describe("click sounds", () => {
    const clickSettings = { ...DEFAULT_AUDIO_SETTINGS, clickSounds: true, clickVolume: 0.5 };
    const clicks = (times: number[]) => ({ times, samples: [constant(0.4, 10), constant(0.2, 10)] });

    test("are an audio source of their own, placed on the output timeline", () => {
      const map = new TimeMap(0.5, 3, [{ id: "fast", start: 1, end: 2, rate: 2 }]);
      const mixer = new AudioMixer([], clickSettings, map, clicks([0.75, 2.5]));
      expect(mixer.hasAudio).toBe(true);
      expect(mixer.read(Math.round(EXPORT_SAMPLE_RATE * 0.25), 1)[0]).toBeCloseTo(0.2);
      expect(mixer.read(Math.round(EXPORT_SAMPLE_RATE * 1.5), 2)).toEqual(Float32Array.from([0.1, 0.1, 0.1, 0.1]));
    });

    test("skip clicks outside the trim and in ranges faster than 4x", () => {
      const map = new TimeMap(1, 3, [{ id: "skip", start: 2, end: 2.5, rate: 8 }]);
      const mixer = new AudioMixer([], clickSettings, map, clicks([0.5, 2.2, 3.5]));
      expect(mixer.read(0, Math.ceil(map.outputDuration * EXPORT_SAMPLE_RATE)).some((value) => value !== 0)).toBe(false);
    });

    test("stay silent when turned off or muted", () => {
      expect(new AudioMixer([], DEFAULT_AUDIO_SETTINGS, span(0, 1), clicks([0.5])).hasAudio).toBe(false);
      expect(new AudioMixer([], { ...clickSettings, clickVolume: 0 }, span(0, 1), clicks([0.5])).hasAudio).toBe(false);
    });
  });
});

describe("timeStretch", () => {
  const sine = (frequency: number, length: number) => Float32Array.from({ length }, (_, index) => Math.sin((2 * Math.PI * frequency * index) / EXPORT_SAMPLE_RATE));

  const zeroCrossings = (plane: Float32Array) => {
    let count = 0;
    for (let index = 1; index < plane.length; index++) if (plane[index - 1] < 0 !== plane[index] < 0) count++;
    return count;
  };

  test("halves the length and keeps the pitch", () => {
    const input = sine(440, EXPORT_SAMPLE_RATE);
    const [output] = timeStretch([input], EXPORT_SAMPLE_RATE / 2);
    expect(output.length).toBe(EXPORT_SAMPLE_RATE / 2);
    const crossingsPerSecond = zeroCrossings(output.subarray(2048, output.length - 2048)) / ((output.length - 4096) / EXPORT_SAMPLE_RATE);
    expect(crossingsPerSecond).toBeGreaterThan(860);
    expect(crossingsPerSecond).toBeLessThan(900);
  });
});
