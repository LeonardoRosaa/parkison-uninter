export type Route = { name: 'upload' } | { name: 'analysis'; id: string };

type RouteListener = (route: Route) => void;

const UPLOAD_PATH = '/';
const ANALYSIS_PREFIX = '/analysis/';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRequestId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function analysisPath(id: string): string {
  return `${ANALYSIS_PREFIX}${id}`;
}

export function matchRoute(pathname: string): Route | null {
  if (pathname === UPLOAD_PATH || pathname === '') {
    return { name: 'upload' };
  }

  if (pathname.startsWith(ANALYSIS_PREFIX)) {
    const id = pathname.slice(ANALYSIS_PREFIX.length).replace(/\/$/, '');
    if (id && !id.includes('/')) {
      return { name: 'analysis', id };
    }
  }

  return null;
}

export function createRouter(target: Window = window) {
  const listeners = new Set<RouteListener>();

  function write(path: string, replace: boolean): void {
    const url = `${path}${target.location.search}`;
    if (replace) {
      target.history.replaceState(null, '', url);
    } else {
      target.history.pushState(null, '', url);
    }
  }

  function current(): Route {
    const route = matchRoute(target.location.pathname);
    if (route) {
      return route;
    }

    write(UPLOAD_PATH, true);
    return { name: 'upload' };
  }

  function notify(): void {
    const route = current();
    listeners.forEach((listener) => listener(route));
  }

  function navigate(path: string): void {
    write(path, false);
    notify();
  }

  function subscribe(listener: RouteListener): () => void {
    if (listeners.size === 0) {
      target.addEventListener('popstate', notify);
    }
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        target.removeEventListener('popstate', notify);
      }
    };
  }

  return { current, navigate, subscribe };
}
