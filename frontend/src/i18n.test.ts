import { describe, expect, it } from 'vitest';
import { getTranslations, resolveLocale } from './i18n';

describe('i18n', () => {
  it('defaults to pt-BR without a URL param or configured locale', () => {
    expect(resolveLocale({ search: '' })).toBe('pt-BR');
    expect(resolveLocale({ preferredLocale: '', search: '' })).toBe('pt-BR');
  });

  it('resolves pt-BR aliases correctly', () => {
    expect(resolveLocale({ preferredLocale: 'pt-BR', search: '' })).toBe('pt-BR');
    expect(resolveLocale({ preferredLocale: 'pt_br', search: '' })).toBe('pt-BR');
    expect(resolveLocale({ preferredLocale: 'pt', search: '' })).toBe('pt-BR');
  });

  it('uses english when the configured locale is english', () => {
    expect(resolveLocale({ preferredLocale: 'en', search: '' })).toBe('en');
    expect(resolveLocale({ preferredLocale: 'en-US', search: '' })).toBe('en');
  });

  it('resolves locale from URL query params', () => {
    expect(resolveLocale({ search: '?lang=en' })).toBe('en');
    expect(resolveLocale({ search: '?locale=pt' })).toBe('pt-BR');
  });

  it('lets a URL query param override the configured locale', () => {
    expect(resolveLocale({ preferredLocale: 'en', search: '?lang=pt-BR' })).toBe('pt-BR');
    expect(resolveLocale({ preferredLocale: 'pt-BR', search: '?lang=en' })).toBe('en');
  });

  it('falls back to pt-BR for unsupported values', () => {
    expect(resolveLocale({ search: '?lang=fr' })).toBe('pt-BR');
    expect(resolveLocale({ preferredLocale: 'fr-FR', search: '' })).toBe('pt-BR');
  });

  it('skips an unsupported URL param and uses the configured locale', () => {
    expect(resolveLocale({ preferredLocale: 'en', search: '?lang=fr' })).toBe('en');
  });

  it('returns translated labels for pt-BR', () => {
    const translations = getTranslations('pt-BR');

    expect(translations.app.buttonStartAnalysis).toBe('Iniciar Análise');
    expect(translations.app.buttonNewAnalysis).toBe('Nova análise');
  });
});
