import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioCaptureHook, isCaptureSupported } from './useAudioCapture';

class FakeAudioParam {
  value = 0;
}

class FakeAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeScriptProcessorNode extends FakeAudioNode {
  onaudioprocess: ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void) | null =
    null;
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakeAnalyserNode extends FakeAudioNode {
  fftSize = 2048;
  fillValue = 128;

  getByteTimeDomainData(buffer: Uint8Array): void {
    buffer.fill(this.fillValue);
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  sampleRate = 48000;
  destination = new FakeAudioNode();
  closeMock = vi.fn();
  resume = vi.fn().mockResolvedValue(undefined);
  lastProcessor: FakeScriptProcessorNode | undefined;
  lastAnalyser: FakeAnalyserNode | undefined;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createMediaStreamSource(): FakeAudioNode {
    return new FakeAudioNode();
  }

  createAnalyser(): FakeAnalyserNode {
    const analyser = new FakeAnalyserNode();
    this.lastAnalyser = analyser;
    return analyser;
  }

  createScriptProcessor(): FakeScriptProcessorNode {
    const processor = new FakeScriptProcessorNode();
    this.lastProcessor = processor;
    return processor;
  }

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  close(): Promise<void> {
    this.closeMock();
    return Promise.resolve();
  }
}

function lastContext(): FakeAudioContext | undefined {
  return FakeAudioContext.instances[FakeAudioContext.instances.length - 1];
}

function makeStream(stopMock: ReturnType<typeof vi.fn> = vi.fn()) {
  return {
    getTracks: () => [{ stop: stopMock }]
  } as unknown as MediaStream;
}

function stubSupportedGlobals() {
  vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn()
    }
  });
}

describe('isCaptureSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error cleanup test-only override
    delete navigator.mediaDevices;
  });

  it('does not require MediaRecorder, which capture never uses', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() }
    });
    vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext);

    expect(isCaptureSupported()).toBe(true);
  });

  it('returns false when getUserMedia is missing', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext);

    expect(isCaptureSupported()).toBe(false);
  });

  it('returns false when AudioContext is missing', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() }
    });

    expect(isCaptureSupported()).toBe(false);
  });

  it('returns true when all capture APIs are present', () => {
    stubSupportedGlobals();

    expect(isCaptureSupported()).toBe(true);
  });
});

