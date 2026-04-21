'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../_components/Icon';
import ContextMenu from '../_components/ContextMenu';
import { usePeek } from '../_components/PeekProvider';
import { onButtonKey } from '../_components/a11y';

interface PassportRow {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  number: string | null;
  fullName: string | null;
  faction: string | null;
  staffRole: string | null;
  issuedAt: number | null;
}

const FACTION_GLYPH: Record<string, string> = {
  lunarians: '☾', sentinel: '⚔', mastermind: '◈',
  underworld: '✦', siren: '◐', seer: '✧',
  wizard: '◇', thief: '▼', knight: '▲', guardian: '■',
};

function fmtDate(ms: number): string {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export default function PassportsClient() {
  const { openPeek } = usePeek();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rows, setRows] = useState<PassportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(36);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [faction, setFaction] = useState('');
  const [staffOnly, setStaffOnly] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchList = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (faction) params.set('faction', faction);
    if (staffOnly) params.set('staffOnly', '1');
    params.set('page', String(page));
    params.set('limit', String(limit));

    try {
      const res = await fetch(`/api/admin/v2/passports?${params.toString()}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('Passports fetch:', err);
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, [q, faction, staffOnly, page, limit]);

  useEffect(() => {
    const t = window.setTimeout(fetchList, 220);
    return () => window.clearTimeout(t);
  }, [fetchList]);

  // Reset page whenever a filter changes (not page itself).
  // Using a stable tag prevents React 18's setState-in-render warning with StrictMode.
  const filterTag = `${q}|${faction}|${staffOnly}`;
  const prevFilterRef = useRef(filterTag);
  useEffect(() => {
    if (prevFilterRef.current !== filterTag) {
      prevFilterRef.current = filterTag;
      setPage(1);
    }
  }, [filterTag]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="av-users">
      <section className="av-surface av-users-filters">
        <div className="av-users-filter-row">
          <div className="av-audit-search" style={{ flex: '1 1 260px' }}>
            <Icon name="search" size={14} />
            <input
              className="av-audit-input"
              placeholder="Search passport number or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button type="button" className="av-audit-clear" onClick={() => setQ('')}>×</button>}
          </div>

          <select className="av-audit-input av-audit-input--sm"
            value={faction} onChange={(e) => setFaction(e.target.value)}
            style={{ width: 180 }}>
            <option value="">All factions</option>
            <option value="lunarians">Lunarians</option>
            <option value="sentinel">Sentinel</option>
            <option value="mastermind">Mastermind</option>
            <option value="underworld">Underworld</option>
            <option value="siren">Siren</option>
            <option value="seer">Seer</option>
            <option value="guardian">Guardian</option>
          </select>

          <label className="av-users-toggle">
            <input type="checkbox" checked={staffOnly} onChange={(e) => setStaffOnly(e.target.checked)} />
            <span>Staff only</span>
          </label>
        </div>
      </section>

      <div className="av-audit-meta">
        <span>{loading ? 'Loading…' : `${total.toLocaleString()} ${total === 1 ? 'passport' : 'passports'}`}</span>
      </div>

      <div className="av-passports-grid">
        {rows.length === 0 && !loading && (
          <div className="av-flows-empty" style={{ gridColumn: '1 / -1' }}>
            No passports match these filters.
          </div>
        )}
        {rows.map((p) => (
          <ContextMenu
            key={p.discordId + ':' + p.number}
            items={[
              { label: 'Peek holder', icon: '◇', run: () => openPeek(p.discordId) },
              { label: 'Open profile', icon: '›', run: () => { window.location.href = `/admin/users/${p.discordId}`; } },
              'separator' as const,
              { label: 'Copy passport number', icon: '⧉', run: () => p.number && navigator.clipboard?.writeText(p.number) },
              { label: 'Copy Discord ID', icon: '⧉', run: () => navigator.clipboard?.writeText(p.discordId) },
            ]}
          >
          <div
            className={`av-passport${p.staffRole ? ' av-passport--staff av-passport--' + p.staffRole.toLowerCase() : ''}`}
            onClick={() => openPeek(p.discordId)}
            onKeyDown={onButtonKey(() => openPeek(p.discordId))}
            role="button"
            tabIndex={0}
          >
            <div className="av-passport-header">
              <span className="av-passport-glyph">
                {FACTION_GLYPH[(p.faction ?? '').toLowerCase()] ?? '◯'}
              </span>
              <span className="av-passport-number">{p.number ?? 'PENDING'}</span>
            </div>
            <div className="av-passport-body">
              <div className="av-passport-avatar">
                {p.image
                  ? <img src={p.image} alt="" />
                  : <span>{(p.globalName ?? p.username ?? '?').slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="av-passport-ident">
                <div className="av-passport-name">{p.fullName ?? p.globalName ?? p.username ?? '—'}</div>
                {p.faction && <div className="av-passport-faction">{p.faction}</div>}
                {p.staffRole && <div className="av-passport-role">{p.staffRole}</div>}
              </div>
            </div>
            {p.issuedAt && (
              <div className="av-passport-footer">
                Issued {mounted ? fmtDate(p.issuedAt) : '…'}
              </div>
            )}
          </div>
          </ContextMenu>
        ))}
      </div>

      <nav className="av-audit-pager" aria-label="Pagination">
        <button type="button" className="av-btn av-btn-ghost" disabled={page <= 1 || loading}
          onClick={() => setPage(1)}>« First</button>
        <button type="button" className="av-btn av-btn-ghost" disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
        <span className="av-audit-pager-meta">Page <strong>{page}</strong> of {totalPages.toLocaleString()}</span>
        <button type="button" className="av-btn av-btn-ghost" disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
        <button type="button" className="av-btn av-btn-ghost" disabled={page >= totalPages || loading}
          onClick={() => setPage(totalPages)}>Last »</button>
      </nav>
    </div>
  );
}
