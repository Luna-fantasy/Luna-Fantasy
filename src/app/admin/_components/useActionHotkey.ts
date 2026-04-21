'use client';

import { useEffect } from 'react';

/**
 * useActionHotkey — register a single-key action handler scoped to the page.
 * Skips when focus is in an input / textarea / contenteditable so typed
 * characters never trigger actions. Pages using this should also show a
 * "? for shortcuts" hint so users can discover them.
 */

interface Opts {
  /** Key to match (lowercase). Examples: 'b', 'm', 'c', 'e'. */
  key: string;
  /** Enabled flag — disable when a modal/dropdown is open. */
  enabled?: boolean;
  /** Require a modifier alongside the key (rare — e.g. Shift). */
  shift?: boolean;
}

export function useActionHotkey(handler: () => void, opts: Opts): void {
  const { key, enabled = true, shift = false } = opts;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (shift !== e.shiftKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler, key, enabled, shift]);
}
