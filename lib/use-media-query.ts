'use client';
import { useEffect, useState } from 'react';

/**
 * SSR-safe media query hook. Returns `defaultValue` until mount, then the
 * actual MediaQueryList match state. Subscribes to changes so resizing
 * across the breakpoint flips the result.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
