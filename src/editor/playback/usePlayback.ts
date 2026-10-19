import { useEffect, useState, useSyncExternalStore } from "react";
import type { LoadedAudioTrack } from "@/render/audioTracks";
import type { AudioSettings } from "@/shared/settings";
import { AudioPlayer } from "./AudioPlayer";
import { PlaybackClock, type PlaybackSnapshot } from "./PlaybackClock";

export function usePlaybackClock(start: number, end: number): PlaybackClock {
  const [clock] = useState(() => new PlaybackClock());

  useEffect(() => {
    clock.setRange(start, end);
  }, [clock, start, end]);

  useEffect(() => () => clock.pause(), [clock]);

  return clock;
}

export function usePlaybackSnapshot(clock: PlaybackClock): PlaybackSnapshot {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot);
}

export function useAudioPlayback(clock: PlaybackClock, tracks: readonly LoadedAudioTrack[], settings: AudioSettings) {
  const [player] = useState(() => new AudioPlayer(tracks, settings));

  useEffect(() => {
    const sync = () => player.sync(clock.getSnapshot());
    const unsubscribe = clock.subscribe(sync);
    return () => {
      unsubscribe();
      player.dispose();
    };
  }, [clock, player]);

  useEffect(() => {
    player.setSettings(settings);
  }, [player, settings]);
}
