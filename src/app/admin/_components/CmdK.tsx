'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useCmdK } from './CmdKProvider';
import { usePeek } from './PeekProvider';
import { CLUSTERS } from './nav-config';

interface SearchHit {
  kind: 'user' | 'passport' | 'action' | 'audit' | 'nav';
  id: string;
  label: string;
  sub?: string;
  href?: string;
  icon?: string;
}

// Static nav targets — always searchable without a round-trip
const NAV_HITS: SearchHit[] = CLUSTERS.flatMap((cluster) =>
  cluster.items.map((item) => ({
    kind: 'nav' as const,
    id: `nav:${item.href}`,
    label: item.label,
    sub: cluster.label,
    href: item.href,
    icon: '›',
  }))
);

function fuzzy(q: string, s: string): boolean {
  const ql = q.toLowerCase();
  const sl = s.toLowerCase();
  if (sl.includes(ql)) return true;
  let i = 0;
  for (const c of sl) { if (c === ql[i]) i++; if (i === ql.length) return true; }
  return false;
}

export default function CmdK() {
  const { open, closeCmdK } = useCmdK();
  const { openPeek } = usePeek();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteHits, setRemoteHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setMounted(true), []);

  // Focus input on open, reset state
  useEffect(() => {
    if (open) {
      setQuery('');
      setRemoteHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced remote search
  useEffect(() => {
    if (!open) return;
    if (query.length < 1) { setRemoteHits([]); return; }
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setRemoteHits(data.hits ?? []);
        }
      } catch { /* ignore */ }
      finally { if (abortRef.current === ctrl) setLoading(false); }
    }, 180);
    return () => window.clearTimeout(t);
  }, [query, open]);

  // Merge nav hits (local fuzzy) + remote hits
  const hits: SearchHit[] = useMemo(() => {
    const q = query.trim();
    if (q.length === 0) return NAV_HITS.slice(0, 10);
    const localNav = NAV_HITS.filter((h) => fuzzy(q, h.label) || (h.sub && fuzzy(q, h.sub)));
    return [...remoteHits, ...localNav].slice(0, 30);
  }, [query, remoteHits]);

  const selectHit = useCallback((hit: SearchHit) => {
    closeCmdK();
    if (hit.kind === 'user') openPeek(hit.id);
    else if (hit.href) router.push(hit.href);
  }, [closeCmdK, openPeek, router]);

  // Keep active index in range
  useEffect(() => {
    if (active >= hits.length) setActive(Math.max(0, hits.length - 1));
  }, [hits, active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); closeCmdK(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[active]) selectHit(hits[active]); }
  };

  if (!mounted || !open) return null;

  const groups: Record<string, SearchHit[]> = {};
  for (const h of hits) {
    const g = h.kind === 'nav' ? 'Navigate'
      : h.kind === 'user' ? 'Players'
      : h.kind === 'passport' ? 'Passports'
      : h.kind === 'audit' ? 'Audit'
      : 'Other';
    (groups[g] ??= []).push(h);
  }
  const groupOrder = ['Players', 'Passports', 'Audit', 'Navigate', 'Other'].filter((k) => groups[k]);

  let flatIdx = 0;
  const portal = (
    <>
      <div className="av-cmdk-scrim" onClick={closeCmdK} aria-hidden="true" />
      <div className="av-cmdk" role="dialog" aria-modal="true" aria-label="Command menu">
        <div className="av-cmdk-input-wrap">
          <span className="av-cmdk-icon">⌘K</span>
          <input
            ref={inputRef}
            className="av-cmdk-input"
            placeholder="Search players, passports, audit, go anywhere…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            aria-label="Search command"
          />
          {loading && <span className="av-cmdk-loading" aria-hidden="true" />}
        </div>
        <div className="av-cmdk-results">
          {hits.length === 0 && query.length > 0 && (
            <div className="av-cmdk-empty">No matches for “{query}”</div>
          )}
          {hits.length === 0 && query.length === 0 && (
            <div className="av-cmdk-empty">Start typing to search the Luna ecosystem.</div>
          )}
          {groupOrder.map((g) => (
            <div key={g} className="av-cmdk-group">
              <div className="av-cmdk-group-label">{g}</div>
              {groups[g].map((h) => {
                const idx = flatIdx++;
                const isActive = idx === active;
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`av-cmdk-hit${isActive ? ' av-cmdk-hit--active' : ''}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => selectHit(h)}
                  >
                    <span className="av-cmdk-hit-icon">{h.icon ?? '◯'}</span>
                    <span className="av-cmdk-hit-body">
                      <span className="av-cmdk-hit-label">{h.label}</span>
                      {h.sub && <span className="av-cmdk-hit-sub">{h.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <footer className="av-cmdk-foot">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </footer>
      </div>
    </>
  );

  return createPortal(portal, document.body);
}
