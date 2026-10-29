import { trackVolume, type LoadedAudioTrack } from "@/render/audioTracks";
import { CLICK_SAMPLE_RATE, clickSampleAt, loadClickSamples, type ClickSample } from "@/render/clickSounds";
import { MAX_AUDIBLE_RATE, type TimeMap } from "@/render/timeMap";
import { encodeWav } from "@/render/wav";
import type { AudioSettings } from "@/shared/settings";
import type { PlaybackSnapshot } from "./PlaybackClock";

const RESYNC_THRESHOLD_SECONDS = 0.15;
const MAX_CLICK_STEP_SECONDS = 0.25;

interface TrackOutput {
  track: LoadedAudioTrack;
  element: HTMLAudioElement;
  gain: GainNode;
  url: string;
}

function clickBuffer(sample: ClickSample): AudioBuffer {
  const buffer = new AudioBuffer({ length: sample.length, numberOfChannels: 1, sampleRate: CLICK_SAMPLE_RATE });
  buffer.copyToChannel(sample, 0);
  return buffer;
}

export class AudioPlayer {
  private context: AudioContext | null = null;
  private outputs: TrackOutput[] = [];
  private clickGain: GainNode | null = null;
  private clickBuffers: AudioBuffer[] = [];
  private lastTime: number | null = null;
  private settings: AudioSettings;

  constructor(
    private readonly tracks: readonly LoadedAudioTrack[],
    settings: AudioSettings,
    private readonly clicks: readonly number[],
  ) {
    this.settings = settings;
    if (clicks.length > 0) {
      void loadClickSamples().then((samples) => {
        this.clickBuffers = samples.map(clickBuffer);
      }, () => undefined);
    }
  }

  setSettings(settings: AudioSettings) {
    this.settings = settings;
    for (const { gain, track } of this.outputs) gain.gain.value = trackVolume(track.info.kind, settings);
    if (this.clickGain) this.clickGain.gain.value = settings.clickVolume;
  }

  sync({ time, playing }: PlaybackSnapshot, map: TimeMap) {
    const previous = this.lastTime;
    this.lastTime = playing ? time : null;
    if (!playing) {
      for (const { element } of this.outputs) element.pause();
      return;
    }
    const rate = map.rateAt(time);
    for (const output of this.ensureOutputs()) this.syncTrack(output, time, rate);
    if (previous !== null) this.playClicks(previous, time, map);
  }

  dispose() {
    for (const { element, gain, url } of this.outputs) {
      element.pause();
      element.removeAttribute("src");
      element.load();
      gain.disconnect();
      URL.revokeObjectURL(url);
    }
    this.outputs = [];
    this.clickGain?.disconnect();
    this.clickGain = null;
    void this.context?.close();
    this.context = null;
  }

  private audioContext(): AudioContext {
    this.context ??= new AudioContext();
    void this.context.resume();
    return this.context;
  }

  private clickOutput(): GainNode {
    if (this.clickGain) return this.clickGain;
    const context = this.audioContext();
    this.clickGain = context.createGain();
    this.clickGain.gain.value = this.settings.clickVolume;
    this.clickGain.connect(context.destination);
    return this.clickGain;
  }

  private playClicks(from: number, to: number, map: TimeMap) {
    if (!this.settings.clickSounds || this.clickBuffers.length === 0) return;
    if (to <= from || map.outputAt(to) - map.outputAt(from) > MAX_CLICK_STEP_SECONDS) return;
    this.clicks.forEach((time, index) => {
      if (time <= from || time > to || !map.includes(time) || map.rateAt(time) > MAX_AUDIBLE_RATE) return;
      const output = this.clickOutput();
      const source = new AudioBufferSourceNode(output.context, { buffer: clickSampleAt(this.clickBuffers, index) });
      source.connect(output);
      source.start();
    });
  }

  private ensureOutputs(): TrackOutput[] {
    if (this.outputs.length > 0 || this.tracks.length === 0) return this.outputs;
    const context = this.audioContext();
    this.outputs = this.tracks.map((track) => {
      const url = URL.createObjectURL(encodeWav(track.buffer));
      const element = new Audio(url);
      element.preload = "auto";
      element.preservesPitch = true;
      const gain = context.createGain();
      gain.gain.value = trackVolume(track.info.kind, this.settings);
      context.createMediaElementSource(element).connect(gain);
      gain.connect(context.destination);
      return { track, element, gain, url };
    });
    return this.outputs;
  }

  private syncTrack({ track, element }: TrackOutput, time: number, rate: number) {
    const offset = time - track.info.startT;
    if (offset < 0 || offset >= track.buffer.duration || rate > MAX_AUDIBLE_RATE) {
      element.pause();
      return;
    }
    if (element.playbackRate !== rate) element.playbackRate = rate;
    if (element.paused) {
      element.currentTime = offset;
      void element.play().catch(() => undefined);
      return;
    }
    if (Math.abs(element.currentTime - offset) > RESYNC_THRESHOLD_SECONDS * Math.max(1, rate)) element.currentTime = offset;
  }
}
