import { describe, expect, it } from 'vitest';
import { encodeWav, hasAudibleSignal } from './wav';

function readBlob(blob: Blob): Promise<DataView> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new DataView(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function readAscii(view: DataView, offset: number, length: number): string {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += String.fromCharCode(view.getUint8(offset + i));
  }
  return value;
}

describe('encodeWav', () => {
  it('produces a valid mono 16-bit PCM WAV header for the given sample rate', async () => {
    const channelData = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = encodeWav({ channelData, sampleRate: 44100 });

    expect(blob.type).toBe('audio/wav');

    const view = await readBlob(blob);
    const dataSize = channelData.length * 2;

    expect(readAscii(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + dataSize);
    expect(readAscii(view, 8, 4)).toBe('WAVE');
    expect(readAscii(view, 12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16);
    expect(readAscii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(dataSize);
    expect(view.byteLength).toBe(44 + dataSize);
  });

  it('preserves the native sample rate passed in', async () => {
    const blob = encodeWav({ channelData: new Float32Array([0.1]), sampleRate: 48000 });
    const view = await readBlob(blob);

    expect(view.getUint32(24, true)).toBe(48000);
  });

  it('encodes samples as clamped 16-bit PCM values', async () => {
    const channelData = new Float32Array([0, 1, -1, 2, -2]);
    const blob = encodeWav({ channelData, sampleRate: 8000 });
    const view = await readBlob(blob);

    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32767);
    expect(view.getInt16(50, true)).toBe(32767);
    expect(view.getInt16(52, true)).toBe(-32767);
  });

  it('produces an empty data chunk for empty input', async () => {
    const blob = encodeWav({ channelData: new Float32Array([]), sampleRate: 16000 });
    const view = await readBlob(blob);

    expect(view.getUint32(40, true)).toBe(0);
    expect(view.byteLength).toBe(44);
  });
});

describe('hasAudibleSignal', () => {
  it('returns false for silence (all zeros)', () => {
    expect(hasAudibleSignal(new Float32Array(1000))).toBe(false);
  });

  it('returns false for low-level noise under the default threshold', () => {
    const noise = new Float32Array(1000).fill(0.005);
    expect(hasAudibleSignal(noise)).toBe(false);
  });

  it('returns true for a sustained signal at speaking level', () => {
    const channelData = new Float32Array(1000).fill(0.3);
    expect(hasAudibleSignal(channelData)).toBe(true);
  });

  it('ignores a single brief transient spike (e.g. a click or pop) in an otherwise silent recording', () => {
    const channelData = new Float32Array(48000);
    channelData[24000] = 0.9;
    expect(hasAudibleSignal(channelData)).toBe(false);
  });

  it('respects a custom threshold', () => {
    const channelData = new Float32Array([0.05]);
    expect(hasAudibleSignal(channelData, 0.1)).toBe(false);
    expect(hasAudibleSignal(channelData, 0.01)).toBe(true);
  });

  it('returns false for empty input', () => {
    expect(hasAudibleSignal(new Float32Array([]))).toBe(false);
  });
});
