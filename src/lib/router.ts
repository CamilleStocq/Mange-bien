import { useEffect, useState } from 'react';

export interface Route {
  path: string; // ex. /recette/chili
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/aujourdhui';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs ?? '') };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(hash: string) {
  location.hash = hash.startsWith('#') ? hash : `#${hash}`;
}

export function back(fallback = '/aujourdhui') {
  if (history.length > 1) history.back();
  else go(fallback);
}
