export type Locale = 'en' | 'pt-BR';

interface ResolveLocaleOptions {
  preferredLocale?: string | null;
  search?: string | null;
  browserLocale?: string | null;
}

export interface AudioInputTexts {
  chooseAudioFile: string;
  readyForUpload: string;
  wavOnly: string;
  invalidFileError: string;
}

export interface AudioCaptureTexts {
  startButton: string;
  prerollInstruction: string;
  recordingInstruction: string;
  timeRemainingLabel: (secondsRemaining: number) => string;
  permissionDeniedError: string;
  silenceWarning: string;
  previewInstruction: string;
  useRecordingButton: string;
  reRecordButton: string;
}

export interface AppTexts {
  statusProcessing: string;
  statusAnalysisFailed: string;
  statusNoResult: string;
  statusUploadFailed: string;
  finalHealthPassed: string;
  finalHealthFailed: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  pipelineTitle: string;
  pipelineStep1: string;
  pipelineStep2: string;
  pipelineStep3: string;
  buttonLoading: string;
  buttonStartAnalysis: string;
  buttonNewAnalysis: string;
  requestIdLabel: string;
  tabUploadLabel: string;
  tabRecordLabel: string;
}

export interface MetricText {
  label: string;
  explanation: string;
}

export interface MetricsTexts {
  title: string;
  frequency: MetricText;
  jitter: MetricText;
  shimmer: MetricText;
  hnr: MetricText;
  notMeasured: string;
  disclaimer: string;
  infoButtonLabel: (label: string) => string;
}

export interface HookTexts {
  uploadInvalidFile: string;
  uploadFailedWithStatus: (status: number) => string;
  socketConnectionError: string;
}

export interface Translations {
  locale: Locale;
  app: AppTexts;
  metrics: MetricsTexts;
  audioInput: AudioInputTexts;
  audioCapture: AudioCaptureTexts;
  hooks: HookTexts;
}

const EN_TRANSLATIONS: Translations = {
  locale: 'en',
  app: {
    statusProcessing: 'Processing analysis...',
    statusAnalysisFailed: 'Analysis failed.',
    statusNoResult: 'No result received. The analysis may have expired or is taking too long.',
    statusUploadFailed: 'Audio upload failed.',
    finalHealthPassed: 'Health check passed. Analysis completed successfully.',
    finalHealthFailed: 'Health check failed. Analysis completed with issues.',
    heroEyebrow: 'Minimal Signal Workflow',
    heroTitle: 'Speech Analysis Monitor',
    heroSubtitle: 'A stripped-back workspace for one-file upload and real-time analysis feedback.',
    pipelineTitle: 'Pipeline',
    pipelineStep1: '1. Select a valid WAV recording.',
    pipelineStep2: '2. Start upload and queue processing.',
    pipelineStep3: '3. Track analysis status to final result.',
    buttonLoading: 'Loading...',
    buttonStartAnalysis: 'Start Analysis',
    buttonNewAnalysis: 'New analysis',
    requestIdLabel: 'Request ID:',
    tabUploadLabel: 'Upload',
    tabRecordLabel: 'Record'
  },
  metrics: {
    title: 'Voice measurements',
    frequency: {
      label: 'Frequency',
      explanation: 'The average pitch of your voice. Higher numbers mean a higher-pitched voice.'
    },
    jitter: {
      label: 'Jitter',
      explanation: 'How much the pitch of your voice wavers from one instant to the next.'
    },
    shimmer: {
      label: 'Shimmer',
      explanation: 'How much the loudness of your voice wavers from one instant to the next.'
    },
    hnr: {
      label: 'HNR',
      explanation:
        'How clear your voice is compared with breathiness or noise. Higher means clearer.'
    },
    notMeasured: "Couldn't be measured in this recording.",
    disclaimer: 'These measurements describe your recording and are not a diagnosis.',
    infoButtonLabel: (label: string) => `What is ${label}?`
  },
  audioInput: {
    chooseAudioFile: 'Choose an audio file',
    readyForUpload: 'Ready for upload',
    wavOnly: 'WAV format only',
    invalidFileError: 'Only WAV files are supported.'
  },
  audioCapture: {
    startButton: 'Start Recording',
    prerollInstruction: 'Get ready to hold a steady vowel sound...',
    recordingInstruction: 'Hold a steady vowel sound, like "ahh".',
    timeRemainingLabel: (secondsRemaining: number) => `${secondsRemaining}s remaining`,
    permissionDeniedError:
      'Microphone access was denied. You can use the Upload tab to submit a recording instead.',
    silenceWarning: 'No voice detected, please try again.',
    previewInstruction: 'Listen to your recording before continuing.',
    useRecordingButton: 'Use this recording',
    reRecordButton: 'Re-record'
  },
  hooks: {
    uploadInvalidFile: 'Select or record an audio file before uploading.',
    uploadFailedWithStatus: (status: number) => `Upload failed with status ${status}.`,
    socketConnectionError: 'Connection error while waiting for analysis updates.'
  }
};

