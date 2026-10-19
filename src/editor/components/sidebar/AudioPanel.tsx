import type { LoadedAudioTrack } from "@/render/audioTracks";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings, type SettingsPatch } from "@/shared/settings";
import type { AudioTrackKind } from "@/shared/types";
import { Section, SliderRow } from "../controls";

const TRACK_LABELS: Record<AudioTrackKind, string> = { microphone: "Microphone", tab: "Tab audio" };
const VOLUME_KEYS: Record<AudioTrackKind, keyof AudioSettings> = { microphone: "microphoneVolume", tab: "tabVolume" };

function volumeLabel(value: number): string {
  return value === 0 ? "Muted" : `${Math.round(value * 100)}%`;
}

export function AudioPanel({ tracks, audio, onChange }: {
  tracks: readonly LoadedAudioTrack[];
  audio: AudioSettings;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
}) {
  if (tracks.length === 0) {
    return (
      <Section title="Audio">
        <p className="text-[11px] leading-snug text-muted-foreground">
          This recording has no audio. Choose a microphone or turn on tab audio in the Screenix popup before recording.
        </p>
      </Section>
    );
  }

  const isDefault = audio.microphoneVolume === DEFAULT_AUDIO_SETTINGS.microphoneVolume && audio.tabVolume === DEFAULT_AUDIO_SETTINGS.tabVolume;

  return (
    <div className="space-y-5">
      <Section title="Volume" onReset={() => onChange({ audio: DEFAULT_AUDIO_SETTINGS })} resetDisabled={isDefault}>
        {tracks.map(({ info }) => {
          const key = VOLUME_KEYS[info.kind];
          return (
            <SliderRow
              key={info.kind}
              label={TRACK_LABELS[info.kind]}
              value={audio[key]}
              min={0}
              max={2}
              step={0.05}
              onChange={(value) => onChange({ audio: { [key]: value } }, `audio.${key}`)}
              format={volumeLabel}
            />
          );
        })}
      </Section>
    </div>
  );
}
