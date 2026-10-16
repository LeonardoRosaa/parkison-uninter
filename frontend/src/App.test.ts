import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadMock = vi.fn();
const connectMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('./hooks/useUploadAudio', () => ({
  createUploadAudioHook: () => ({
    upload: uploadMock
  })
}));

vi.mock('./hooks/useAnalysisSocket', () => ({
  createAnalysisSocketHook: () => ({
    connect: connectMock,
    disconnect: disconnectMock
  })
}));

import App from './App.svelte';

type SocketHandlers = {
  requestId?: string;
  onMessage?: (update: { kind: 'result'; healthy: boolean }) => void;
};

const REQUEST_ID = '3f0c1a52-8f0e-4a55-9d6b-2f8a3f6f1c11';

async function uploadFile(): Promise<void> {
  const fileInput = document.getElementById('audio-file') as HTMLInputElement | null;
  if (!fileInput) {
    throw new Error('audio file input not found');
  }

  const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
  await fireEvent.change(fileInput, { target: { files: [file] } });
  await fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));
}

describe('App', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    connectMock.mockReset();
    disconnectMock.mockReset();
    window.history.replaceState(null, '', '/');
  });

  it('moves to the analysis page of the uploaded audio and shows its result there', async () => {
    let socketHandlers: SocketHandlers | undefined;
    uploadMock.mockResolvedValue({ uuid: REQUEST_ID, filename: 'voice.wav' });
    connectMock.mockImplementation((options: SocketHandlers) => {
      socketHandlers = options;
      return vi.fn();
    });

    render(App);
    expect(connectMock).not.toHaveBeenCalled();

    await uploadFile();

    await waitFor(() => expect(screen.getByTestId('spinner')).toBeInTheDocument());
    expect(window.location.pathname).toBe(`/analysis/${REQUEST_ID}`);
    expect(socketHandlers?.requestId).toBe(REQUEST_ID);
    expect(document.getElementById('audio-file')).toBeNull();

    socketHandlers?.onMessage?.({ kind: 'result', healthy: true });

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'Health check passed. Analysis completed successfully.'
        })
      ).toBeInTheDocument()
    );
  });

  it('returns to a cleared upload page from the New analysis button', async () => {
    uploadMock.mockResolvedValue({ uuid: REQUEST_ID, filename: 'voice.wav' });
    connectMock.mockReturnValue(vi.fn());

    render(App);
    await uploadFile();
    await waitFor(() => expect(screen.getByTestId('spinner')).toBeInTheDocument());

    await fireEvent.click(screen.getByRole('button', { name: 'New analysis' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start Analysis' })).toBeDisabled()
    );
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByText('voice.wav')).toBeNull();
    expect(screen.getByText('Choose an audio file')).toBeInTheDocument();
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('shows a cleared upload page when the browser goes back from the analysis page', async () => {
    uploadMock.mockResolvedValue({ uuid: REQUEST_ID, filename: 'voice.wav' });
    connectMock.mockReturnValue(vi.fn());

    render(App);
    await uploadFile();
    await waitFor(() => expect(screen.getByTestId('spinner')).toBeInTheDocument());

    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(screen.getByText('Choose an audio file')).toBeInTheDocument());
    expect(screen.queryByText('voice.wav')).toBeNull();
  });

  it('opens the analysis page directly from its URL', () => {
    connectMock.mockReturnValue(vi.fn());
    window.history.replaceState(null, '', `/analysis/${REQUEST_ID}`);

    render(App);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(connectMock).toHaveBeenCalledWith(expect.objectContaining({ requestId: REQUEST_ID }));
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('sends unknown paths to the upload page', () => {
    window.history.replaceState(null, '', '/somewhere/else');

    render(App);

    expect(window.location.pathname).toBe('/');
    expect(screen.getByRole('tab', { name: 'Upload' })).toBeInTheDocument();
  });

  it('sets the document language and title for the resolved locale', () => {
    window.history.replaceState(null, '', '/?lang=pt-BR');

    render(App);

    expect(document.documentElement.lang).toBe('pt-BR');
    expect(document.title).toBe('Monitor de Análise de Fala');
  });
});
