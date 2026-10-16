import { getTranslations } from '../i18n';

const CONFIGURED_API_BASE: string = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export interface UploadResult {
  uuid: string;
  filename: string;
}

interface CreateUploadAudioHookOptions {
  apiBase?: string;
  fetchImpl?: typeof fetch;
  messages?: Partial<UploadMessages>;
}

interface UploadMessages {
  invalidFile: string;
  uploadFailedWithStatus: (status: number) => string;
}

const EN_TEXTS = getTranslations('en').hooks;
const DEFAULT_MESSAGES: UploadMessages = {
  invalidFile: EN_TEXTS.uploadInvalidFile,
  uploadFailedWithStatus: EN_TEXTS.uploadFailedWithStatus
};

export function createUploadAudioHook({
  apiBase = CONFIGURED_API_BASE,
  fetchImpl = fetch,
  messages = {}
}: CreateUploadAudioHookOptions = {}) {
  const resolvedMessages: UploadMessages = {
    ...DEFAULT_MESSAGES,
    ...messages
  };

  async function upload(file: File): Promise<UploadResult | null> {
    if (!(file instanceof File)) {
      throw new Error(resolvedMessages.invalidFile);
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchImpl(`${apiBase}/audios`, {
      method: 'POST',
      body: formData
    });

    let payload: UploadResult | null = null;
    try {
      payload = (await response.json()) as UploadResult;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(resolvedMessages.uploadFailedWithStatus(response.status));
    }

    return payload;
  }

  return { upload };
}
