'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface PeekCtx {
  userId: string | null;
  openPeek: (userId: string) => void;
  closePeek: () => void;
}

const Ctx = createContext<PeekCtx | null>(null);

export function PeekProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const openPeek = useCallback((id: string) => setUserId(id), []);
  const closePeek = useCallback(() => setUserId(null), []);
  return <Ctx.Provider value={{ userId, openPeek, closePeek }}>{children}</Ctx.Provider>;
}

export function usePeek(): PeekCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePeek must be used inside <PeekProvider>');
  return ctx;
}
