<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import MetricsGrid from '../components/MetricsGrid.svelte';
  import {
    createAnalysisSocketHook,
    type AnalysisMetrics,
    type AnalysisUpdate
  } from '../hooks/useAnalysisSocket';
  import type { Translations } from '../i18n';
  import { isRequestId } from '../lib/router';

  type Props = {
    id: string;
    t: Translations;
    onNewAnalysis?: () => void;
  };

  type View =
    | { state: 'loading' }
    | { state: 'result'; message: string; metrics?: AnalysisMetrics }
    | { state: 'inconclusive'; unusual: string[]; metrics?: AnalysisMetrics }
    | { state: 'error'; message: string };

  let { id, t, onNewAnalysis = () => undefined }: Props = $props();

  let view = $state<View>({ state: 'loading' });
  let disconnect: (() => void) | undefined;

  function settle(next: View): void {
    if (view.state !== 'loading') {
      return;
    }
    view = next;
    disconnect?.();
  }

  function handleMessage(update: AnalysisUpdate): void {
    if (update.kind === 'result') {
      settle({
        state: 'result',
        message: update.healthy ? t.app.finalHealthPassed : t.app.finalHealthFailed,
        metrics: update.metrics
      });
      return;
    }

    if (update.kind === 'inconclusive') {
      // Several features share one label (five jitter measures, say).
      const labels = update.outOfRange.map((name) => t.app.featureLabels[name] ?? name);
      settle({ state: 'inconclusive', unusual: [...new Set(labels)], metrics: update.metrics });
      return;
    }

    if (update.kind === 'failed') {
      settle({
        state: 'error',
        message: update.reason === 'error' ? t.app.statusAnalysisFailed : t.app.statusNoResult
      });
    }
  }

  onMount(() => {
    if (!isRequestId(id)) {
      settle({ state: 'error', message: t.app.statusNoResult });
      return;
    }

    const socketHook = createAnalysisSocketHook({
      messages: {
        connectionError: t.hooks.socketConnectionError
      }
    });
    disconnect = socketHook.disconnect;

    socketHook.connect({
      requestId: id,
      onMessage: handleMessage,
      onError: (message) => settle({ state: 'error', message }),
      onClose: () => settle({ state: 'error', message: t.app.statusNoResult })
    });
  });

  onDestroy(() => {
    disconnect?.();
  });
</script>

<main class="page">
  <section class="analysis">
    {#if view.state === 'loading'}
      <div class="pending" role="status">
        <span class="spinner" data-testid="spinner" aria-hidden="true"></span>
        <p class="pending-text">{t.app.statusProcessing}</p>
      </div>
    {:else if view.state === 'result'}
      <h1 class="outcome">{view.message}</h1>
      {#if view.metrics}
        <MetricsGrid metrics={view.metrics} {t} />
      {/if}
    {:else if view.state === 'inconclusive'}
      <h1 class="outcome">{t.app.finalInconclusive}</h1>
      <p class="detail">{t.app.inconclusiveDetail}</p>
      {#if view.unusual.length > 0}
        <ul class="unusual">
          {#each view.unusual as label (label)}
            <li>{label}</li>
          {/each}
        </ul>
      {/if}
      {#if view.metrics}
        <MetricsGrid metrics={view.metrics} {t} />
      {/if}
    {:else}
      <p class="outcome" role="alert">{view.message}</p>
    {/if}

    <p class="request-id">
      <span>{t.app.requestIdLabel}</span>
      <code>{id}</code>
    </p>

    <button type="button" class="new-analysis" onclick={() => onNewAnalysis()}>
      {t.app.buttonNewAnalysis}
    </button>
  </section>
</main>

<style>
  .analysis {
    width: min(34rem, 100%);
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    text-align: center;
  }

  .pending {
    display: grid;
    justify-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 2.75rem;
    height: 2.75rem;
    border: 2px solid var(--line);
    border-top-color: var(--ink);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  .pending-text {
    margin: 0;
    font-weight: 500;
  }

  .outcome {
    margin: 0;
    max-width: 24ch;
    font-size: clamp(1.35rem, 2.8vw, 1.9rem);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .detail {
    margin: 0;
    color: var(--muted);
  }

  .unusual {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .unusual li {
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-weight: 500;
  }

  .request-id {
    margin: 0;
    display: grid;
    gap: 0.2rem;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .request-id span {
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .request-id code {
    font-family: 'IBM Plex Mono', 'Menlo', 'Consolas', monospace;
    overflow-wrap: anywhere;
  }

  .new-analysis {
    color: var(--ink);
    background: transparent;
  }

  .new-analysis:hover:enabled {
    background: #f4f4f4;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
