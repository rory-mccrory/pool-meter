import { useEffect, useState } from 'react';

export type Route =
  | { page: 'dashboard' }
  | { page: 'account'; id: string }
  | { page: 'import'; accountId?: string }
  | { page: 'settings' };

/** Hash routes work on any static host without rewrite rules. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'account' && parts[1]) return { page: 'account', id: parts[1] };
  if (parts[0] === 'import') return { page: 'import', accountId: parts[1] };
  if (parts[0] === 'settings') return { page: 'settings' };
  return { page: 'dashboard' };
}

export function href(route: Route): string {
  switch (route.page) {
    case 'account':
      return `#/account/${encodeURIComponent(route.id)}`;
    case 'import':
      return route.accountId ? `#/import/${encodeURIComponent(route.accountId)}` : '#/import';
    case 'settings':
      return '#/settings';
    default:
      return '#/';
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo?.(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
