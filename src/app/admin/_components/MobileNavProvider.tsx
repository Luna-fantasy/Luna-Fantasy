'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface MobileNavCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  isMobile: boolean;
}

const Ctx = createContext<MobileNavCtx | null>(null);

export function useMobileNav(): MobileNavCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMobileNav must be used inside MobileNavProvider');
  return v;
}

const MOBILE_BREAKPOINT = 900;

export default function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen((v) => !v), isMobile }}>
      {children}
    </Ctx.Provider>
  );
}
