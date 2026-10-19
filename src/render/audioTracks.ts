import { getAudioChunks } from "@/shared/db";
import type { AudioSettings } from "@/shared/settings";
import type { AudioTrackInfo, AudioTrackKind, ProjectId } from "@/shared/types";

const INT16_SCALE = 1 / 0x7fff;

export interface LoadedAudioTrack {
  info: AudioTrackInfo;
  buffer: AudioBuffer;
}

async function loadTrack(projectId: ProjectId, info: AudioTrackInfo): Promise<LoadedAudioTrack> {
  const chunks = await getAudioChunks(projectId, info.kind);
  const buffer = new AudioBuffer({ length: Math.max(1, info.frameCount), numberOfChannels: info.channels, sampleRate: info.sampleRate });
  const planes = Array.from({ length: info.channels }, (_, channel) => buffer.getChannelData(channel));
  let frame = 0;
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.samples.length && frame < buffer.length; index += info.channels, frame++) {
      for (let channel = 0; channel < info.channels; channel++) planes[channel][frame] = chunk.samples[index + channel] * INT16_SCALE;
    }
  }
  return { info, buffer };
}

export function loadAudioTracks(projectId: ProjectId, infos: readonly AudioTrackInfo[]): Promise<LoadedAudioTrack[]> {
  return Promise.all(infos.map((info) => loadTrack(projectId, info)));
}

export function trackVolume(kind: AudioTrackKind, settings: AudioSettings): number {
  return kind === "microphone" ? settings.microphoneVolume : settings.tabVolume;
}
