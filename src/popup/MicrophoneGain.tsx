import { useEffect, useRef, type RefObject } from "react";
import { SliderRow } from "@/editor/components/controls";
import { microphoneConstraints } from "@/shared/mediaAccess";

const MIN_GAIN_DB = -12;
const MAX_GAIN_DB = 12;
const METER_FLOOR_DB = -60;
const METER_DECAY = 0.9;

const gainToDb = (gain: number) => Math.round(20 * Math.log10(gain));
const dbToGain = (db: number) => 10 ** (db / 20);

export const formatGain = (gain: number) => `${Math.round(gain * 100)}%`;

function peakOf(data: AudioData, plane: Float32Array<ArrayBuffer>): number {
  let peak = 0;
  for (let planeIndex = 0; planeIndex < data.numberOfChannels; planeIndex++) {
    data.copyTo(plane, { planeIndex, format: "f32-planar" });
    for (let index = 0; index < data.numberOfFrames; index++) peak = Math.max(peak, Math.abs(plane[index]));
  }
  return peak;
}

function meterFraction(level: number): number {
  const db = 20 * Math.log10(Math.max(level, 1e-6));
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

function useLevelMeter(deviceId: string, gain: number, meter: RefObject<HTMLDivElement | null>) {
  const gainRef = useRef(gain);

  useEffect(() => {
    gainRef.current = gain;
  }, [gain]);

  useEffect(() => {
    let active = true;
    let frame = 0;
    let peak = 0;
    let level = 0;
    let track: MediaStreamTrack | null = null;
    let reader: ReadableStreamDefaultReader<AudioData> | null = null;

    const draw = () => {
      level = Math.max(peak * gainRef.current, level * METER_DECAY);
      peak = 0;
      if (meter.current) meter.current.style.clipPath = `inset(0 ${(1 - meterFraction(level)) * 100}% 0 0)`;
      frame = requestAnimationFrame(draw);
    };

    const listen = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: microphoneConstraints(deviceId) }).catch(() => null);
      track = stream?.getAudioTracks()[0] ?? null;
      if (!track) return;
      if (!active) return track.stop();
      reader = new MediaStreamTrackProcessor<AudioData>({ track }).readable.getReader();
      let plane = new Float32Array(0);
      draw();
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true as const }));
        if (done || !value) return;
        if (plane.length < value.numberOfFrames) plane = new Float32Array(value.numberOfFrames);
        peak = Math.max(peak, peakOf(value, plane));
        value.close();
      }
    };

    void listen();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      void reader?.cancel().catch(() => undefined);
      track?.stop();
    };
  }, [deviceId, meter]);
}

export function MicrophoneMeter({ deviceId, gain }: { deviceId: string; gain: number }) {
  const meter = useRef<HTMLDivElement>(null);
  useLevelMeter(deviceId, gain, meter);

  return (
    <div className="microphone-meter" aria-hidden>
      <div ref={meter} />
    </div>
  );
}

export function MicrophoneGain({ gain, onChange }: { gain: number; onChange: (gain: number) => void }) {
  return (
    <SliderRow
      label="Gain"
      min={MIN_GAIN_DB}
      max={MAX_GAIN_DB}
      step={1}
      value={gainToDb(gain)}
      format={(db) => formatGain(dbToGain(db))}
      onChange={(db) => onChange(dbToGain(db))}
    />
  );
}
