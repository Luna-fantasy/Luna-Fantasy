'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUndo } from './UndoProvider';

function fmtRel(ts: number): string {
  const delta = Date.now() - ts;
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export default function UndoDrawer() {
  const { items, open, setOpen, revert, clear } = useUndo();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Ticker — rerender relative times
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 5_000);
    return () => window.clearInterval(t);
  }, [open]);

  if (!mounted) return null;

  const pending = items.filter((i) => i.status === 'pending').length;

  const trigger = (
    <button
      type="button"
      className={`av-undo-trigger${pending > 0 ? ' av-undo-trigger--has' : ''}`}
      onClick={() => setOpen(true)}
      title={`Admin history (${pending} reversible)`}
      aria-label="Open admin history"
    >
      <span aria-hidden="true">⟲</span>
      {pending > 0 && <span className="av-undo-trigger-count">{pending}</span>}
    </button>
  );

  if (!open) return createPortal(trigger, document.body);

  const drawer = (
    <>
      {trigger}
      <div className="av-undo-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className="av-undo" role="dialog" aria-modal="true" aria-label="Admin history">
        <header className="av-undo-head">
          <h3>Admin History</h3>
          <div>
            {items.length > 0 && (
              <button type="button" className="av-undo-clear" onClick={clear}>Clear</button>
            )}
            <button type="button" className="av-peek-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="av-undo-empty">
            <p>No reversible actions yet.</p>
            <small>Every change you make appears here — a safeguard against unintended edits.</small>
          </div>
        ) : (
          <ul className="av-undo-list">
            {items.map((it) => (
              <li key={it.id} className={`av-undo-item av-undo-item--${it.status}`}>
                <div className="av-undo-body">
                  <div className="av-undo-label">{it.label}</div>
                  {it.detail && <div className="av-undo-detail">{it.detail}</div>}
                  {it.errorMessage && <div className="av-undo-err">⚠ {it.errorMessage}</div>}
                  <div className="av-undo-time">{fmtRel(it.createdAt)}</div>
                </div>
                {it.status === 'pending' && (
                  <button type="button" className="av-btn av-btn-ghost" onClick={() => void revert(it.id)}>
                    Undo
                  </button>
                )}
                {it.status === 'reverted' && <span className="av-undo-tag av-undo-tag--done">Reverted</span>}
                {it.status === 'failed' && (
                  <button type="button" className="av-btn av-btn-ghost" onClick={() => void revert(it.id)}>
                    Retry
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <footer className="av-undo-foot">
          <span>Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo most recent</span>
        </footer>
      </aside>
    </>
  );

  return createPortal(drawer, document.body);
}
