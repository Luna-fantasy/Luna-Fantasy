'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type TzMode = 'local' | 'utc' | 'server';

interface TzCtx {
  tz: TzMode;
  cycle: () => void;
  label: string;
  fmt: (input: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
  fmtRel: (input: string | Date) => string;
  absolute: (input: string | Date) => string;
}

const Ctx = createContext<TzCtx | null>(null);
const STORAGE_KEY = 'av-timezone';
const SERVER_TZ = 'Europe/Oslo'; // VPS is in Norway

const LABELS: Record<TzMode, string> = {
  local: 'Local',
  utc: 'UTC',
  server: 'Norway',
};

function fmtWith(tz: TzMode, input: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return '—';
  const timeZone = tz === 'utc' ? 'UTC' : tz === 'server' ? SERVER_TZ : undefined;
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone,
    ...opts,
  });
}

function relativeFrom(input: string | Date, now: number): string {
  const d = input instanceof Date ? input : new Date(input);
  const t = d.getTime();
  if (!Number.isFinite(t)) return '—';
  const delta = Math.max(0, now - t);
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [tz, setTz] = useState<TzMode>('local');
  const [, setTick] = useState(0);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === 'local' || raw === 'utc' || raw === 'server') setTz(raw);
    } catch { /* ignore */ }
  }, []);

  // Tick every 30s so fmtRel refreshes
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const cycle = useCallback(() => {
    setTz((prev) => {
      const next: TzMode = prev === 'local' ? 'utc' : prev === 'utc' ? 'server' : 'local';
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value: TzCtx = {
    tz,
    cycle,
    label: LABELS[tz],
    fmt: (input, opts) => fmtWith(tz, input, opts),
    fmtRel: (input) => relativeFrom(input, Date.now()),
    absolute: (input) => fmtWith(tz, input),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTimezone(): TzCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTimezone must be used inside <TimezoneProvider>');
  return ctx;
}