describe('createAudioCaptureHook', () => {
  let getUserMediaImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudioContext.instances = [];
    getUserMediaImpl = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeHook(messages?: { permissionDenied?: string }) {
    return createAudioCaptureHook({
      messages,
      getUserMediaImpl,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext
    });
  }

  it('does not request microphone access until start is called', () => {
    makeHook();

    expect(getUserMediaImpl).not.toHaveBeenCalled();
  });

  it('requests mono audio and reports an error when permission is denied', async () => {
    getUserMediaImpl.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

    const onStateChange = vi.fn();
    const onError = vi.fn();

    const hook = makeHook();
    await hook.start({ onStateChange, onError });

    expect(getUserMediaImpl).toHaveBeenCalledWith({ audio: { channelCount: 1 } });
    expect(onStateChange).toHaveBeenCalledWith('error');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Upload'));
  });

  it('reports a custom permission-denied message when the hook is configured with one', async () => {
    getUserMediaImpl.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

    const onError = vi.fn();
    const hook = makeHook({ permissionDenied: 'Acesso negado ao microfone.' });
    await hook.start({ onError });

    expect(onError).toHaveBeenCalledWith('Acesso negado ao microfone.');
  });

  it('resumes the audio context after creating it', async () => {
    getUserMediaImpl.mockResolvedValue(makeStream());

    const hook = makeHook();
    await hook.start({});

    expect(lastContext()?.resume).toHaveBeenCalled();
  });

  it('runs a 3-2-1 preroll countdown before recording starts', async () => {
    const stopMock = vi.fn();
    getUserMediaImpl.mockResolvedValue(makeStream(stopMock));

    const onStateChange = vi.fn();
    const onCountdown = vi.fn();

    const hook = makeHook();
    await hook.start({ onStateChange, onCountdown });

    expect(onStateChange).toHaveBeenCalledWith('preroll');
    expect(onCountdown).toHaveBeenNthCalledWith(1, 3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onCountdown).toHaveBeenNthCalledWith(2, 2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onCountdown).toHaveBeenNthCalledWith(3, 1);
    expect(onStateChange).not.toHaveBeenCalledWith('recording');

    await vi.advanceTimersByTimeAsync(1000);
    expect(onStateChange).toHaveBeenCalledWith('recording');
  });

  it('reports live audio levels and elapsed time while recording', async () => {
    getUserMediaImpl.mockResolvedValue(makeStream());

    const onLevel = vi.fn();
    const onElapsedMs = vi.fn();

    const hook = makeHook();
    await hook.start({ onLevel, onElapsedMs });

    await vi.advanceTimersByTimeAsync(3000);

    const analyser = lastContext()?.lastAnalyser;
    expect(analyser).toBeDefined();
    if (analyser) {
      analyser.fillValue = 200;
    }

    await vi.advanceTimersByTimeAsync(200);

    expect(onLevel).toHaveBeenCalled();
    const [level] = onLevel.mock.calls[onLevel.mock.calls.length - 1];
    expect(level).toBeGreaterThan(0);
    expect(onElapsedMs).toHaveBeenCalled();
  });

  it('auto-stops after ~8s, closes the mic stream, and returns captured mono audio', async () => {
    const stopMock = vi.fn();
    getUserMediaImpl.mockResolvedValue(makeStream(stopMock));

    const onStateChange = vi.fn();
    const onComplete = vi.fn();

    const hook = makeHook();
    await hook.start({ onStateChange, onComplete });

    await vi.advanceTimersByTimeAsync(3000);

    const processor = lastContext()?.lastProcessor;
    expect(processor).toBeDefined();

    const frameA = new Float32Array([0.1, 0.2, 0.3]);
    const frameB = new Float32Array([0.4, 0.5]);
    processor?.onaudioprocess?.({ inputBuffer: { getChannelData: () => frameA } });
    processor?.onaudioprocess?.({ inputBuffer: { getChannelData: () => frameB } });

    await vi.advanceTimersByTimeAsync(8000);

    expect(onComplete).toHaveBeenCalledTimes(1);
    const captured = onComplete.mock.calls[0][0];
    expect(captured.sampleRate).toBe(48000);
    expect(Array.from(captured.channelData as Float32Array)).toEqual(
      Array.from(new Float32Array([...frameA, ...frameB]))
    );

    expect(stopMock).toHaveBeenCalled();
    expect(lastContext()?.closeMock).toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalledWith('error');
  });

  it('ignores audio frames captured before recording begins or after auto-stop', async () => {
    getUserMediaImpl.mockResolvedValue(makeStream());

    const onComplete = vi.fn();
    const hook = makeHook();
    await hook.start({ onComplete });

    const processor = lastContext()?.lastProcessor;
    processor?.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array([9, 9]) } });

    await vi.advanceTimersByTimeAsync(3000 + 8000);

    const captured = onComplete.mock.calls[0][0];
    expect(Array.from(captured.channelData as Float32Array)).toEqual([]);
  });

  it('cancelling mid-capture stops the stream and never calls onComplete', async () => {
    const stopMock = vi.fn();
    getUserMediaImpl.mockResolvedValue(makeStream(stopMock));

    const onComplete = vi.fn();
    const hook = makeHook();
    await hook.start({ onComplete });

    await vi.advanceTimersByTimeAsync(3000);
    hook.cancel();

    await vi.advanceTimersByTimeAsync(8000);

    expect(onComplete).not.toHaveBeenCalled();
    expect(stopMock).toHaveBeenCalled();
    expect(lastContext()?.closeMock).toHaveBeenCalled();
  });

  it('releases the microphone and audio context when the context cannot start', async () => {
    const stopMock = vi.fn();
    getUserMediaImpl.mockResolvedValue(makeStream(stopMock));
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();

    const hook = createAudioCaptureHook({
      getUserMediaImpl,
      audioContextFactory: () =>
        ({
          resume: vi.fn().mockRejectedValue(new Error('blocked')),
          close: closeMock
        }) as unknown as AudioContext
    });
    await hook.start({ onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(stopMock).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
  });
});
