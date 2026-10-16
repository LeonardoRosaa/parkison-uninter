import { getTranslations } from '../i18n';

const REQUEST_ID_PLACEHOLDER = '{requestId}';
const CONFIGURED_WS_URL: string =
  import.meta.env.VITE_WS_URL || `ws://localhost:8000/ws/${REQUEST_ID_PLACEHOLDER}`;

export interface SocketLike {
  readyState: number;
  close(): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

interface CreateAnalysisSocketHookOptions {
  wsUrl?: string;
  webSocketFactory?: (url: string) => SocketLike;
  messages?: Partial<SocketMessages>;
}

interface SocketMessages {
  connectionError: string;
}

const DEFAULT_MESSAGES: SocketMessages = {
  connectionError: getTranslations('en').hooks.socketConnectionError
};

interface ConnectSocketOptions {
  requestId: string;
  onMessage?: (update: AnalysisUpdate) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

export interface AnalysisMetrics {
  f0Hz: number | null;
  jitterPercent: number | null;
  shimmerPercent: number | null;
  hnrDb: number | null;
}

/** What one message from the server means for the analysis being followed. */
export type AnalysisUpdate =
  | { kind: 'pending' }
  | { kind: 'result'; healthy: boolean; metrics?: AnalysisMetrics }
  | { kind: 'failed'; reason: 'error' | 'timeout' };

/**
 * The socket URL for a request: the id replaces `{requestId}` in the
 * template, or is appended as the last path segment when there is none.
 */
export function buildSocketUrl(template: string, requestId: string): string {
  if (template.includes(REQUEST_ID_PLACEHOLDER)) {
    return template.replace(REQUEST_ID_PLACEHOLDER, requestId);
  }

  return `${template.replace(/\/$/, '')}/${requestId}`;
}

function parseMetrics(rawMetrics: unknown): AnalysisMetrics | undefined {
  if (typeof rawMetrics !== 'object' || rawMetrics === null || Array.isArray(rawMetrics)) {
    return undefined;
  }

  const source = rawMetrics as Record<string, unknown>;
  const measured = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  return {
    f0Hz: measured(source['f0_hz']),
    jitterPercent: measured(source['jitter_percent']),
    shimmerPercent: measured(source['shimmer_percent']),
    hnrDb: measured(source['hnr_db'])
  };
}

export function parseSocketPayload(rawData: unknown): AnalysisUpdate {
  let payload: Record<string, unknown> | null = null;

  try {
    payload = typeof rawData === 'string' ? JSON.parse(rawData) : null;
  } catch {
    payload = null;
  }

  const status = payload?.['status'];

  if (status === 'health' || status === 'nonhealthy') {
    return {
      kind: 'result',
      healthy: status === 'health',
      metrics: parseMetrics(payload?.['metrics'])
    };
  }

  if (status === 'error' || status === 'timeout') {
    return { kind: 'failed', reason: status };
  }

  return { kind: 'pending' };
}

export function createAnalysisSocketHook({
  wsUrl = CONFIGURED_WS_URL,
  webSocketFactory = (url: string) => new WebSocket(url),
  messages = {}
}: CreateAnalysisSocketHookOptions = {}) {
  const resolvedMessages: SocketMessages = {
    ...DEFAULT_MESSAGES,
    ...messages
  };

  let socket: SocketLike | undefined;

  function disconnect(): void {
    if (!socket) {
      return;
    }

    const openState = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
    const connectingState = typeof WebSocket !== 'undefined' ? WebSocket.CONNECTING : 0;
    const shouldClose = socket.readyState === openState || socket.readyState === connectingState;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (shouldClose) {
      socket.close();
    }

    socket = undefined;
  }

  function connect({ requestId, onMessage, onError, onClose }: ConnectSocketOptions): () => void {
    disconnect();
    socket = webSocketFactory(buildSocketUrl(wsUrl, requestId));

    socket.onmessage = (event) => {
      onMessage?.(parseSocketPayload(event.data));
    };

    socket.onerror = (_event) => {
      onError?.(resolvedMessages.connectionError);
    };

    socket.onclose = (_event) => {
      onClose?.();
    };

    return disconnect;
  }

  return {
    connect,
    disconnect
  };
}
