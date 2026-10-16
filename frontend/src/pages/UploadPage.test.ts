import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createObjectURLMock = vi.fn(() => 'blob:mock-url');
const revokeObjectURLMock = vi.fn();
URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;

const uploadMock = vi.fn();
const audioCaptureStartMock = vi.fn();
const audioCaptureCancelMock = vi.fn();

vi.mock('../hooks/useUploadAudio', () => ({
  createUploadAudioHook: () => ({
    upload: uploadMock
  })
}));

vi.mock('../hooks/useAudioCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAudioCapture')>();
  return {
    ...actual,
    createAudioCaptureHook: () => ({
      start: audioCaptureStartMock,
      cancel: audioCaptureCancelMock
    })
  };
});

import UploadPage from './UploadPage.svelte';
import { getTranslations } from '../i18n';

const REQUEST_ID = '3f0c1a52-8f0e-4a55-9d6b-2f8a3f6f1c11';
const t = getTranslations('en');

function renderPage() {
  const onUploaded = vi.fn();
  render(UploadPage, { t, onUploaded });
  return { onUploaded };
}

async function selectFile(name = 'voice.wav'): Promise<File> {
  const fileInput = document.getElementById('audio-file') as HTMLInputElement | null;
  if (!fileInput) {
    throw new Error('audio file input not found');
  }

  const file = new File(['audio'], name, { type: 'audio/wav' });
  await fireEvent.change(fileInput, { target: { files: [file] } });
  return file;
}

function stubSupportedCaptureBrowser(): void {
  vi.stubGlobal('AudioContext', class {} as unknown as typeof AudioContext);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn() }
  });
}

function unstubCaptureBrowser(): void {
  vi.unstubAllGlobals();
  // @ts-expect-error test-only cleanup of a property defined for the supported-browser stub
  delete navigator.mediaDevices;
}

type CaptureHandlers = {
  onStateChange?: (state: 'idle' | 'preroll' | 'recording' | 'error') => void;
  onCountdown?: (secondsRemaining: number) => void;
  onLevel?: (level: number) => void;
  onElapsedMs?: (elapsedMs: number) => void;
  onError?: (message: string) => void;
  onComplete?: (audio: { channelData: Float32Array; sampleRate: number }) => void;
};

const AUDIBLE_AUDIO = { channelData: new Float32Array([0, 0.4, -0.4, 0.5]), sampleRate: 48000 };

function readBlobHeader(blob: Blob, length: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const view = new DataView(reader.result as ArrayBuffer);
      let value = '';
      for (let i = 0; i < length; i += 1) {
        value += String.fromCharCode(view.getUint8(i));
      }
      resolve(value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob.slice(0, length));
  });
}

