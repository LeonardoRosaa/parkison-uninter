import { describe, expect, it, vi } from 'vitest';
import { createUploadAudioHook } from './useUploadAudio';

describe('useUploadAudio', () => {
  it('uploads a file with form data and returns the parsed payload', async () => {
    const payload = {
      uuid: 'request-2',
      filename: 'normalized.wav'
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(payload)
    });

    const { upload } = createUploadAudioHook({
      apiBase: 'http://api.local',
      fetchImpl
    });

    const file = new File(['audio'], 'source.wav', { type: 'audio/wav' });
    const result = await upload(file);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.local/audios',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );

    const requestBody = fetchImpl.mock.calls[0][1].body as FormData;
    expect(requestBody.get('file')).toBe(file);
    expect(result).toEqual(payload);
  });

  it('throws when no valid File is provided', async () => {
    const { upload } = createUploadAudioHook({
      fetchImpl: vi.fn()
    });

    await expect(upload('not-a-file' as unknown as File)).rejects.toThrow(
      'Select or record an audio file before uploading.'
    );
  });

  it('returns null when response json cannot be parsed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('invalid json'))
    });

    const { upload } = createUploadAudioHook({
      apiBase: 'http://api.local',
      fetchImpl
    });

    const file = new File(['audio'], 'source.wav', { type: 'audio/wav' });
    const result = await upload(file);

    expect(result).toBeNull();
  });

  it('throws with status code when upload fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: vi.fn().mockResolvedValue({ detail: 'invalid file' })
    });

    const { upload } = createUploadAudioHook({
      apiBase: 'http://api.local',
      fetchImpl
    });

    const file = new File(['audio'], 'bad.wav', { type: 'audio/wav' });

    await expect(upload(file)).rejects.toThrow('Upload failed with status 422.');
  });

  it('falls back to the local API when no base URL is configured', async () => {
    vi.stubEnv('VITE_API_BASE', '');
    vi.resetModules();
    const { createUploadAudioHook: createUnconfiguredHook } = await import('./useUploadAudio');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ uuid: 'request-3', filename: 'source.wav' })
    });

    await createUnconfiguredHook({ fetchImpl }).upload(new File(['audio'], 'source.wav'));

    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8000/audios', expect.anything());
    vi.unstubAllEnvs();
  });
});
