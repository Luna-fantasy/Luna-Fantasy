'use client';

import { useEffect, useRef, useState } from 'react';

interface Handlers {
  onActivate?: (index: number) => void;   // Enter
  onSelect?: (index: number) => void;     // Space
  onFocus?: (index: number) => void;      // ←→ arrow focus changes
  enabled?: boolean;
}

/**
 * useTableKeys — attach arrow-key / j/k / Home/End / Enter / Space navigation
 * to any list of rows. Returns a ref to put on the scroll container (or table
 * itself), and the current `activeIndex`. Consumers should render a
 * `[data-active="true"]` marker on the active row for styling.
 */
export function useTableKeys(count: number, handlers: Handlers = {}) {
  const { onActivate, onSelect, onFocus, enabled = true } = handlers;
  const [active, setActive] = useState<number>(0);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (count === 0) return;
      let next = active;
      if (e.key === 'ArrowDown' || e.key === 'j') next = Math.min(count - 1, active + 1);
      else if (e.key === 'ArrowUp' || e.key === 'k') next = Math.max(0, active - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = count - 1;
      else if (e.key === 'PageDown') next = Math.min(count - 1, active + 10);
      else if (e.key === 'PageUp') next = Math.max(0, active - 10);
      else if (e.key === 'Enter') { e.preventDefault(); onActivate?.(active); return; }
      else if (e.key === ' ') { e.preventDefault(); onSelect?.(active); return; }
      else return;
      if (next !== active) {
        e.preventDefault();
        setActive(next);
        onFocus?.(next);
        // Scroll the active row into view
        const row = el.querySelector<HTMLElement>(`[data-row-index="${next}"]`);
        row?.scrollIntoView({ block: 'nearest' });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, active, enabled, onActivate, onSelect, onFocus]);

  // Clamp active index if count shrinks
  useEffect(() => {
    if (active >= count) setActive(Math.max(0, count - 1));
  }, [count, active]);

  return { containerRef: ref as React.MutableRefObject<any>, active, setActive };
}
