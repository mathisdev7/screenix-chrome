import { trackVolume, type LoadedAudioTrack } from "@/render/audioTracks";
import { MAX_AUDIBLE_RATE } from "@/render/timeMap";
import { encodeWav } from "@/render/wav";
import type { AudioSettings } from "@/shared/settings";
import type { PlaybackSnapshot } from "./PlaybackClock";

const RESYNC_THRESHOLD_SECONDS = 0.15;

interface TrackOutput {
  track: LoadedAudioTrack;
  element: HTMLAudioElement;
  gain: GainNode;
  url: string;
}

export class AudioPlayer {
  private context: AudioContext | null = null;
  private outputs: TrackOutput[] = [];
  private settings: AudioSettings;

  constructor(
    private readonly tracks: readonly LoadedAudioTrack[],
    settings: AudioSettings,
  ) {
    this.settings = settings;
  }

  setSettings(settings: AudioSettings) {
    this.settings = settings;
    for (const { gain, track } of this.outputs) gain.gain.value = trackVolume(track.info.kind, settings);
  }

  sync({ time, playing }: PlaybackSnapshot, rate: number) {
    if (!playing) {
      for (const { element } of this.outputs) element.pause();
      return;
    }
    for (const output of this.ensureOutputs()) this.syncTrack(output, time, rate);
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
    void this.context?.close();
    this.context = null;
  }

  private ensureOutputs(): TrackOutput[] {
    if (this.outputs.length > 0 || this.tracks.length === 0) return this.outputs;
    this.context ??= new AudioContext();
    const context = this.context;
    void context.resume();
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
