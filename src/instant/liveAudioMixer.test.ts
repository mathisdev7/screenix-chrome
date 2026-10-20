import { describe, expect, test } from "bun:test";
import { DEFAULT_AUDIO_SETTINGS } from "@/shared/settings";
import type { AudioTrackKind } from "@/shared/types";
import { LiveAudioMixer } from "./liveAudioMixer";

function constantChunk(kind: AudioTrackKind, startT: number, frames: number, value: number, sampleRate = 48_000, channels = 1) {
  const samples = new Int16Array(frames * channels).fill(Math.round(value * 0x7fff));
  return { kind, startT, sampleRate, channels, samples };
}

describe("LiveAudioMixer", () => {
  test("waits for every expected track before audio is ready", () => {
    const mixer = new LiveAudioMixer(["microphone", "tab"], DEFAULT_AUDIO_SETTINGS);
    mixer.add(constantChunk("microphone", 0, 48_000, 0.25));
    expect(mixer.availableFrames()).toBe(0);
    mixer.add(constantChunk("tab", 0.5, 24_000, 0.25, 48_000, 2));
    expect(mixer.availableFrames()).toBe(47_999);
  });

  test("places tracks at their start time and mixes them", () => {
    const mixer = new LiveAudioMixer(["microphone", "tab"], DEFAULT_AUDIO_SETTINGS);
    mixer.add(constantChunk("microphone", 0, 48_000, 0.25));
    mixer.add(constantChunk("tab", 0.5, 24_000, 0.5, 48_000, 2));
    const block = mixer.read(0, 48_000);
    expect(block[1000]).toBeCloseTo(0.25, 3);
    expect(block[30_000]).toBeCloseTo(0.75, 3);
    expect(block[48_000 + 30_000]).toBeCloseTo(0.75, 3);
  });

  test("resamples tracks recorded at another rate across chunk boundaries", () => {
    const mixer = new LiveAudioMixer(["microphone"], DEFAULT_AUDIO_SETTINGS);
    for (let chunk = 0; chunk < 3; chunk++) mixer.add(constantChunk("microphone", 0, 44_100, 0.5, 44_100));
    expect(mixer.availableFrames()).toBe(Math.floor(((3 * 44_100 - 1) / 44_100) * 48_000));
    for (let start = 0; start < 2 * 48_000; start += 4800) {
      const block = mixer.read(start, 4800);
      expect(block[0]).toBeCloseTo(0.5, 3);
      expect(block[4799]).toBeCloseTo(0.5, 3);
    }
  });

  test("clips the mix", () => {
    const mixer = new LiveAudioMixer(["microphone", "tab"], DEFAULT_AUDIO_SETTINGS);
    mixer.add(constantChunk("microphone", 0, 4800, 0.9));
    mixer.add(constantChunk("tab", 0, 4800, 0.9));
    expect(mixer.read(0, 100)[50]).toBe(1);
  });
});
