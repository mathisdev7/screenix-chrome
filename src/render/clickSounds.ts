import type { PointerSample } from "@/shared/types";

const CLICK_SAMPLE_URLS = ["/sounds/click-0.wav", "/sounds/click-1.wav", "/sounds/click-2.wav"];
const WAV_HEADER_BYTES = 44;
const CLICK_GAIN = 8;

export const CLICK_SAMPLE_RATE = 48_000;

export type ClickSample = Float32Array<ArrayBuffer>;

export interface ClickSounds {
  times: readonly number[];
  samples: readonly ClickSample[];
}

let samplesPromise: Promise<ClickSample[]> | null = null;

export function decodeClickSample(wav: ArrayBuffer): ClickSample {
  const pcm = new Int16Array(wav, WAV_HEADER_BYTES, (wav.byteLength - WAV_HEADER_BYTES) >> 1);
  return Float32Array.from(pcm, (value) => (value / 0x8000) * CLICK_GAIN);
}

export function loadClickSamples(): Promise<ClickSample[]> {
  samplesPromise ??= Promise.all(
    CLICK_SAMPLE_URLS.map(async (url) => decodeClickSample(await (await fetch(url)).arrayBuffer())),
  ).catch((error: unknown) => {
    samplesPromise = null;
    throw error;
  });
  return samplesPromise;
}

export function clickTimes(pointer: readonly PointerSample[]): number[] {
  return pointer.filter((sample) => sample.kind === "down").map((sample) => sample.t).sort((a, b) => a - b);
}

export function clickSampleAt<T>(samples: readonly T[], index: number): T {
  return samples[index % samples.length];
}
