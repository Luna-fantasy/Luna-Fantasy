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
  const actionRef = useRef<PendingAction | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (actionRef.current) {
      actionRef.current.onCancel?.();
      resolveRef.current?.(false);
      resolveRef.current = null;
    }
    actionRef.current = null;
    setAction(null);
  }, []);

  const queue = useCallback<Ctx['queue']>(async (input) => {
    // If an action is already queued, commit it NOW instead of dropping it.
    // The old most-recent-wins behavior silently cancelled the earlier save
    // whenever two saves landed inside one undo window — the admin saw both
    // succeed but only the second one ever ran.
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      const prev = actionRef.current;
      const prevResolve = resolveRef.current;
      actionRef.current = null;
      resolveRef.current = null;
      if (prev) {
        try {
          await prev.run();
          prevResolve?.(true);
        } catch (e) {
          console.error('Pending action failed:', e);
          prevResolve?.(false);
        }
      }
    }

    return new Promise<boolean>((resolve) => {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      const pending: PendingAction = {
        ...input,
        id,
        startedAt: Date.now(),
        delayMs: Math.max(1000, input.delayMs),
      };
      resolveRef.current = resolve;
      actionRef.current = pending;
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
          actionRef.current = null;
          setAction(null);
        }
      }, pending.delayMs);
    });
  }, []);

  // Esc used to cancel any pending save · that silently dropped uploads/edits
  // when the user pressed Esc to close a dialog. Cancellation is now opt-in
  // through the visible Cancel button on the pending UI; Esc is harmless.

  return <C.Provider value={{ action, queue, cancel }}>{children}</C.Provider>;
}

export function usePendingAction(): Ctx {
  const ctx = useContext(C);
  if (!ctx) throw new Error('usePendingAction must be used inside <PendingActionProvider>');
  return ctx;
}
