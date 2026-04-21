'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface PendingAction {
  id: string;
  label: string;
  detail?: string;
  delayMs: number;
  startedAt: number;
  run: () => Promise<void> | void;
  onCancel?: () => void;
  tone?: 'default' | 'danger';
}

interface Ctx {
  action: PendingAction | null;
  queue: (input: Omit<PendingAction, 'id' | 'startedAt'>) => Promise<boolean>;
  cancel: () => void;
}

const C = createContext<Ctx | null>(null);

export function PendingActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<PendingAction | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (action) {
      action.onCancel?.();
      resolveRef.current?.(false);
      resolveRef.current = null;
    }
    setAction(null);
  }, [action]);

  const queue = useCallback<Ctx['queue']>(async (input) => {
    // If one's already queued, cancel the old (most recent wins)
    if (timerRef.current) window.clearTimeout(timerRef.current);
    resolveRef.current?.(false);

    return new Promise<boolean>((resolve) => {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      const pending: PendingAction = {
        ...input,
        id,
        startedAt: Date.now(),
        delayMs: Math.max(1000, input.delayMs),
      };
      resolveRef.current = resolve;
      setAction(pending);

      timerRef.current = window.setTimeout(async () => {
        timerRef.current = null;
        try {
          await pending.run();
          resolve(true);
        } catch (e) {
          console.error('Pending action failed:', e);
          resolve(false);
        } finally {
          resolveRef.current = null;
          setAction(null);
        }
      }, pending.delayMs);
    });
  }, []);

  // Esc cancels
  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, cancel]);

  return <C.Provider value={{ action, queue, cancel }}>{children}</C.Provider>;
}

export function usePendingAction(): Ctx {
  const ctx = useContext(C);
  if (!ctx) throw new Error('usePendingAction must be used inside <PendingActionProvider>');
  return ctx;
}
