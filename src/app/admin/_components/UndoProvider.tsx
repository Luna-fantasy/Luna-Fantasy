'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface UndoItem {
  id: string;
  label: string;
  detail?: string;
  /** Function the drawer calls to revert the action. */
  revert: () => Promise<void>;
  createdAt: number;
  status: 'pending' | 'reverted' | 'failed';
  errorMessage?: string;
}

interface UndoCtx {
  items: UndoItem[];
  open: boolean;
  setOpen: (o: boolean) => void;
  push: (item: Omit<UndoItem, 'id' | 'createdAt' | 'status'>) => string;
  revert: (id: string) => Promise<void>;
  clear: () => void;
}

const Ctx = createContext<UndoCtx | null>(null);
const MAX = 20;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UndoItem[]>([]);
  const [open, setOpen] = useState(false);

  const push = useCallback((input: Omit<UndoItem, 'id' | 'createdAt' | 'status'>) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setItems((prev) => [
      { ...input, id, createdAt: Date.now(), status: 'pending' as const },
      ...prev,
    ].slice(0, MAX));
    return id;
  }, []);

  const revert = useCallback(async (id: string) => {
    // Capture the revert function atomically using a functional setState
    // to avoid stale closure bugs on rapid Ctrl+Z mashing
    const captured: { fn: (() => Promise<void>) | null } = { fn: null };
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target || target.status === 'reverted') return prev;
      captured.fn = target.revert;
      return prev;
    });
    const fn = captured.fn;
    if (!fn) return;
    try {
      await fn();
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'reverted' } : i));
    } catch (e) {
      setItems((prev) => prev.map((i) => i.id === id
        ? { ...i, status: 'failed', errorMessage: (e as Error).message }
        : i));
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);

  // Ctrl+Z / Cmd+Z reverts the most recent pending item
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const mostRecent = items.find((i) => i.status === 'pending');
      if (!mostRecent) return;
      e.preventDefault();
      void revert(mostRecent.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, revert]);

  return (
    <Ctx.Provider value={{ items, open, setOpen, push, revert, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUndo(): UndoCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUndo must be used inside <UndoProvider>');
  return ctx;
}
