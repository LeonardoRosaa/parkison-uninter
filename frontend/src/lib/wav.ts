import type { CapturedAudio } from '../hooks/useAudioCapture';

const BYTES_PER_SAMPLE = 2;
const DEFAULT_SILENCE_RMS_THRESHOLD = 0.02;

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

export function encodeWav({ channelData, sampleRate }: CapturedAudio): Blob {
  const blockAlign = BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;
  const dataSize = channelData.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < channelData.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, Math.round(clamped * 0x7fff), true);
    offset += BYTES_PER_SAMPLE;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function hasAudibleSignal(
  channelData: Float32Array,
  threshold: number = DEFAULT_SILENCE_RMS_THRESHOLD
): boolean {
  if (channelData.length === 0) {
    return false;
  }

  let sumOfSquares = 0;
  for (let i = 0; i < channelData.length; i += 1) {
    sumOfSquares += channelData[i] * channelData[i];
  }

  const rms = Math.sqrt(sumOfSquares / channelData.length);
  return rms >= threshold;
}
