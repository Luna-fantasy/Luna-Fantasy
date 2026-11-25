'use client';

import { useLayoutEffect, type MouseEvent } from 'react';

const shelfPosition = 'lunaBazaarShelfY';

function ordinaryClick(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
}

function cameFromShelf() {
  if (!document.referrer) return false;
  const previous = new URL(document.referrer);
  const shop = location.pathname.replace(/\/+$/, '');
  return previous.origin === location.origin && previous.pathname.replace(/\/+$/, '') === shop.slice(0, shop.lastIndexOf('/'));
}

// The document's scroll restoration and the framework's first layout can run
// on different frames. Apply the saved position through the initial layout.
function restorePosition(y: number, onRestored?: () => void) {
  const set = () => window.scrollTo({top: y, behavior: 'instant'});
  set();
  let frame = requestAnimationFrame(() => {
    set();
    frame = requestAnimationFrame(() => { set(); onRestored?.(); });
  });
  return () => cancelAnimationFrame(frame);
}

export function rememberShelf(event: MouseEvent<HTMLAnchorElement>) {
  if (ordinaryClick(event)) history.replaceState({...history.state, [shelfPosition]: {y: window.scrollY, at: Date.now()}}, '');
}

export function backToShelf(event: MouseEvent<HTMLAnchorElement>) {
  if (ordinaryClick(event) && cameFromShelf() && history.length > 1) {
    event.preventDefault();
    history.back();
  }
}

export function useShelfRestoration(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return;
    let cancel: (() => void) | undefined;
    function restore() {
      const saved = history.state?.[shelfPosition];
      const y = typeof saved === 'number' ? saved : saved?.y;
      if (!Number.isFinite(y)) return;
      cancel?.();
      cancel = restorePosition(y, () => {
        const current = history.state?.[shelfPosition];
        if (typeof saved === 'number' ? current !== saved : current?.at !== saved.at) return;
        const state = {...history.state};
        delete state[shelfPosition];
        history.replaceState(state, '');
      });
    }
    restore();
    window.addEventListener('pageshow', restore);
    return () => { window.removeEventListener('pageshow', restore); cancel?.(); };
  }, [enabled]);
}

export function useMerchantEntry(enabled: boolean) {
  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (enabled && window.scrollY > 0 && cameFromShelf() && !location.hash && navigation?.type === 'navigate') {
      window.scrollTo({top: 0, behavior: 'instant'});
    }
  }, [enabled]);
}
