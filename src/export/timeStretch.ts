const FRAME_LENGTH = 1024;
const SYNTHESIS_HOP = FRAME_LENGTH / 2;
const SEARCH_RADIUS = 256;
const SEARCH_STEP = 4;
const CORRELATION_STEP = 4;
const MIN_NORMALIZATION = 1e-3;

const window = Float32Array.from({ length: FRAME_LENGTH }, (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FRAME_LENGTH - 1)));

function mixdown(planes: readonly Float32Array[]): Float32Array {
  if (planes.length === 1) return planes[0];
  const mono = new Float32Array(planes[0].length);
  for (const plane of planes) for (let index = 0; index < mono.length; index++) mono[index] += plane[index] / planes.length;
  return mono;
}

function correlation(signal: Float32Array, a: number, b: number): number {
  let sum = 0;
  for (let offset = 0; offset < FRAME_LENGTH; offset += CORRELATION_STEP) {
    const left = a + offset;
    const right = b + offset;
    if (left >= signal.length || right >= signal.length) break;
    sum += signal[left] * signal[right];
  }
  return sum;
}

function bestOffset(signal: Float32Array, nominal: number, template: number, limit: number): number {
  let best = Math.min(Math.max(nominal, 0), limit);
  let bestScore = -Infinity;
  const from = Math.max(0, nominal - SEARCH_RADIUS);
  const to = Math.min(limit, nominal + SEARCH_RADIUS);
  for (let candidate = from; candidate <= to; candidate += SEARCH_STEP) {
    const score = correlation(signal, candidate, template);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function resampleLinear(plane: Float32Array, length: number): Float32Array {
  const output = new Float32Array(length);
  if (plane.length === 0) return output;
  const ratio = plane.length / Math.max(1, length);
  for (let index = 0; index < length; index++) {
    const position = index * ratio;
    const base = Math.floor(position);
    const next = Math.min(base + 1, plane.length - 1);
    output[index] = plane[Math.min(base, plane.length - 1)] + (plane[next] - plane[Math.min(base, plane.length - 1)]) * (position - base);
  }
  return output;
}

export function timeStretch(planes: readonly Float32Array[], outputLength: number): Float32Array[] {
  const inputLength = planes[0]?.length ?? 0;
  if (outputLength <= 0) return planes.map(() => new Float32Array(0));
  if (inputLength < FRAME_LENGTH * 2 || outputLength < FRAME_LENGTH * 2) return planes.map((plane) => resampleLinear(plane, outputLength));

  const analysisHop = (SYNTHESIS_HOP * inputLength) / outputLength;
  const mono = mixdown(planes);
  const lastStart = inputLength - FRAME_LENGTH;
  const outputs = planes.map(() => new Float32Array(outputLength + FRAME_LENGTH));
  const normalization = new Float32Array(outputLength + FRAME_LENGTH);
  let previous = 0;

  for (let frame = 0; frame * SYNTHESIS_HOP < outputLength; frame++) {
    const nominal = Math.round(frame * analysisHop);
    const start = frame === 0 ? 0 : bestOffset(mono, Math.min(nominal, lastStart), Math.min(previous + SYNTHESIS_HOP, lastStart), lastStart);
    const target = frame * SYNTHESIS_HOP;
    for (let channel = 0; channel < planes.length; channel++) {
      const input = planes[channel];
      const output = outputs[channel];
      for (let index = 0; index < FRAME_LENGTH && start + index < inputLength; index++) output[target + index] += input[start + index] * window[index];
    }
    for (let index = 0; index < FRAME_LENGTH; index++) normalization[target + index] += window[index];
    previous = start;
  }

  return outputs.map((output) => {
    const result = output.subarray(0, outputLength);
    for (let index = 0; index < outputLength; index++) result[index] /= Math.max(normalization[index], MIN_NORMALIZATION);
    return Float32Array.from(result);
  });
}
