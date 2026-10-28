import type { LoadedAudioTrack } from "@/render/audioTracks";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings, type SettingsPatch } from "@/shared/settings";
import type { AudioTrackKind } from "@/shared/types";
import { Section, SliderRow, SwitchRow } from "../controls";

const TRACK_LABELS: Record<AudioTrackKind, string> = { microphone: "Microphone", tab: "Tab audio" };
const VOLUME_KEYS: Record<AudioTrackKind, "microphoneVolume" | "tabVolume"> = { microphone: "microphoneVolume", tab: "tabVolume" };

function volumeLabel(value: number): string {
  return value === 0 ? "Muted" : `${Math.round(value * 100)}%`;
}

function ClickSoundsSection({ audio, hasClicks, onChange }: {
  audio: AudioSettings;
  hasClicks: boolean;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
}) {
  const isDefault = audio.clickSounds === DEFAULT_AUDIO_SETTINGS.clickSounds && audio.clickVolume === DEFAULT_AUDIO_SETTINGS.clickVolume;
  return (
    <Section
      title="Clicks"
      onReset={() => onChange({ audio: { clickSounds: DEFAULT_AUDIO_SETTINGS.clickSounds, clickVolume: DEFAULT_AUDIO_SETTINGS.clickVolume } })}
      resetDisabled={isDefault}
    >
      <SwitchRow label="Click sounds" checked={audio.clickSounds} onChange={(clickSounds) => onChange({ audio: { clickSounds } })} />
      {audio.clickSounds && (
        <SliderRow
          label="Click volume"
          value={audio.clickVolume}
          min={0}
          max={2}
          step={0.05}
          onChange={(clickVolume) => onChange({ audio: { clickVolume } }, "audio.clickVolume")}
          format={volumeLabel}
        />
      )}
      {audio.clickSounds && !hasClicks && (
        <p className="text-[11px] leading-snug text-muted-foreground">This recording has no clicks.</p>
      )}
    </Section>
  );
}

function TrackVolumes({ tracks, audio, onChange }: {
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
    <Section
      title="Volume"
      onReset={() => onChange({ audio: { microphoneVolume: DEFAULT_AUDIO_SETTINGS.microphoneVolume, tabVolume: DEFAULT_AUDIO_SETTINGS.tabVolume } })}
      resetDisabled={isDefault}
    >
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
  );
}

export function AudioPanel({ tracks, audio, hasClicks, onChange }: {
  tracks: readonly LoadedAudioTrack[];
  audio: AudioSettings;
  hasClicks: boolean;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
}) {
  return (
    <div className="space-y-5">
      <TrackVolumes tracks={tracks} audio={audio} onChange={onChange} />
      <ClickSoundsSection audio={audio} hasClicks={hasClicks} onChange={onChange} />
    </div>
  );
}
