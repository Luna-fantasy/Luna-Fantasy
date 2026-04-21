'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useToast } from './Toast';

interface Shortcut {
  keys: string;
  label: string;
  group: string;
  run: (router: ReturnType<typeof useRouter>, helpers: { focusFilter: () => void; openTheme: () => void }) => void;
}

const SHORTCUTS: Shortcut[] = [
  { keys: 'Ctrl K', label: 'Command palette (search everything)', group: 'Search', run: () => { /* handled globally */ } },
  { keys: '/',   label: 'Focus sidebar filter', group: 'Search', run: (_r, h) => h.focusFilter() },
  { keys: 'g d', label: 'Go to Dashboard', group: 'Navigation', run: (r) => r.push('/admin') },
  { keys: 'g o', label: 'Go to Operations', group: 'Navigation', run: (r) => r.push('/admin/ops') },
  { keys: 'g a', label: 'Go to Audit Log',  group: 'Navigation', run: (r) => r.push('/admin/audit') },
  { keys: 'g u', label: 'Go to Users',      group: 'Navigation', run: (r) => r.push('/admin/users') },
  { keys: 't',   label: 'Open theme picker', group: 'Display', run: (_r, h) => h.openTheme() },
  { keys: '↑↓ j k', label: 'Navigate table rows', group: 'Tables', run: () => { /* handled in tables */ } },
  { keys: 'Enter', label: 'Open / activate row', group: 'Tables', run: () => { /* handled in tables */ } },
  { keys: 'Ctrl Z', label: 'Undo last admin action', group: 'Actions', run: () => { /* handled globally */ } },
  { keys: 'Right-click', label: 'Contextual menu on rows', group: 'Actions', run: () => { /* handled in rows */ } },
  { keys: '?',   label: 'Show this help', group: 'Help', run: () => { /* handled inline */ } },
  { keys: 'Esc', label: 'Close any overlay', group: 'Help', run: () => { /* handled inline */ } },
];

export default function Shortcuts() {
  const router = useRouter();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const legendOpen = helpOpen || showLegend;
  const closeLegend = () => { setHelpOpen(false); setShowLegend(false); };
  const [chord, setChord] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let chordTimer: number | null = null;
    let pending: string | null = null;

    const focusFilter = () => {
      const input = document.querySelector('.av-sidebar-filter input') as HTMLInputElement | null;
      input?.focus();
    };
    const openTheme = () => {
      const trigger = document.querySelector('.av-theme-trigger') as HTMLElement | null;
      trigger?.click();
    };

    const onKey = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs / textareas / contenteditable
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (e.key === 'Escape') target.blur();
        return;
      }

      if (e.key === 'Escape') {
        setHelpOpen(false);
        setShowLegend(false);
        // Also close theme panel if open
        const themePanel = document.querySelector('.av-theme-panel');
        if (themePanel) (document.querySelector('.av-theme-trigger') as HTMLElement | null)?.click();
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        focusFilter();
        return;
      }

      if (e.key === 't') {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        openTheme();
        return;
      }

      if (e.key === 'g') {
        pending = 'g';
        setChord('g');
        if (chordTimer) window.clearTimeout(chordTimer);
        chordTimer = window.setTimeout(() => {
          pending = null;
          setChord(null);
        }, 1000);
        return;
      }

      if (pending === 'g') {
        const target = `g ${e.key}`;
        const sc = SHORTCUTS.find((s) => s.keys === target);
        pending = null;
        setChord(null);
        if (chordTimer) window.clearTimeout(chordTimer);
        if (sc) {
          e.preventDefault();
          sc.run(router, { focusFilter, openTheme });
          toast.push(`→ ${sc.label}`, 'info', 1400);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (chordTimer) window.clearTimeout(chordTimer);
    };
  }, [router, toast]);

  if (!mounted) return null;

  return (
    <>
      {chord && createPortal(
        <div className="av-chord-indicator">
          <kbd>{chord}</kbd> <span className="av-chord-hint">+ d, o, a, u…</span>
        </div>,
        document.body
      )}

      {/* Floating "?" trigger button */}
      {createPortal(
        <button
          className="av-shortcuts-legend-trigger"
          onClick={() => setShowLegend((o) => !o)}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>,
        document.body
      )}

      {/* Shortcuts legend overlay */}
      {legendOpen && createPortal(
        <div className="av-shortcut-overlay av-shortcuts-legend-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={closeLegend}>
          <div className="av-shortcut-card av-shortcuts-legend" onClick={(e) => e.stopPropagation()}>
            <header className="av-shortcut-head">
              <h2>Keyboard Shortcuts</h2>
              <button onClick={closeLegend} aria-label="Close">✕</button>
            </header>
            <div className="av-shortcut-body">
              {Array.from(new Set(SHORTCUTS.map((s) => s.group))).map((group) => (
                <div key={group} className="av-shortcut-group">
                  <div className="av-shortcut-group-label">{group}</div>
                  {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                    <div key={s.keys} className="av-shortcuts-legend-row av-shortcut-row">
                      <kbd>{s.keys}</kbd>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
