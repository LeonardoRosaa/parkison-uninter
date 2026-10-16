import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisPath, createRouter, isRequestId, matchRoute } from './router';

const REQUEST_ID = '3f0c1a52-8f0e-4a55-9d6b-2f8a3f6f1c11';

describe('router', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('matches the upload and analysis routes', () => {
    expect(matchRoute('/')).toEqual({ name: 'upload' });
    expect(matchRoute(`/analysis/${REQUEST_ID}`)).toEqual({ name: 'analysis', id: REQUEST_ID });
    expect(matchRoute(`/analysis/${REQUEST_ID}/`)).toEqual({ name: 'analysis', id: REQUEST_ID });
    expect(matchRoute('/analysis/')).toBeNull();
    expect(matchRoute('/somewhere/else')).toBeNull();
  });

  it('builds the analysis path for a request id', () => {
    expect(analysisPath(REQUEST_ID)).toBe(`/analysis/${REQUEST_ID}`);
  });

  it('recognises only UUIDs as request ids', () => {
    expect(isRequestId(REQUEST_ID)).toBe(true);
    expect(isRequestId(REQUEST_ID.toUpperCase())).toBe(true);
    expect(isRequestId('not-a-uuid')).toBe(false);
    expect(isRequestId('')).toBe(false);
  });

  it('pushes a history entry and notifies subscribers on navigate', () => {
    const router = createRouter();
    const listener = vi.fn();
    router.subscribe(listener);
    const entriesBefore = window.history.length;

    router.navigate(analysisPath(REQUEST_ID));

    expect(window.location.pathname).toBe(`/analysis/${REQUEST_ID}`);
    expect(window.history.length).toBe(entriesBefore + 1);
    expect(router.current()).toEqual({ name: 'analysis', id: REQUEST_ID });
    expect(listener).toHaveBeenLastCalledWith({ name: 'analysis', id: REQUEST_ID });
  });

  it('keeps the query string across navigation', () => {
    window.history.replaceState(null, '', '/?lang=pt-BR');
    const router = createRouter();

    router.navigate(analysisPath(REQUEST_ID));

    expect(window.location.search).toBe('?lang=pt-BR');
  });

  it('notifies subscribers when the browser goes back or forward', () => {
    const router = createRouter();
    const listener = vi.fn();
    const unsubscribe = router.subscribe(listener);

    window.history.replaceState(null, '', `/analysis/${REQUEST_ID}`);
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(listener).toHaveBeenLastCalledWith({ name: 'analysis', id: REQUEST_ID });

    unsubscribe();
    listener.mockClear();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('replaces unknown paths with the upload route', () => {
    window.history.replaceState(null, '', '/somewhere/else');
    const router = createRouter();

    expect(router.current()).toEqual({ name: 'upload' });
    expect(window.location.pathname).toBe('/');
  });
});
