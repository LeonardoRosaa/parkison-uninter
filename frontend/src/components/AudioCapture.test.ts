import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createObjectURLMock = vi.fn(() => 'blob:mock-url');
const revokeObjectURLMock = vi.fn();
URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;

const startMock = vi.fn();
const cancelMock = vi.fn();
const createAudioCaptureHookMock = vi.fn((_options?: unknown) => ({
  start: startMock,
  cancel: cancelMock
}));

vi.mock('../hooks/useAudioCapture', () => ({
  createAudioCaptureHook: (options: unknown) => createAudioCaptureHookMock(options),
  DEFAULT_CAPTURE_DURATION_MS: 8000
}));

import AudioCapture from './AudioCapture.svelte';

type CaptureHandlers = {
  onStateChange?: (state: 'idle' | 'preroll' | 'recording' | 'error') => void;
  onCountdown?: (secondsRemaining: number) => void;
  onLevel?: (level: number) => void;
  onElapsedMs?: (elapsedMs: number) => void;
  onError?: (message: string) => void;
  onComplete?: (audio: { channelData: Float32Array; sampleRate: number }) => void;
};

const TEXTS = {
  startButton: 'Start Recording',
  prerollInstruction: 'Get ready...',
  recordingInstruction: 'Hold a steady vowel sound.',
  timeRemainingLabel: (secondsRemaining: number) => `${secondsRemaining}s remaining`,
  permissionDeniedError: 'Microphone access was denied. Try the Upload tab instead.',
  silenceWarning: 'No voice detected, please try again.',
  previewInstruction: 'Listen to your recording before continuing.',
  useRecordingButton: 'Use this recording',
  reRecordButton: 'Re-record'
};

const AUDIBLE_AUDIO = { channelData: new Float32Array([0, 0.4, -0.4, 0.5]), sampleRate: 48000 };
const SILENT_AUDIO = { channelData: new Float32Array([0, 0.001, -0.001, 0]), sampleRate: 48000 };

describe('AudioCapture', () => {
  let handlers: CaptureHandlers | undefined;

  beforeEach(() => {
    startMock.mockReset();
    cancelMock.mockReset();
    createAudioCaptureHookMock.mockClear();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    handlers = undefined;
    startMock.mockImplementation((options: CaptureHandlers) => {
      handlers = options;
      return Promise.resolve(vi.fn());
    });
  });

  it('shows a Start Recording button and requests no capture until clicked', () => {
    render(AudioCapture, { texts: TEXTS });

    expect(screen.getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();
    expect(startMock).not.toHaveBeenCalled();
  });

  it('configures the hook with the localized permission-denied message', async () => {
    render(AudioCapture, { texts: TEXTS });

    expect(createAudioCaptureHookMock).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

    expect(createAudioCaptureHookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: { permissionDenied: TEXTS.permissionDeniedError }
      })
    );
  });

  it('starts capture on click and walks through preroll and recording', async () => {
    render(AudioCapture, { texts: TEXTS });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    expect(startMock).toHaveBeenCalledTimes(1);

    handlers?.onStateChange?.('preroll');
    handlers?.onCountdown?.(3);
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Get ready...')).toBeInTheDocument();
    });

    handlers?.onCountdown?.(2);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());

    handlers?.onStateChange?.('recording');
    handlers?.onLevel?.(0.5);
    handlers?.onElapsedMs?.(1000);
    await waitFor(() => {
      expect(screen.getByText('Hold a steady vowel sound.')).toBeInTheDocument();
      expect(screen.getByText('7s remaining')).toBeInTheDocument();
      const meter = screen.getByRole('progressbar');
      expect(meter).toHaveAttribute('aria-valuenow', '50');
    });
  });

  it('shows an inline error referencing Upload without hiding the retry button', async () => {
    render(AudioCapture, { texts: TEXTS });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

    handlers?.onStateChange?.('error');
    handlers?.onError?.('Microphone access was denied. Try the Upload tab instead.');

    await waitFor(() => {
      expect(
        screen.getByText('Microphone access was denied. Try the Upload tab instead.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();
    });
  });

  it('allows retrying capture after an error', async () => {
    render(AudioCapture, { texts: TEXTS });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    handlers?.onStateChange?.('error');
    handlers?.onError?.('denied');

    await waitFor(() => {
      expect(screen.getByText('denied')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

    expect(startMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('denied')).not.toBeInTheDocument();
  });

  it('blocks a silent capture from reaching preview and shows an inline retry warning', async () => {
    render(AudioCapture, { texts: TEXTS });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    handlers?.onStateChange?.('recording');
    handlers?.onComplete?.(SILENT_AUDIO);

    await waitFor(() => {
      expect(screen.getByText('No voice detected, please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Use this recording' })).not.toBeInTheDocument();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('lets the user retry from the start state after a silence warning', async () => {
    render(AudioCapture, { texts: TEXTS });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    handlers?.onComplete?.(SILENT_AUDIO);

    await waitFor(() => {
      expect(screen.getByText('No voice detected, please try again.')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

    expect(startMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('No voice detected, please try again.')).not.toBeInTheDocument();
  });

  it('shows a playback preview with Use this recording and Re-record after an audible capture', async () => {
    render(AudioCapture, { texts: TEXTS });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    handlers?.onStateChange?.('recording');
    handlers?.onComplete?.(AUDIBLE_AUDIO);

    await waitFor(() => {
      expect(screen.getByText('Listen to your recording before continuing.')).toBeInTheDocument();
      const audioEl = document.querySelector('audio');
      expect(audioEl).not.toBeNull();
      expect(audioEl).toHaveAttribute('src', 'blob:mock-url');
      expect(screen.getByRole('button', { name: 'Use this recording' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Re-record' })).toBeEnabled();
    });

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Start Recording' })).not.toBeInTheDocument();
  });

  it('calls onConfirm with the captured audio and encoded WAV blob when "Use this recording" is clicked', async () => {
    const onConfirm = vi.fn();
    render(AudioCapture, { texts: TEXTS, onConfirm });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    handlers?.onComplete?.(AUDIBLE_AUDIO);

    await waitFor(() => screen.getByRole('button', { name: 'Use this recording' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Use this recording' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.audio).toEqual(AUDIBLE_AUDIO);
    expect(payload.wavBlob).toBeInstanceOf(Blob);
  });

  it('discards the current take immediately on Re-record with no confirmation, returning to the start state', async () => {
    render(AudioCapture, { texts: TEXTS });

    await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    handlers?.onComplete?.(AUDIBLE_AUDIO);

    await waitFor(() => screen.getByRole('button', { name: 'Re-record' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Re-record' }));

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Use this recording' })).not.toBeInTheDocument();
    });
  });

  it('allows unlimited re-recording attempts', async () => {
    render(AudioCapture, { texts: TEXTS });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
      handlers?.onComplete?.(AUDIBLE_AUDIO);

      await waitFor(() => screen.getByRole('button', { name: 'Re-record' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Re-record' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();
      });
    }

    expect(startMock).toHaveBeenCalledTimes(3);
  });

  it('ignores a second start while microphone permission is still pending', async () => {
    render(AudioCapture, { texts: TEXTS });

    const startButton = screen.getByRole('button', { name: 'Start Recording' });
    await fireEvent.click(startButton);

    expect(startButton).toBeDisabled();
    await fireEvent.click(startButton);
    expect(startMock).toHaveBeenCalledTimes(1);
  });
});
