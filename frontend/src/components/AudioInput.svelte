<script lang="ts">
  import { getTranslations, type AudioInputTexts } from '../i18n';

  type Props = {
    selectedFile?: File | null;
    disabled?: boolean;
    onChange?: (payload: { file: File | null }) => void;
    texts?: AudioInputTexts;
  };

  let {
    selectedFile = null,
    disabled = false,
    onChange = () => undefined,
    texts = getTranslations('en').audioInput
  }: Props = $props();

  let rejected = $state(false);

  function isWavType(type: string): boolean {
    return /audio\/(wav|wave|x-wav)/i.test(type);
  }

  function isWavFile(file: File): boolean {
    return isWavType(file.type) || /\.wav$/i.test(file.name);
  }

  function emitFile(file: File | null): void {
    onChange({ file });
  }

  function handleFileSelection(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    rejected = file !== null && !isWavFile(file);

    if (!file || rejected) {
      input.value = '';
      emitFile(null);
      return;
    }

    emitFile(file);
  }
</script>

<div class="audio-input">
  <label class="file-control" for="audio-file">
    <input
      id="audio-file"
      type="file"
      accept=".wav,audio/wav"
      onchange={handleFileSelection}
      disabled={disabled}
    />
    <span class="label">{selectedFile ? selectedFile.name : texts.chooseAudioFile}</span>
    <span class="hint">{selectedFile ? texts.readyForUpload : texts.wavOnly}</span>
  </label>
  {#if rejected}
    <p class="error" role="alert">{texts.invalidFileError}</p>
  {/if}
</div>

<style>
  .audio-input {
    display: grid;
    gap: 0.65rem;
  }

  .file-control {
    position: relative;
    display: grid;
    gap: 0.25rem;
    border: 1px solid var(--line);
    padding: 0.8rem 0.95rem;
    background: var(--panel);
    cursor: pointer;
    transition: border-color 0.2s ease;
  }

  .file-control:hover {
    border-color: var(--line-strong);
  }

  .file-control input {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
  }

  .label {
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hint {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }

  .error {
    margin: 0;
    color: var(--ink);
    font-weight: 600;
  }
</style>
