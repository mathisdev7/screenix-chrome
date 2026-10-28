import { useEffect, useState, useSyncExternalStore } from "react";
import type { LoadedAudioTrack } from "@/render/audioTracks";
import type { TimeMap } from "@/render/timeMap";
import type { AudioSettings } from "@/shared/settings";
import { AudioPlayer } from "./AudioPlayer";
import { PlaybackClock, type PlaybackSnapshot } from "./PlaybackClock";

export function usePlaybackClock(map: TimeMap): PlaybackClock {
  const [clock] = useState(() => new PlaybackClock());

  useEffect(() => {
    clock.setTimeMap(map);
  }, [clock, map]);

  useEffect(() => () => clock.pause(), [clock]);

  return clock;
}

export function usePlaybackSnapshot(clock: PlaybackClock): PlaybackSnapshot {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot);
}

export function useAudioPlayback(clock: PlaybackClock, tracks: readonly LoadedAudioTrack[], settings: AudioSettings, clicks: readonly number[]) {
  const [player] = useState(() => new AudioPlayer(tracks, settings, clicks));

  useEffect(() => {
    const sync = () => {
      const snapshot = clock.getSnapshot();
      player.sync(snapshot, clock.map.rateAt(snapshot.time));
    };
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
