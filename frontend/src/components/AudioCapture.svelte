<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getTranslations, type AudioCaptureTexts } from '../i18n';
  import {
    createAudioCaptureHook,
    DEFAULT_CAPTURE_DURATION_MS,
    type CapturedAudio,
    type CaptureState,
    type RecordedTake
  } from '../hooks/useAudioCapture';
  import { encodeWav, hasAudibleSignal } from '../lib/wav';

  type Props = {
    texts?: AudioCaptureTexts;
    disabled?: boolean;
    onConfirm?: (take: RecordedTake) => void;
    onActiveChange?: (active: boolean) => void;
  };

  // One step of the flow at a time, each carrying only what it shows.
  type View =
    | { state: 'ready'; warning?: 'silence'; error?: string }
    | { state: 'requesting' }
    | { state: 'preroll'; countdown: number }
    | { state: 'recording'; level: number; elapsedMs: number }
    | { state: 'preview'; take: RecordedTake; url: string };

  let {
    texts = getTranslations('en').audioCapture,
    disabled = false,
    onConfirm = () => undefined,
    onActiveChange = () => undefined
  }: Props = $props();

  let activeCapture: ReturnType<typeof createAudioCaptureHook> | undefined;

  let view = $state<View>({ state: 'ready' });

  function secondsRemaining(elapsedMs: number): number {
    return Math.max(0, Math.ceil((DEFAULT_CAPTURE_DURATION_MS - elapsedMs) / 1000));
  }

  function levelPercent(level: number): number {
    return Math.round(Math.min(1, Math.max(0, level)) * 100);
  }

  function releasePreview(): void {
    if (view.state === 'preview') {
      URL.revokeObjectURL(view.url);
    }
  }

  async function handleStart(): Promise<void> {
    if (view.state !== 'ready') {
      return;
    }

    view = { state: 'requesting' };
    onActiveChange(true);

    activeCapture?.cancel();
    activeCapture = createAudioCaptureHook({
      messages: { permissionDenied: texts.permissionDeniedError }
    });

    await activeCapture.start({
      onStateChange: (nextState: CaptureState) => {
        // Preroll is entered by its first countdown tick; errors by onError.
        if (nextState === 'recording') {
          view = { state: 'recording', level: 0, elapsedMs: 0 };
        }
      },
      onCountdown: (secondsLeft: number) => {
        view = { state: 'preroll', countdown: secondsLeft };
      },
      onLevel: (level: number) => {
        if (view.state === 'recording') {
          view = { ...view, level };
        }
      },
      onElapsedMs: (elapsedMs: number) => {
        if (view.state === 'recording') {
          view = { ...view, elapsedMs };
        }
      },
      onError: (message: string) => {
        view = { state: 'ready', error: message };
        onActiveChange(false);
      },
      onComplete: (audio: CapturedAudio) => {
        if (!hasAudibleSignal(audio.channelData)) {
          view = { state: 'ready', warning: 'silence' };
          onActiveChange(false);
          return;
        }

        const wavBlob = encodeWav(audio);
        view = { state: 'preview', take: { audio, wavBlob }, url: URL.createObjectURL(wavBlob) };
      }
    });
  }

  function handleReRecord(): void {
    releasePreview();
    view = { state: 'ready' };
    onActiveChange(false);
  }

  function handleUseRecording(): void {
    if (view.state === 'preview') {
      onConfirm(view.take);
    }
  }

  onDestroy(() => {
    activeCapture?.cancel();
    releasePreview();
  });
</script>

<div class="audio-capture">
  {#if view.state === 'preview'}
    <p class="instruction">{texts.previewInstruction}</p>
    <!-- svelte-ignore a11y_media_has_caption -->
    <audio controls src={view.url}></audio>
    <div class="preview-actions">
      <button type="button" disabled={disabled} onclick={handleReRecord}>{texts.reRecordButton}</button>
      <button type="button" disabled={disabled} onclick={handleUseRecording}>{texts.useRecordingButton}</button>
    </div>
  {:else if view.state === 'preroll'}
    <p class="instruction">{texts.prerollInstruction}</p>
    <p class="countdown" aria-live="polite">{view.countdown}</p>
  {:else if view.state === 'recording'}
    <p class="instruction">{texts.recordingInstruction}</p>
    <div
      class="level-meter"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={levelPercent(view.level)}
    >
      <span class="level-fill" style={`width: ${levelPercent(view.level)}%`}></span>
    </div>
    <p class="timer" aria-live="polite">
      {texts.timeRemainingLabel(secondsRemaining(view.elapsedMs))}
    </p>
  {:else}
    <button
      type="button"
      disabled={disabled || view.state === 'requesting'}
      onclick={() => void handleStart()}
    >
      {texts.startButton}
    </button>
    {#if view.state === 'ready' && view.warning === 'silence'}
      <p class="warning" role="alert">{texts.silenceWarning}</p>
    {/if}
    {#if view.state === 'ready' && view.error}
      <p class="error" role="alert">{view.error}</p>
    {/if}
  {/if}
</div>

<style>
  .audio-capture {
    display: grid;
    gap: 0.65rem;
    justify-items: stretch;
  }

  .instruction {
    margin: 0;
    color: var(--ink-soft);
  }

  .countdown {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    color: var(--ink);
  }

  .level-meter {
    width: 100%;
    height: 0.6rem;
    background: var(--line-soft);
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .level-fill {
    display: block;
    height: 100%;
    background: var(--ink);
    transition: width 0.08s linear;
  }

  .timer {
    margin: 0;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
  }

  .error {
    margin: 0;
    color: var(--ink);
    font-weight: 600;
  }

  .warning {
    margin: 0;
    color: var(--ink);
    font-weight: 600;
  }

  audio {
    width: 100%;
  }

  .preview-actions {
    display: flex;
    gap: 0.5rem;
    width: 100%;
  }

  .preview-actions button {
    flex: 1;
  }
</style>
