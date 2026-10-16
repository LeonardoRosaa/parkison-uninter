import { describe, expect, it, vi } from 'vitest';
import {
  buildSocketUrl,
  createAnalysisSocketHook,
  parseSocketPayload,
  type SocketLike
} from './useAnalysisSocket';

describe('useAnalysisSocket', () => {
  it('puts the request id where the configured URL has its placeholder', () => {
    expect(buildSocketUrl('wss://api.example.com/ws/{requestId}', 'abc')).toBe(
      'wss://api.example.com/ws/abc'
    );
    expect(buildSocketUrl('wss://api.example.com/ws/{requestId}?v=2', 'abc')).toBe(
      'wss://api.example.com/ws/abc?v=2'
    );
  });

  it('appends the request id to a configured URL that has no placeholder', () => {
    expect(buildSocketUrl('ws://localhost:8000/ws/', 'abc')).toBe('ws://localhost:8000/ws/abc');
    expect(buildSocketUrl('ws://localhost:8000/ws', 'abc')).toBe('ws://localhost:8000/ws/abc');
  });

  it('reads each websocket payload as a result, a failure, or still pending', () => {
    expect(parseSocketPayload(JSON.stringify({ status: 'health' }))).toEqual({
      kind: 'result',
      healthy: true
    });

    expect(parseSocketPayload(JSON.stringify({ status: 'nonhealthy' }))).toEqual({
      kind: 'result',
      healthy: false
    });

    expect(parseSocketPayload(JSON.stringify({ status: 'loading' }))).toEqual({ kind: 'pending' });

    expect(parseSocketPayload(JSON.stringify({ status: 'error' }))).toEqual({
      kind: 'failed',
      reason: 'error'
    });

    expect(parseSocketPayload(JSON.stringify({ status: 'timeout' }))).toEqual({
      kind: 'failed',
      reason: 'timeout'
    });

    expect(parseSocketPayload('not-json')).toEqual({ kind: 'pending' });
    expect(parseSocketPayload(new Uint8Array([1, 2, 3]))).toEqual({ kind: 'pending' });
  });

  it('keeps the voice metrics delivered with a successful result', () => {
    const parsed = parseSocketPayload(
      JSON.stringify({
        status: 'nonhealthy',
        metrics: { f0_hz: 154.2, jitter_percent: 0.39, shimmer_percent: null, hnr_db: 21.4 }
      })
    );

    expect(parsed).toEqual({
      kind: 'result',
      healthy: false,
      metrics: { f0Hz: 154.2, jitterPercent: 0.39, shimmerPercent: null, hnrDb: 21.4 }
    });
  });

  it('treats malformed metric values as not measured', () => {
    const parsed = parseSocketPayload(
      JSON.stringify({ status: 'health', metrics: { f0_hz: '154', jitter_percent: 0.39 } })
    );

    expect(parsed).toEqual({
      kind: 'result',
      healthy: true,
      metrics: { f0Hz: null, jitterPercent: 0.39, shimmerPercent: null, hnrDb: null }
    });
  });

  it('reports no metrics when the result carries none', () => {
    expect(parseSocketPayload(JSON.stringify({ status: 'health' }))).toEqual({
      kind: 'result',
      healthy: true,
      metrics: undefined
    });
    expect(
      parseSocketPayload(JSON.stringify({ status: 'error', metrics: { f0_hz: 1 } }))
    ).toStrictEqual({ kind: 'failed', reason: 'error' });
  });

  it('opens the socket for the request and emits parsed messages', () => {
    const socket: SocketLike = {
      readyState: typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1,
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };

    const webSocketFactory = vi.fn().mockReturnValue(socket);
    const onMessage = vi.fn();

    const hook = createAnalysisSocketHook({
      webSocketFactory,
      wsUrl: 'wss://api.example.com/ws/{requestId}'
    });

    hook.connect({ requestId: 'request-9', onMessage });

    expect(webSocketFactory).toHaveBeenCalledTimes(1);
    expect(webSocketFactory).toHaveBeenCalledWith('wss://api.example.com/ws/request-9');

    socket.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ status: 'nonhealthy' })
      })
    );

    expect(onMessage).toHaveBeenCalledWith({ kind: 'result', healthy: false });
  });

  it('reports the socket closing and surfaces socket errors', () => {
    const socket: SocketLike = {
      readyState: typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1,
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };

    const onClose = vi.fn();
    const onError = vi.fn();

    const hook = createAnalysisSocketHook({
      webSocketFactory: vi.fn().mockReturnValue(socket)
    });

    hook.connect({ requestId: 'request-10', onError, onClose });

    socket.onclose?.({} as CloseEvent);
    expect(onClose).toHaveBeenCalledTimes(1);

    socket.onclose = null;
    socket.onerror?.(new Event('error'));
    expect(onError).toHaveBeenCalledWith('Connection error while waiting for analysis updates.');
  });

  it('disconnects previous socket before reconnecting and on returned cleanup', () => {
    const openState = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;

    const firstSocket: SocketLike = {
      readyState: openState,
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };

    const secondSocket: SocketLike = {
      readyState: openState,
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };

    const webSocketFactory = vi
      .fn()
      .mockReturnValueOnce(firstSocket)
      .mockReturnValueOnce(secondSocket);

    const hook = createAnalysisSocketHook({ webSocketFactory });

    const cleanupFirst = hook.connect({ requestId: 'first' });
    hook.connect({ requestId: 'second' });

    expect(firstSocket.close).toHaveBeenCalledTimes(1);

    cleanupFirst();
    expect(secondSocket.close).toHaveBeenCalledTimes(1);
  });

  it('stops reporting events once disconnected', () => {
    const socket: SocketLike = {
      readyState: typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1,
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };
    const hook = createAnalysisSocketHook({ webSocketFactory: vi.fn().mockReturnValue(socket) });

    hook.connect({ requestId: 'request-11', onMessage: vi.fn(), onClose: vi.fn() });
    hook.disconnect();

    expect(socket.onmessage).toBeNull();
    expect(socket.onerror).toBeNull();
    expect(socket.onclose).toBeNull();
  });
});
