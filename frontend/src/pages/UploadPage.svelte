<script lang="ts">
  import AudioInput from '../components/AudioInput.svelte';
  import AudioCapture from '../components/AudioCapture.svelte';
  import { createUploadAudioHook } from '../hooks/useUploadAudio';
  import { isCaptureSupported, type RecordedTake } from '../hooks/useAudioCapture';
  import type { Translations } from '../i18n';

  type Props = {
    t: Translations;
    onUploaded?: (requestId: string) => void;
  };

  type InputTab = 'upload' | 'record';

  const RECORDED_TAKE_FILENAME = 'recording.wav';

  let { t, onUploaded = () => undefined }: Props = $props();

  const isRecordSupported = isCaptureSupported();

  let selectedFile = $state<File | null>(null);
  let uploadError = $state('');
  let isSubmitting = $state(false);
  let activeTab = $state<InputTab>(isRecordSupported ? 'record' : 'upload');
  let recordFlowActive = $state(false);

  function handleRecordActiveChange(active: boolean): void {
    recordFlowActive = active;
    if (!active) {
      uploadError = '';
    }
  }

  function handleRecordingConfirmed(take: RecordedTake): void {
    const file = new File([take.wavBlob], RECORDED_TAKE_FILENAME, { type: 'audio/wav' });
    void submitAudio(file);
  }

  function handleAudioChange(payload: { file: File | null }): void {
    selectedFile = payload.file ?? null;
    uploadError = '';
  }

  async function submitAudio(file: File): Promise<void> {
    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    uploadError = '';

    try {
      const uploadHook = createUploadAudioHook({
        messages: {
          invalidFile: t.hooks.uploadInvalidFile,
          uploadFailedWithStatus: t.hooks.uploadFailedWithStatus
        }
      });
      const uploadResult = await uploadHook.upload(file);
      if (!uploadResult?.uuid) {
        throw new Error(t.app.statusUploadFailed);
      }

      onUploaded(uploadResult.uuid);
    } catch (error) {
      uploadError = error instanceof Error ? error.message : t.app.statusUploadFailed;
    } finally {
      isSubmitting = false;
    }
  }

  function handleSubmit(): void {
    if (selectedFile) {
      void submitAudio(selectedFile);
    }
  }
</script>

<main class="page">
  <section class="shell">
    <header class="hero">
      <p class="eyebrow">{t.app.heroEyebrow}</p>
      <h1>{t.app.heroTitle}</h1>
      <p class="subtitle">
        {t.app.heroSubtitle}
      </p>
    </header>

    <section class="frame">
      <article class="overview">
        <h2>{t.app.pipelineTitle}</h2>
        <ul>
          <li>{t.app.pipelineStep1}</li>
          <li>{t.app.pipelineStep2}</li>
          <li>{t.app.pipelineStep3}</li>
        </ul>
      </article>

      <section class="panel">
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            id="tab-upload"
            aria-selected={activeTab === 'upload'}
            aria-controls="tabpanel-upload"
            class={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            disabled={recordFlowActive}
            onclick={() => (activeTab = 'upload')}
          >
            {t.app.tabUploadLabel}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-record"
            aria-selected={activeTab === 'record'}
            aria-controls="tabpanel-record"
            class={`tab ${activeTab === 'record' ? 'active' : ''}`}
            disabled={!isRecordSupported}
            onclick={() => (activeTab = 'record')}
          >
            {t.app.tabRecordLabel}
          </button>
        </div>

        {#if activeTab === 'upload'}
          <div role="tabpanel" id="tabpanel-upload" aria-labelledby="tab-upload">
            <form
              class="upload-form"
              onsubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <AudioInput
                selectedFile={selectedFile}
                disabled={isSubmitting}
                onChange={handleAudioChange}
                texts={t.audioInput}
              />

              <button type="submit" disabled={!selectedFile || isSubmitting}>
                {isSubmitting ? t.app.buttonLoading : t.app.buttonStartAnalysis}
              </button>
            </form>
          </div>
        {:else}
          <div role="tabpanel" id="tabpanel-record" aria-labelledby="tab-record">
            <AudioCapture
              texts={t.audioCapture}
              disabled={isSubmitting}
              onConfirm={handleRecordingConfirmed}
              onActiveChange={handleRecordActiveChange}
            />
          </div>
        {/if}

        {#if uploadError}
          <p class="upload-error" role="alert">{uploadError}</p>
        {/if}
      </section>
    </section>
  </section>
</main>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid var(--line);
  }

  .tab {
    border: none;
    min-height: 2.4rem;
    padding: 0.45rem 0.2rem;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    font-size: 0.85rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tab:hover:enabled {
    background: transparent;
    color: var(--ink);
  }

  .tab:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .tab.active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }

  .upload-error {
    margin: 0;
    border: 1px solid var(--line-strong);
    padding: 0.65rem 0.75rem;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
</style>
