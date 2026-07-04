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
    // An action still waiting on its timer gets resolved before the new one
    // is queued. Dangerous actions are CANCELLED — superseding is how an admin
    // aborts a mistaken destructive action, so its undo window must hold.
    // Everything else COMMITS immediately, so no config save is ever silently
    // dropped by a second save landing inside the undo window.
    // (An action whose run() is already in flight — timer fired — is left
    // alone; the identity check in the timer callback below keeps its cleanup
    // from clobbering whatever we queue here.)
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      const prev = actionRef.current;
      const prevResolve = resolveRef.current;
      actionRef.current = null;
      resolveRef.current = null;
      if (prev) {
        if (prev.tone === 'danger') {
          prev.onCancel?.();
          prevResolve?.(false);
        } else {
          try {
            await prev.run();
            prevResolve?.(true);
          } catch (e) {
            console.error('Pending action failed:', e);
            prevResolve?.(false);
          }
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
          // Only clear state that still belongs to THIS action — a newer
          // action may have been queued while run() was in flight, and
          // wiping its refs would orphan its timer (invisible execution)
          // or drop it entirely on the next queue().
          if (actionRef.current === pending) {
            resolveRef.current = null;
            actionRef.current = null;
            setAction(null);
          }
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
