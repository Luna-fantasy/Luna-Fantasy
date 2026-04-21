'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ToastTone = 'info' | 'success' | 'warn' | 'err' | 'error';

interface ToastItem {
  id: number;
  title?: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
}

interface ShowOpts {
  title?: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastApi {
  /** Object form (preferred): show({ title, message, tone, duration }) */
  show: (opts: ShowOpts) => void;
  /** Legacy positional form: push(message, tone, duration) */
  push: (message: string, tone?: ToastTone, duration?: number) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const NOOP: ToastApi = { show: () => { /* noop */ }, push: () => { /* noop */ } };

export function useToast(): ToastApi {
  return useContext(ToastCtx) ?? NOOP;
}

const TONE_GLYPH: Record<string, string> = {
  success: '✓',
  warn:    '!',
  err:     '⚠',
  error:   '⚠',
  info:    'ℹ',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const seqRef = useRef(0);
  const timeoutsRef = useRef<Map<number, number>>(new Map());

  useEffect(() => { setMounted(true); }, []);

  // Cancel all pending timeouts on unmount to prevent leaked setState calls
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const t = timeoutsRef.current.get(id);
    if (t) { window.clearTimeout(t); timeoutsRef.current.delete(id); }
    setItems((s) => s.filter((t) => t.id !== id));
  }, []);

  const enqueue = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = ++seqRef.current;
    const isError = item.tone === 'err' || item.tone === 'error';
    const duration = item.duration ?? (isError ? 8000 : 3200);
    setItems((s) => {
      // When we drop older toasts beyond 30, also cancel their pending timeouts
      const next = [...s, { ...item, id }];
      if (next.length > 30) {
        for (const dropped of next.slice(0, next.length - 30)) {
          const oldT = timeoutsRef.current.get(dropped.id);
          if (oldT) { window.clearTimeout(oldT); timeoutsRef.current.delete(dropped.id); }
        }
      }
      return next.slice(-30);
    });
    const tid = window.setTimeout(() => {
      timeoutsRef.current.delete(id);
      setItems((s) => s.filter((t) => t.id !== id));
    }, duration);
    timeoutsRef.current.set(id, tid);
  }, []);

  const show = useCallback<ToastApi['show']>((opts) => {
    enqueue({ title: opts.title, message: opts.message, tone: opts.tone ?? 'info', duration: opts.duration });
  }, [enqueue]);

  const push = useCallback<ToastApi['push']>((message, tone = 'info', duration = 2800) => {
    enqueue({ message, tone, duration });
  }, [enqueue]);

  // Normalize 'error' → 'err' for CSS data-tone match
  const normTone = (t?: ToastTone): string => t === 'error' ? 'err' : (t ?? 'info');

  return (
    <ToastCtx.Provider value={{ show, push }}>
      {children}
      {mounted && createPortal(
        <div className="av-toast-stack" aria-live="polite" aria-atomic="true">
          {items.map((t) => (
            <div key={t.id} className="av-toast" data-tone={normTone(t.tone)}>
              <span className="av-toast-glyph" aria-hidden="true">{TONE_GLYPH[normTone(t.tone)] ?? 'ℹ'}</span>
              <div className="av-toast-body">
                {t.title && <strong className="av-toast-title">{t.title}</strong>}
                <span className="av-toast-message">{t.message}</span>
              </div>
              <button type="button" className="av-toast-dismiss" onClick={() => dismiss(t.id)} aria-label="Dismiss">&times;</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}
