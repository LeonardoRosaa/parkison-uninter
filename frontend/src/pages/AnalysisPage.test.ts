import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AnalysisMetrics,
  AnalysisUpdate
} from '../hooks/useAnalysisSocket';

const connectMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('../hooks/useAnalysisSocket', () => ({
  createAnalysisSocketHook: () => ({
    connect: connectMock,
    disconnect: disconnectMock
  })
}));

import AnalysisPage from './AnalysisPage.svelte';
import { getTranslations, type Translations } from '../i18n';

type SocketHandlers = {
  requestId?: string;
  onMessage?: (update: AnalysisUpdate) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

const REQUEST_ID = '3f0c1a52-8f0e-4a55-9d6b-2f8a3f6f1c11';
const t = getTranslations('en');
const METRICS: AnalysisMetrics = {
  f0Hz: 154.23,
  jitterPercent: 0.392,
  shimmerPercent: 3.118,
  hnrDb: 21.44
};

async function metricCard(label: string): Promise<HTMLElement> {
  const list = await screen.findByRole('list', { name: 'Voice measurements' });
  return within(list).getByText(label).closest('li') as HTMLElement;
}

function renderPage(id: string = REQUEST_ID, translations: Translations = t) {
  let socketHandlers: SocketHandlers | undefined;
  connectMock.mockImplementation((options: SocketHandlers) => {
    socketHandlers = options;
    return vi.fn();
  });
  const onNewAnalysis = vi.fn();

  const view = render(AnalysisPage, { id, t: translations, onNewAnalysis });

  return { ...view, onNewAnalysis, handlers: () => socketHandlers };
}

describe('AnalysisPage', () => {
  beforeEach(() => {
    connectMock.mockReset();
    disconnectMock.mockReset();
  });

  it('waits for the analysis of the given id behind a loading indicator', () => {
    const { handlers } = renderPage();

    expect(handlers()?.requestId).toBe(REQUEST_ID);
    expect(screen.getByRole('status')).toHaveTextContent('Processing analysis...');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText(REQUEST_ID)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New analysis' })).toBeInTheDocument();
  });

  it('replaces the loading indicator with the healthy result', async () => {
    const { handlers } = renderPage();

    handlers()?.onMessage?.({ kind: 'result', healthy: true });

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'Health check passed. Analysis completed successfully.'
        })
      ).toBeInTheDocument()
    );
    expect(screen.queryByTestId('spinner')).toBeNull();
    expect(screen.getByText(REQUEST_ID)).toBeInTheDocument();
  });

  it('shows the non-healthy result', async () => {
    const { handlers } = renderPage();

    handlers()?.onMessage?.({ kind: 'result', healthy: false });

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'Health check failed. Analysis completed with issues.'
        })
      ).toBeInTheDocument()
    );
  });

  it('keeps the result when the socket closes after delivering it', async () => {
    const { handlers } = renderPage();

    handlers()?.onMessage?.({ kind: 'result', healthy: true });
    handlers()?.onClose?.();

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports a failed analysis', async () => {
    const { handlers } = renderPage();

    handlers()?.onMessage?.({ kind: 'failed', reason: 'error' });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Analysis failed.'));
    expect(screen.queryByTestId('spinner')).toBeNull();
  });

  it('reports a missing result when the backend times out', async () => {
    const { handlers } = renderPage();

    handlers()?.onMessage?.({ kind: 'failed', reason: 'timeout' });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No result received. The analysis may have expired or is taking too long.'
      )
    );
  });

  it('reports a missing result when the socket closes while still loading', async () => {
    const { handlers } = renderPage();

    handlers()?.onClose?.();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No result received.'));
    expect(screen.queryByTestId('spinner')).toBeNull();
  });

  it('reports connection errors', async () => {
    const { handlers } = renderPage();

    handlers()?.onError?.('Connection error while waiting for analysis updates.');
    handlers()?.onClose?.();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Connection error while waiting for analysis updates.'
      )
    );
  });

  it('shows the missing-result error for a malformed id without opening a socket', () => {
    renderPage('not-a-uuid');

    expect(connectMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('No result received.');
    expect(screen.getByRole('button', { name: 'New analysis' })).toBeInTheDocument();
  });

  it('asks for a new analysis from the button in every state', async () => {
    const { handlers, onNewAnalysis } = renderPage();

    await fireEvent.click(screen.getByRole('button', { name: 'New analysis' }));
    expect(onNewAnalysis).toHaveBeenCalledTimes(1);

    handlers()?.onMessage?.({ kind: 'result', healthy: true });
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());

    await fireEvent.click(screen.getByRole('button', { name: 'New analysis' }));
    expect(onNewAnalysis).toHaveBeenCalledTimes(2);
  });

  it('closes the socket when the page is left', () => {
    const { unmount } = renderPage();

    unmount();

    expect(disconnectMock).toHaveBeenCalled();
  });

  describe('voice measurements', () => {
    it('shows the four measurements below the result', async () => {
      const { handlers } = renderPage();

      handlers()?.onMessage?.({ kind: 'result', healthy: false, metrics: METRICS });

      expect(await metricCard('Frequency')).toHaveTextContent('154.2 Hz');
      expect(await metricCard('Jitter')).toHaveTextContent('0.39 %');
      expect(await metricCard('Shimmer')).toHaveTextContent('3.12 %');
      expect(await metricCard('HNR')).toHaveTextContent('21.4 dB');
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(
        screen.getByText('These measurements describe your recording and are not a diagnosis.')
      ).toBeInTheDocument();
    });

    it('formats the numbers for Brazilian Portuguese', async () => {
      const { handlers } = renderPage(REQUEST_ID, getTranslations('pt-BR'));

      handlers()?.onMessage?.({ kind: 'result', healthy: true, metrics: METRICS });

      const list = await screen.findByRole('list', { name: 'Medidas da voz' });
      expect(within(list).getByText('Frequência').closest('li')).toHaveTextContent('154,2 Hz');
      expect(within(list).getByText('Jitter').closest('li')).toHaveTextContent('0,39 %');
    });

    it('marks a value that could not be measured', async () => {
      const { handlers } = renderPage();

      handlers()?.onMessage?.({
        kind: 'result',
        healthy: true,
        metrics: { ...METRICS, f0Hz: null }
      });

      const card = await metricCard('Frequency');
      expect(card).toHaveTextContent('—');
      expect(card).toHaveTextContent("Couldn't be measured in this recording.");
      expect(card).not.toHaveTextContent('Hz');
      expect(await metricCard('HNR')).toHaveTextContent('21.4 dB');
    });

    it('shows no measurements when the result has none or the analysis failed', async () => {
      const first = renderPage();
      first.handlers()?.onMessage?.({ kind: 'result', healthy: true });
      await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());
      expect(screen.queryByRole('list', { name: 'Voice measurements' })).toBeNull();
      first.unmount();

      const second = renderPage();
      second.handlers()?.onMessage?.({ kind: 'failed', reason: 'error' });
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
      expect(screen.queryByRole('list', { name: 'Voice measurements' })).toBeNull();
    });

    it('explains a measurement only when its info button is used', async () => {
      const { handlers } = renderPage();
      handlers()?.onMessage?.({ kind: 'result', healthy: true, metrics: METRICS });
      await metricCard('Jitter');
      const explanation = 'How much the pitch of your voice wavers from one instant to the next.';

      expect(screen.queryByText(explanation)).toBeNull();

      const button = screen.getByRole('button', { name: 'What is Jitter?' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      await fireEvent.click(button);

      expect(screen.getByText(explanation)).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(button);
      expect(screen.queryByText(explanation)).toBeNull();
    });

    it('keeps one explanation open at a time', async () => {
      const { handlers } = renderPage();
      handlers()?.onMessage?.({ kind: 'result', healthy: true, metrics: METRICS });
      await metricCard('Jitter');

      await fireEvent.click(screen.getByRole('button', { name: 'What is Jitter?' }));
      await fireEvent.click(screen.getByRole('button', { name: 'What is HNR?' }));

      expect(screen.queryByText(/pitch of your voice wavers/)).toBeNull();
      expect(screen.getByText(/How clear your voice is/)).toBeInTheDocument();
    });

    it('previews another explanation on mouse hover while one is open', async () => {
      const { handlers } = renderPage();
      handlers()?.onMessage?.({ kind: 'result', healthy: true, metrics: METRICS });
      await metricCard('Jitter');
      const hnrButton = screen.getByRole('button', { name: 'What is HNR?' });

      await fireEvent.click(screen.getByRole('button', { name: 'What is Jitter?' }));
      // jsdom has no PointerEvent, so the pointer type is attached by hand.
      const mouseEnter = Object.assign(new Event('pointerenter'), { pointerType: 'mouse' });
      await fireEvent(hnrButton, mouseEnter);

      expect(screen.getByText(/How clear your voice is/)).toBeInTheDocument();
      expect(screen.queryByText(/pitch of your voice wavers/)).toBeNull();

      await fireEvent.pointerLeave(hnrButton);
      expect(screen.getByText(/pitch of your voice wavers/)).toBeInTheDocument();
    });

    it('closes the explanation on Escape or a click elsewhere', async () => {
      const { handlers } = renderPage();
      handlers()?.onMessage?.({ kind: 'result', healthy: true, metrics: METRICS });
      await metricCard('Shimmer');
      const button = screen.getByRole('button', { name: 'What is Shimmer?' });

      await fireEvent.click(button);
      await fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByText(/loudness of your voice wavers/)).toBeNull();

      await fireEvent.click(button);
      await fireEvent.click(screen.getByRole('heading'));
      expect(screen.queryByText(/loudness of your voice wavers/)).toBeNull();
    });
  });
});
