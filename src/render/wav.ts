const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const dataBytes = frames * channels * BYTES_PER_SAMPLE;
  const view = new DataView(new ArrayBuffer(HEADER_BYTES + dataBytes));
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * BYTES_PER_SAMPLE, true);
  view.setUint16(32, channels * BYTES_PER_SAMPLE, true);
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true);
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);
  const planes = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = HEADER_BYTES;
  for (let frame = 0; frame < frames; frame++) {
    for (const plane of planes) {
      const sample = Math.max(-1, Math.min(1, plane[frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += BYTES_PER_SAMPLE;
    }
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}
