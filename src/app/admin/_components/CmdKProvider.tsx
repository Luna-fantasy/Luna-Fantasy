'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface CmdKCtx {
  open: boolean;
  openCmdK: () => void;
  closeCmdK: () => void;
}

const Ctx = createContext<CmdKCtx | null>(null);

export function CmdKProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openCmdK = useCallback(() => setOpen(true), []);
  const closeCmdK = useCallback(() => setOpen(false), []);

  // Global shortcut: Cmd+K / Ctrl+K anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <Ctx.Provider value={{ open, openCmdK, closeCmdK }}>{children}</Ctx.Provider>;
}

export function useCmdK(): CmdKCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCmdK must be used inside <CmdKProvider>');
  return ctx;
}
