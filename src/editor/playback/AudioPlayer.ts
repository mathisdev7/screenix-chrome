import { trackVolume, type LoadedAudioTrack } from "@/render/audioTracks";
import type { AudioSettings } from "@/shared/settings";
import type { PlaybackSnapshot } from "./PlaybackClock";

const RESYNC_THRESHOLD_SECONDS = 0.15;

interface PlayingTrack {
  source: AudioBufferSourceNode;
  gain: GainNode;
  track: LoadedAudioTrack;
}

export class AudioPlayer {
  private context: AudioContext | null = null;
  private playing: PlayingTrack[] = [];
  private anchor: { time: number; contextTime: number } | null = null;
  private settings: AudioSettings;

  constructor(
    private readonly tracks: readonly LoadedAudioTrack[],
    settings: AudioSettings,
  ) {
    this.settings = settings;
  }

  setSettings(settings: AudioSettings) {
    this.settings = settings;
    for (const { gain, track } of this.playing) gain.gain.value = trackVolume(track.info.kind, settings);
  }

  sync({ time, playing }: PlaybackSnapshot) {
    if (!playing) {
      this.stop();
      return;
    }
    if (!this.anchor || Math.abs(this.expectedTime() - time) > RESYNC_THRESHOLD_SECONDS) this.start(time);
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }

  private expectedTime(): number {
    if (!this.anchor || !this.context) return 0;
    return this.anchor.time + (this.context.currentTime - this.anchor.contextTime);
  }

  private start(time: number) {
    this.stop();
    if (this.tracks.length === 0) return;
    this.context ??= new AudioContext();
    const context = this.context;
    void context.resume();
    this.anchor = { time, contextTime: context.currentTime };
    this.playing = this.tracks.map((track) => {
      const gain = context.createGain();
      gain.gain.value = trackVolume(track.info.kind, this.settings);
      gain.connect(context.destination);
      const source = context.createBufferSource();
      source.buffer = track.buffer;
      source.connect(gain);
      const offset = time - track.info.startT;
      if (offset >= 0) source.start(context.currentTime, offset);
      else source.start(context.currentTime - offset);
      return { source, gain, track };
    });
  }

  private stop() {
    for (const { source, gain } of this.playing) {
      source.stop();
      source.disconnect();
      gain.disconnect();
    }
    this.playing = [];
    this.anchor = null;
  }
}
