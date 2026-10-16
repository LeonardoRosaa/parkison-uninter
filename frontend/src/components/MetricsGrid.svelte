<script lang="ts">
  import type { AnalysisMetrics } from '../hooks/useAnalysisSocket';
  import type { MetricText, Translations } from '../i18n';

  type Props = {
    metrics: AnalysisMetrics;
    t: Translations;
  };

  type Card = {
    key: keyof AnalysisMetrics;
    text: MetricText;
    unit: string;
    fractionDigits: number;
  };

  let { metrics, t }: Props = $props();

  const cards: Card[] = $derived([
    { key: 'f0Hz', text: t.metrics.frequency, unit: 'Hz', fractionDigits: 1 },
    { key: 'jitterPercent', text: t.metrics.jitter, unit: '%', fractionDigits: 2 },
    { key: 'shimmerPercent', text: t.metrics.shimmer, unit: '%', fractionDigits: 2 },
    { key: 'hnrDb', text: t.metrics.hnr, unit: 'dB', fractionDigits: 1 }
  ]);

  let pinned = $state<Card['key'] | null>(null);
  let hovered = $state<Card['key'] | null>(null);

  function togglePinned(key: Card['key']): void {
    pinned = pinned === key ? null : key;
    hovered = null;
  }

  // Touch also fires pointerenter, right before the click that pins; only a
  // real mouse may open on hover or a second tap could never close it.
  function handlePointerEnter(event: PointerEvent, key: Card['key']): void {
    if (event.pointerType === 'mouse') {
      hovered = key;
    }
  }

  // Same reason: a tap focuses the button too, so only keyboard focus opens.
  function handleFocus(event: FocusEvent, key: Card['key']): void {
    if (event.currentTarget instanceof Element && event.currentTarget.matches(':focus-visible')) {
      hovered = key;
    }
  }

  function handleWindowClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-metric-info]')) {
      return;
    }
    pinned = null;
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      pinned = null;
      hovered = null;
    }
  }

  function format(value: number, { unit, fractionDigits }: Card): string {
    const formatted = new Intl.NumberFormat(t.locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(value);
    return `${formatted} ${unit}`;
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<section class="metrics">
  <ul class="grid" aria-label={t.metrics.title}>
    {#each cards as card (card.key)}
      {@const value = metrics[card.key]}
      {@const open = (hovered ?? pinned) === card.key}
      <li class="card">
        <p class="label">
          <span>{card.text.label}</span>
          <button
            type="button"
            class="info"
            data-metric-info
            aria-label={t.metrics.infoButtonLabel(card.text.label)}
            aria-expanded={open}
            aria-controls={open ? `metric-info-${card.key}` : undefined}
            onclick={() => togglePinned(card.key)}
            onpointerenter={(event) => handlePointerEnter(event, card.key)}
            onpointerleave={() => (hovered = null)}
            onfocus={(event) => handleFocus(event, card.key)}
            onblur={() => (hovered = null)}
          >
            <span aria-hidden="true">i</span>
          </button>
        </p>
        {#if value === null}
          <p class="value">—</p>
          <p class="not-measured">{t.metrics.notMeasured}</p>
        {:else}
          <p class="value">{format(value, card)}</p>
        {/if}
        {#if open}
          <p class="popover" id={`metric-info-${card.key}`} data-metric-info>
            {card.text.explanation}
          </p>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="disclaimer">{t.metrics.disclaimer}</p>
</section>

<style>
  .metrics {
    width: 100%;
    display: grid;
    gap: 0.75rem;
  }

  .grid {
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .card {
    border: 1px solid var(--line);
    padding: 0.75rem 0.5rem;
    display: grid;
    align-content: start;
    gap: 0.3rem;
  }

  .label {
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    white-space: nowrap;
  }

  .info {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    min-height: 0;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.72rem;
    font-style: italic;
    font-weight: 400;
    letter-spacing: 0;
    line-height: 1;
    text-transform: none;
    color: var(--muted);
    background: transparent;
  }

  .info:hover:enabled,
  .info[aria-expanded='true'] {
    border-color: var(--ink);
    color: #ffffff;
    background: var(--ink);
  }

  .value {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .not-measured {
    margin: 0;
    font-size: 0.7rem;
    line-height: 1.3;
    color: var(--muted);
  }

  .popover {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    right: 0;
    z-index: 1;
    margin: 0;
    border: 1px solid var(--ink);
    padding: 0.7rem 0.85rem;
    font-size: 0.85rem;
    text-align: left;
    background: var(--panel);
  }

  .disclaimer {
    margin: 0;
    font-size: 0.75rem;
    color: var(--muted);
  }
</style>