const PT_BR_TRANSLATIONS: Translations = {
  locale: 'pt-BR',
  app: {
    statusProcessing: 'Processando análise...',
    statusAnalysisFailed: 'A análise falhou.',
    statusNoResult:
      'Nenhum resultado recebido. A análise pode ter expirado ou está demorando demais.',
    statusUploadFailed: 'Falha no envio do áudio.',
    finalHealthPassed: 'Verificação aprovada. Análise concluída com sucesso.',
    finalHealthFailed: 'Verificação reprovada. Análise concluída com problemas.',
    heroEyebrow: 'Fluxo Mínimo de Sinal',
    heroTitle: 'Monitor de Análise de Fala',
    heroSubtitle: 'Um espaço enxuto para envio de um arquivo e feedback da análise em tempo real.',
    pipelineTitle: 'Fluxo',
    pipelineStep1: '1. Selecione uma gravação WAV válida.',
    pipelineStep2: '2. Inicie o envio e coloque o processamento na fila.',
    pipelineStep3: '3. Acompanhe o status da análise até o resultado final.',
    buttonLoading: 'Carregando...',
    buttonStartAnalysis: 'Iniciar Análise',
    buttonNewAnalysis: 'Nova análise',
    requestIdLabel: 'ID da requisição:',
    tabUploadLabel: 'Enviar',
    tabRecordLabel: 'Gravar'
  },
  metrics: {
    title: 'Medidas da voz',
    frequency: {
      label: 'Frequência',
      explanation: 'O tom médio da sua voz. Números maiores indicam uma voz mais aguda.'
    },
    jitter: {
      label: 'Jitter',
      explanation: 'O quanto o tom da sua voz oscila de um instante para o outro.'
    },
    shimmer: {
      label: 'Shimmer',
      explanation: 'O quanto o volume da sua voz oscila de um instante para o outro.'
    },
    hnr: {
      label: 'HNR',
      explanation:
        'O quanto sua voz é limpa em relação a ruído ou soprosidade. Quanto maior, mais limpa.'
    },
    notMeasured: 'Não foi possível medir nesta gravação.',
    disclaimer: 'Estas medidas descrevem a sua gravação e não são um diagnóstico.',
    infoButtonLabel: (label: string) => `O que é ${label}?`
  },
  audioInput: {
    chooseAudioFile: 'Escolher arquivo de áudio',
    readyForUpload: 'Pronto para envio',
    wavOnly: 'Somente formato WAV',
    invalidFileError: 'Somente arquivos WAV são aceitos.'
  },
  audioCapture: {
    startButton: 'Iniciar Gravação',
    prerollInstruction: 'Prepare-se para manter um som de vogal estável...',
    recordingInstruction: 'Mantenha um som de vogal estável, como "ááá".',
    timeRemainingLabel: (secondsRemaining: number) => `${secondsRemaining}s restantes`,
    permissionDeniedError:
      'O acesso ao microfone foi negado. Você pode usar a aba Enviar para enviar uma gravação.',
    silenceWarning: 'Nenhuma voz detectada, tente novamente.',
    previewInstruction: 'Ouça sua gravação antes de continuar.',
    useRecordingButton: 'Usar esta gravação',
    reRecordButton: 'Gravar novamente'
  },
  hooks: {
    uploadInvalidFile: 'Selecione ou grave um arquivo de áudio antes de enviar.',
    uploadFailedWithStatus: (status: number) => `Falha no envio com status ${status}.`,
    socketConnectionError: 'Erro de conexão enquanto aguardava atualizações da análise.'
  }
};

const TRANSLATIONS: Record<Locale, Translations> = {
  en: EN_TRANSLATIONS,
  'pt-BR': PT_BR_TRANSLATIONS
};

function parseSupportedLocale(locale: string | null | undefined): Locale | null {
  if (!locale) {
    return null;
  }

  const normalized = locale.trim().toLowerCase();

  if (normalized === 'pt-br' || normalized === 'pt_br' || normalized === 'pt') {
    return 'pt-BR';
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  return null;
}

function parseLocaleFromSearch(search: string | null | undefined): Locale | null {
  if (!search) {
    return null;
  }

  const params = new URLSearchParams(search);
  const localeParam = params.get('locale') ?? params.get('lang');
  return parseSupportedLocale(localeParam);
}

/**
 * The locale to render in. A `?locale=` / `?lang=` query param wins, then the
 * configured locale, then the browser language; anything unsupported is
 * skipped, and English is the last resort.
 */
export function resolveLocale(
  preferredLocaleOrOptions?: string | ResolveLocaleOptions | null
): Locale {
  const options: ResolveLocaleOptions =
    typeof preferredLocaleOrOptions === 'string' || preferredLocaleOrOptions == null
      ? { preferredLocale: preferredLocaleOrOptions }
      : preferredLocaleOrOptions;

  const search = options.search ?? (typeof location !== 'undefined' ? location.search : null);
  const browserLocale =
    options.browserLocale ?? (typeof navigator !== 'undefined' ? navigator.language : null);

  return (
    parseLocaleFromSearch(search) ??
    parseSupportedLocale(options.preferredLocale) ??
    parseSupportedLocale(browserLocale) ??
    'en'
  );
}

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}