describe('UploadPage', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    audioCaptureStartMock.mockReset();
    audioCaptureCancelMock.mockReset();
  });

  it('uploads the selected audio and hands over the request id', async () => {
    uploadMock.mockResolvedValue({ uuid: REQUEST_ID, filename: 'voice.wav' });
    const { onUploaded } = renderPage();

    const file = await selectFile();
    await fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    expect(uploadMock).toHaveBeenCalledWith(file);
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(REQUEST_ID));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the button as loading while the upload is in flight', async () => {
    let resolveUpload: (value: { uuid: string; filename: string }) => void = () => undefined;
    uploadMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );
    const { onUploaded } = renderPage();

    await selectFile();
    await fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
    expect(onUploaded).not.toHaveBeenCalled();

    resolveUpload({ uuid: REQUEST_ID, filename: 'voice.wav' });
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(REQUEST_ID));
  });

  it('shows an inline error and keeps the file when the upload fails', async () => {
    uploadMock.mockRejectedValue(new Error('upload failed'));
    const { onUploaded } = renderPage();

    await selectFile();
    await fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('upload failed'));
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByText('voice.wav')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Analysis' })).toBeEnabled();
  });

  it('treats an upload response without a request id as a failure', async () => {
    uploadMock.mockResolvedValue({ filename: 'voice.wav' });
    const { onUploaded } = renderPage();

    await selectFile();
    await fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Audio upload failed.'));
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('clears the upload error when another file is chosen', async () => {
    uploadMock.mockRejectedValue(new Error('upload failed'));
    renderPage();

    await selectFile();
    await fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await selectFile('second.wav');

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains why a non-WAV file was not accepted and clears the note on a valid pick', async () => {
    renderPage();
    const fileInput = document.getElementById('audio-file') as HTMLInputElement;

    const mp3 = new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' });
    await fireEvent.change(fileInput, { target: { files: [mp3] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Only WAV files are supported.');
    expect(screen.getByRole('button', { name: 'Start Analysis' })).toBeDisabled();

    await selectFile();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the Record tab disabled and Upload active by default when capture is unsupported', () => {
    renderPage();

    const uploadTab = screen.getByRole('tab', { name: 'Upload' });
    const recordTab = screen.getByRole('tab', { name: 'Record' });

    expect(uploadTab).toHaveAttribute('aria-selected', 'true');
    expect(recordTab).toHaveAttribute('aria-selected', 'false');
    expect(recordTab).toBeDisabled();
  });

  it('defaults to the Record tab and preserves Upload state on switch when capture is supported', async () => {
    stubSupportedCaptureBrowser();

    try {
      renderPage();

      const uploadTab = screen.getByRole('tab', { name: 'Upload' });
      const recordTab = screen.getByRole('tab', { name: 'Record' });

      expect(recordTab).not.toBeDisabled();
      expect(recordTab).toHaveAttribute('aria-selected', 'true');
      expect(uploadTab).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();

      await fireEvent.click(uploadTab);
      expect(uploadTab).toHaveAttribute('aria-selected', 'true');

      const fileInput = document.getElementById('audio-file') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();
      if (!fileInput) {
        throw new Error('audio file input not found');
      }

      const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
      await fireEvent.change(fileInput, {
        target: {
          files: [file]
        }
      });

      expect(screen.getByText('voice.wav')).toBeInTheDocument();

      await fireEvent.click(recordTab);
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();
      expect(document.getElementById('audio-file')).toBeNull();

      await fireEvent.click(uploadTab);
      expect(screen.getByText('voice.wav')).toBeInTheDocument();
    } finally {
      unstubCaptureBrowser();
    }
  });

  it('submits a confirmed recording through the same upload mechanism as a file upload', async () => {
    stubSupportedCaptureBrowser();

    try {
      let captureHandlers: CaptureHandlers | undefined;
      audioCaptureStartMock.mockImplementation((options: CaptureHandlers) => {
        captureHandlers = options;
        return Promise.resolve(vi.fn());
      });
      uploadMock.mockResolvedValue({ uuid: REQUEST_ID, filename: 'recording.wav' });

      const { onUploaded } = renderPage();

      await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
      captureHandlers?.onStateChange?.('recording');
      captureHandlers?.onComplete?.(AUDIBLE_AUDIO);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Use this recording' })).toBeEnabled()
      );

      await fireEvent.click(screen.getByRole('button', { name: 'Use this recording' }));

      await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
      const submittedFile = uploadMock.mock.calls[0][0] as File;
      expect(submittedFile).toBeInstanceOf(File);
      expect(submittedFile.type).toBe('audio/wav');

      expect(await readBlobHeader(submittedFile, 4)).toBe('RIFF');

      await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(REQUEST_ID));
    } finally {
      unstubCaptureBrowser();
    }
  });

  it('keeps the recorded take for a retry when its upload fails', async () => {
    stubSupportedCaptureBrowser();

    try {
      let captureHandlers: CaptureHandlers | undefined;
      audioCaptureStartMock.mockImplementation((options: CaptureHandlers) => {
        captureHandlers = options;
        return Promise.resolve(vi.fn());
      });
      uploadMock.mockRejectedValueOnce(new Error('upload failed'));
      uploadMock.mockResolvedValueOnce({ uuid: REQUEST_ID, filename: 'recording.wav' });

      const { onUploaded } = renderPage();

      await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
      captureHandlers?.onComplete?.(AUDIBLE_AUDIO);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Use this recording' })).toBeEnabled()
      );

      await fireEvent.click(screen.getByRole('button', { name: 'Use this recording' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('upload failed'));
      expect(onUploaded).not.toHaveBeenCalled();

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Use this recording' })).toBeEnabled()
      );
      await fireEvent.click(screen.getByRole('button', { name: 'Use this recording' }));

      await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(REQUEST_ID));
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      unstubCaptureBrowser();
    }
  });

  it('disables the Upload tab from the moment recording starts through the pending preview and its upload', async () => {
    stubSupportedCaptureBrowser();

    try {
      let captureHandlers: CaptureHandlers | undefined;
      audioCaptureStartMock.mockImplementation((options: CaptureHandlers) => {
        captureHandlers = options;
        return Promise.resolve(vi.fn());
      });
      uploadMock.mockResolvedValue({ uuid: REQUEST_ID, filename: 'recording.wav' });

      const { onUploaded } = renderPage();

      const uploadTab = screen.getByRole('tab', { name: 'Upload' });
      expect(uploadTab).not.toBeDisabled();

      await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
      expect(uploadTab).toBeDisabled();

      captureHandlers?.onStateChange?.('preroll');
      expect(uploadTab).toBeDisabled();

      captureHandlers?.onStateChange?.('recording');
      expect(uploadTab).toBeDisabled();

      captureHandlers?.onComplete?.(AUDIBLE_AUDIO);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Use this recording' })).toBeEnabled()
      );
      expect(uploadTab).toBeDisabled();

      await fireEvent.click(screen.getByRole('button', { name: 'Use this recording' }));
      expect(uploadTab).toBeDisabled();

      await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
      expect(uploadTab).toBeDisabled();
    } finally {
      unstubCaptureBrowser();
    }
  });

  it('re-enables the Upload tab immediately when a take is discarded via Re-record', async () => {
    stubSupportedCaptureBrowser();

    try {
      let captureHandlers: CaptureHandlers | undefined;
      audioCaptureStartMock.mockImplementation((options: CaptureHandlers) => {
        captureHandlers = options;
        return Promise.resolve(vi.fn());
      });

      renderPage();

      const uploadTab = screen.getByRole('tab', { name: 'Upload' });

      await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
      captureHandlers?.onComplete?.(AUDIBLE_AUDIO);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Re-record' })).toBeEnabled());
      expect(uploadTab).toBeDisabled();

      await fireEvent.click(screen.getByRole('button', { name: 'Re-record' }));

      await waitFor(() => expect(uploadTab).not.toBeDisabled());
      expect(uploadMock).not.toHaveBeenCalled();
    } finally {
      unstubCaptureBrowser();
    }
  });

  it('keeps the Upload tab switchable when microphone permission is denied', async () => {
    stubSupportedCaptureBrowser();

    try {
      let captureHandlers: CaptureHandlers | undefined;
      audioCaptureStartMock.mockImplementation((options: CaptureHandlers) => {
        captureHandlers = options;
        return Promise.resolve(vi.fn());
      });

      renderPage();

      const uploadTab = screen.getByRole('tab', { name: 'Upload' });

      await fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
      captureHandlers?.onStateChange?.('error');
      captureHandlers?.onError?.('Microphone access was denied.');

      await waitFor(() => expect(uploadTab).not.toBeDisabled());
    } finally {
      unstubCaptureBrowser();
    }
  });
});
