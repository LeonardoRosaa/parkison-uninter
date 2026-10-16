import { getTranslations } from '../i18n';

export type CaptureState = 'preroll' | 'recording' | 'error';

export interface CapturedAudio {
  channelData: Float32Array;
  sampleRate: number;
}

/** A finished capture together with the WAV file encoded from it. */
export interface RecordedTake {
  audio: CapturedAudio;
  wavBlob: Blob;
}

interface AudioCaptureMessages {
  permissionDenied: string;
}

interface StartCaptureOptions {
  onStateChange?: (state: CaptureState) => void;
  onCountdown?: (secondsRemaining: number) => void;
  onLevel?: (level: number) => void;
  onElapsedMs?: (elapsedMs: number) => void;
  onError?: (message: string) => void;
  onComplete?: (audio: CapturedAudio) => void;
}

type GetUserMediaImpl = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

interface CreateAudioCaptureHookOptions {
  messages?: Partial<AudioCaptureMessages>;
  getUserMediaImpl?: GetUserMediaImpl;
  audioContextFactory?: () => AudioContext;
}

export const DEFAULT_CAPTURE_DURATION_MS = 8000;
export const DEFAULT_PREROLL_SECONDS = 3;
const LEVEL_INTERVAL_MS = 100;

const DEFAULT_MESSAGES: AudioCaptureMessages = {
  permissionDenied: getTranslations('en').audioCapture.permissionDeniedError
};

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  );
}

function defaultGetUserMediaImpl(constraints: MediaStreamConstraints): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(constraints);
}

function defaultAudioContextFactory(): AudioContext {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    throw new Error('AudioContext is not supported in this browser.');
  }
  return new AudioContextCtor();
}

export function isCaptureSupported(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const hasGetUserMedia = typeof navigator.mediaDevices?.getUserMedia === 'function';
  const hasAudioContext = typeof getAudioContextConstructor() !== 'undefined';

  return hasGetUserMedia && hasAudioContext;
}

function computePeakLevel(buffer: Uint8Array): number {
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = Math.abs(buffer[i] - 128) / 128;
    if (value > peak) {
      peak = value;
    }
  }
  return peak;
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function createAudioCaptureHook({
  messages = {},
  getUserMediaImpl = defaultGetUserMediaImpl,
  audioContextFactory = defaultAudioContextFactory
}: CreateAudioCaptureHookOptions = {}) {
  const resolvedMessages: AudioCaptureMessages = { ...DEFAULT_MESSAGES, ...messages };

  let activeCleanup: (() => void) | undefined;

  function cancel(): void {
    activeCleanup?.();
    activeCleanup = undefined;
  }

  async function start(options: StartCaptureOptions = {}): Promise<void> {
    const { onStateChange, onCountdown, onLevel, onElapsedMs, onError, onComplete } = options;

    cancel();

    let cancelled = false;
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    const intervalIds: ReturnType<typeof setInterval>[] = [];

    function clearTimers(): void {
      timeoutIds.splice(0).forEach((id) => clearTimeout(id));
      intervalIds.splice(0).forEach((id) => clearInterval(id));
    }

    function teardown(): void {
      clearTimers();
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    }

    activeCleanup = () => {
      cancelled = true;
      teardown();
    };

    // Releases whatever was acquired; reports the failure unless the caller
    // has already cancelled this capture.
    function fail(): void {
      teardown();
      if (cancelled) {
        return;
      }
      activeCleanup = undefined;
      onStateChange?.('error');
      onError?.(resolvedMessages.permissionDenied);
    }

    try {
      stream = await getUserMediaImpl({ audio: { channelCount: 1 } });
    } catch {
      fail();
      return;
    }

    if (cancelled) {
      teardown();
      return;
    }

    try {
      audioContext = audioContextFactory();
      await audioContext.resume();
    } catch {
      fail();
      return;
    }

    if (cancelled) {
      teardown();
      return;
    }

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    const chunks: Float32Array[] = [];
    let capturing = false;

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!capturing) {
        return;
      }
      chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };

    function finish(): void {
      capturing = false;
      const channelData = concatFloat32(chunks);
      const sampleRate = audioContext!.sampleRate;
      teardown();
      activeCleanup = undefined;
      onComplete?.({ channelData, sampleRate });
    }

    function beginRecording(): void {
      if (cancelled) {
        return;
      }

      capturing = true;
      onStateChange?.('recording');

      const startedAt = Date.now();
      const levelBuffer = new Uint8Array(analyser.fftSize);
      const levelIntervalId = setInterval(() => {
        analyser.getByteTimeDomainData(levelBuffer);
        onLevel?.(computePeakLevel(levelBuffer));
        onElapsedMs?.(Date.now() - startedAt);
      }, LEVEL_INTERVAL_MS);
      intervalIds.push(levelIntervalId);

      const stopId = setTimeout(finish, DEFAULT_CAPTURE_DURATION_MS);
      timeoutIds.push(stopId);
    }

    onStateChange?.('preroll');
    let remaining = DEFAULT_PREROLL_SECONDS;
    onCountdown?.(remaining);

    function scheduleCountdownTick(): void {
      const id = setTimeout(() => {
        if (cancelled) {
          return;
        }
        remaining -= 1;
        if (remaining > 0) {
          onCountdown?.(remaining);
          scheduleCountdownTick();
        } else {
          beginRecording();
        }
      }, 1000);
      timeoutIds.push(id);
    }
    scheduleCountdownTick();
  }

  return { start, cancel };
}
