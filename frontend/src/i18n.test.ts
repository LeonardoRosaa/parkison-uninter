import { describe, expect, it } from 'vitest';
import { getTranslations, resolveLocale } from './i18n';

describe('i18n', () => {
  it('resolves pt-BR aliases correctly', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR');
    expect(resolveLocale('pt_br')).toBe('pt-BR');
    expect(resolveLocale('pt')).toBe('pt-BR');
  });

  it('falls back to english for unsupported locales', () => {
    expect(resolveLocale({ preferredLocale: 'fr-FR', browserLocale: 'de-DE' })).toBe('en');
  });

  it('resolves locale from URL query params', () => {
    expect(resolveLocale({ search: '?lang=pt-BR' })).toBe('pt-BR');
    expect(resolveLocale({ search: '?locale=pt' })).toBe('pt-BR');
  });

  it('lets a URL query param override the configured locale', () => {
    expect(resolveLocale({ preferredLocale: 'en', search: '?lang=pt-BR' })).toBe('pt-BR');
  });

  it('uses the configured locale ahead of the browser language', () => {
    expect(resolveLocale({ preferredLocale: 'pt-BR', search: '', browserLocale: 'en-US' })).toBe(
      'pt-BR'
    );
  });

  it('ignores an unsupported configured locale instead of forcing english', () => {
    expect(resolveLocale({ preferredLocale: 'fr-FR', search: '?lang=pt' })).toBe('pt-BR');
    expect(resolveLocale({ preferredLocale: 'fr-FR', search: '', browserLocale: 'pt-BR' })).toBe(
      'pt-BR'
    );
  });

  it('returns translated labels for pt-BR', () => {
    const translations = getTranslations('pt-BR');

    expect(translations.app.buttonStartAnalysis).toBe('Iniciar Análise');
    expect(translations.app.buttonNewAnalysis).toBe('Nova análise');
  });
});
