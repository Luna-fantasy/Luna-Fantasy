'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../_components/Icon';
import JsonDiff from '../_components/JsonDiff';
import { useSavedViews } from '../_components/useSavedViews';
import UserLink from '../_components/UserLink';
import ContextMenu from '../_components/ContextMenu';
import { useTableKeys } from '../_components/useTableKeys';
import { onButtonKey } from '../_components/a11y';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';

interface AuditEntryView {
  _id: string;
  adminDiscordId: string;
  adminUsername: string;
  action: string;
  targetDiscordId?: string;
  before: unknown;
  after: unknown;
  metadata: { reason?: string; amount?: number; [key: string]: unknown };
  timestamp: string; // ISO
  ip: string;
}

interface Props {
  actions: string[];
  initial: { entries: AuditEntryView[]; total: number };
}

interface Filters {
  q: string;
  actions: string[];
  adminDiscordId: string;
  targetDiscordId: string;
  dateFrom: string; // YYYY-MM-DDTHH:mm (datetime-local)
  dateTo: string;
  amountMin: string;
  amountMax: string;
  limit: number;
}

const EMPTY: Filters = {
  q: '', actions: [], adminDiscordId: '', targetDiscordId: '',
  dateFrom: '', dateTo: '', amountMin: '', amountMax: '', limit: 50,
};

// Explicit per-action tone. Falls back to regex classification for anything new.
// Verified against top 20 distinct actions in admin_audit_log (2026-04-14).
const ACTION_TONES: Record<string, string> = {
  // Destructive — red
  balance_modify: 'destructive',
  card_remove: 'destructive',
  stone_remove: 'destructive',
  r2_delete: 'destructive',
  pm2_stop: 'destructive',
  passport_admin_revoke: 'destructive',
  debt_clear: 'destructive',
  transaction_reverse: 'destructive',
  challenge_close: 'destructive',

  // Content (uploads, canvas edits, images) — purple
  canvas_layout_update: 'content',
  r2_upload: 'content',
  r2_presign: 'content',
  bot_image_upload: 'content',
  bot_profile_update: 'content',
  cards_update_image: 'content',
  inline_edit_translations: 'content',
  inline_edit_shops: 'content',
  inline_edit_cards: 'content',
  translation_override: 'content',

  // Ops (deploys / restarts / announcements) — gold
  deploy_trigger: 'ops',
  pm2_restart: 'ops',
  pm2_start: 'ops',
  oracle_announce: 'ops',
  voice_room_create: 'ops',
  voice_room_delete: 'ops',

  // Config updates — blue
  config_butler_update: 'config',
  config_jester_update: 'config',
  config_sage_update: 'config',
  config_oracle_update: 'config',
  config_oracle_upload: 'config',
  shop_config_update: 'config',
  cards_config_update: 'config',
  stones_config_update: 'config',
  vendor_config_update: 'config',
  footer_config_update: 'config',

  // Positive / grants — green
  card_give: 'grant',
  stone_give: 'grant',
  inventory_give: 'grant',
  cooldowns_reset: 'grant',
  tickets_modify: 'grant',
  level_modify: 'grant',
  loan_payout: 'grant',
  reserve_withdrawal: 'grant',
  passport_admin_edit: 'grant',

  // Challenges / marketplace — cyan
  challenge_create: 'marketplace',
  challenge_complete: 'marketplace',
  seluna_restock: 'marketplace',
  seluna_price_update: 'marketplace',
  faction_card_add: 'marketplace',
  faction_card_remove: 'marketplace',
};

function actionTone(action: string): string {
  const exact = ACTION_TONES[action];
  if (exact) return exact;
  if (/remove|revoke|clear|delete|reverse|stop|drop|close/i.test(action)) return 'destructive';
  if (/upload|image|canvas|asset|translat|r2/i.test(action)) return 'content';
  if (/deploy|pm2|announce|restart|voice_room/i.test(action)) return 'ops';
  if (/config|_update/i.test(action)) return 'config';
  if (/give|credit|grant|modify|reset/i.test(action)) return 'grant';
  if (/challenge|seluna|faction|shop|vendor/i.test(action)) return 'marketplace';
  return 'neutral';
}

export default function AuditClient({ actions, initial }: Props) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditEntryView[]>(initial.entries);
  const [total, setTotal] = useState<number>(initial.total);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [actionFilterOpen, setActionFilterOpen] = useState(false);
  const [actionSearch, setActionSearch] = useState('');
  const [viewsOpen, setViewsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { openPeek } = usePeek();
  const { fmt: fmtTs } = useTimezone();

  const savedViews = useSavedViews<Filters>('audit');

  const fetchPage = useCallback(async (f: Filters, p: number) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', String(f.limit));
    if (f.q.trim()) params.set('q', f.q.trim());
    if (f.actions.length) params.set('actions', f.actions.join(','));
    if (f.adminDiscordId.trim()) params.set('adminDiscordId', f.adminDiscordId.trim());
    if (f.targetDiscordId.trim()) params.set('targetDiscordId', f.targetDiscordId.trim());
    if (f.dateFrom) params.set('dateFrom', new Date(f.dateFrom).toISOString());
    if (f.dateTo) params.set('dateTo', new Date(f.dateTo).toISOString());
    if (f.amountMin !== '') params.set('amountMin', f.amountMin);
    if (f.amountMax !== '') params.set('amountMax', f.amountMax);

    try {
      const res = await fetch(`/api/admin/audit?${params.toString()}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Audit fetch failed:', err);
      }
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  // Debounced refetch on filter change (skip first mount — initial data is already served)
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = window.setTimeout(() => fetchPage(filters, page), 250);
    return () => window.clearTimeout(t);
  }, [filters, page, fetchPage]);

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const toggleAction = (name: string) => {
    setFilters((f) => ({
      ...f,
      actions: f.actions.includes(name) ? f.actions.filter((a) => a !== name) : [...f.actions, name],
    }));
    setPage(1);
  };

  const clearAll = () => {
    setFilters(EMPTY);
    setPage(1);
  };

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { active, setActive } = useTableKeys(entries.length, {
    onActivate: (i) => { const e = entries[i]; if (e) toggleRow(e._id); },
  });

  const filteredActions = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    return q ? actions.filter((a) => a.toLowerCase().includes(q)) : actions;
  }, [actions, actionSearch]);

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  const exportCsv = () => {
    const header = ['timestamp', 'admin', 'adminId', 'action', 'targetId', 'amount', 'reason'];
    const rows = entries.map((e) => [
      new Date(e.timestamp).toISOString(),
      e.adminUsername ?? '',
      e.adminDiscordId ?? '',
      e.action,
      e.targetDiscordId ?? '',
      String(e.metadata?.amount ?? ''),
      (e.metadata?.reason ?? '').replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="av-audit">
      {/* FILTER BAR */}
      <section className="av-surface av-audit-filters">
        <div className="av-audit-row">
          <div className="av-audit-search">
            <Icon name="search" size={14} />
            <input
              className="av-audit-input"
              placeholder="Search actions, admins, target IDs, reasons…"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              aria-label="Search audit log"
            />
            {filters.q && (
              <button type="button" className="av-audit-clear" onClick={() => update({ q: '' })} aria-label="Clear search">×</button>
            )}
          </div>

          <div className="av-audit-action-select" onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setActionFilterOpen(false);
          }}>
            <button
              type="button"
              className="av-audit-trigger"
              onClick={() => setActionFilterOpen((o) => !o)}
              aria-expanded={actionFilterOpen}
            >
              <Icon name="terminal" size={12} />
              <span>Actions{filters.actions.length > 0 ? ` (${filters.actions.length})` : ''}</span>
              <Icon name="chevron" size={10} />
            </button>
            {actionFilterOpen && (
              <div className="av-audit-dropdown">
                <input
                  className="av-audit-input av-audit-input--sm"
                  placeholder="Filter actions…"
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  autoFocus
                />
                <div className="av-audit-action-list">
                  {filteredActions.length === 0 && <div className="av-audit-empty-mini">No matches</div>}
                  {filteredActions.map((a) => (
                    <label key={a} className="av-audit-action-item">
                      <input
                        type="checkbox"
                        checked={filters.actions.includes(a)}
                        onChange={() => toggleAction(a)}
                      />
                      <span className={`av-audit-badge av-audit-badge-${actionTone(a)}`}>{a}</span>
                    </label>
                  ))}
                </div>
                {filters.actions.length > 0 && (
                  <button type="button" className="av-audit-clear-mini" onClick={() => update({ actions: [] })}>
                    Clear actions
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="av-audit-views" onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setViewsOpen(false);
          }}>
            <button
              type="button"
              className="av-audit-trigger"
              onClick={() => setViewsOpen((o) => !o)}
              aria-expanded={viewsOpen}
              title="Saved views"
            >
              <Icon name="shield" size={12} />
              <span>Views{savedViews.views.length > 0 ? ` (${savedViews.views.length})` : ''}</span>
              <Icon name="chevron" size={10} />
            </button>
            {viewsOpen && (
              <div className="av-audit-dropdown av-audit-dropdown--views">
                {savedViews.views.length === 0 && (
                  <div className="av-audit-empty-mini">No saved views yet</div>
                )}
                {savedViews.views
                  .slice()
                  .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
                  .map((v) => (
                    <div key={v.id} className="av-audit-view-row">
                      <button
                        type="button"
                        className="av-audit-view-apply"
                        onClick={() => { setFilters(v.state); setPage(1); setViewsOpen(false); }}
                      >
                        <span className="av-audit-view-name">
                          {v.pinned && <span aria-hidden="true">📌</span>} {v.name}
                        </span>
                      </button>
                      <button type="button" className="av-audit-view-icon"
                        onClick={() => savedViews.togglePinned(v.id)}
                        title={v.pinned ? 'Unpin' : 'Pin'}>
                        {v.pinned ? '◉' : '○'}
                      </button>
                      <button type="button" className="av-audit-view-icon av-audit-view-icon--danger"
                        onClick={() => savedViews.remove(v.id)} title="Delete">×</button>
                    </div>
                  ))}
                {hasFilters && (
                  <button type="button" className="av-audit-clear-mini"
                    onClick={() => {
                      const name = window.prompt('Name this view:', '');
                      if (name && name.trim()) savedViews.add(name.trim(), filters);
                    }}
                  >
                    + Save current filters
                  </button>
                )}
              </div>
            )}
          </div>

          <button type="button" className="av-btn av-btn-ghost" onClick={exportCsv} title="Export current page as CSV">
            <Icon name="external" size={12} /> CSV
          </button>
          {hasFilters && (
            <button type="button" className="av-btn av-btn-ghost" onClick={clearAll}>Reset</button>
          )}
        </div>

        <div className="av-audit-row av-audit-row--grid">
          <label className="av-audit-field">
            <span>Admin ID</span>
            <input className="av-audit-input" placeholder="Discord ID"
              value={filters.adminDiscordId} onChange={(e) => update({ adminDiscordId: e.target.value })} />
          </label>
          <label className="av-audit-field">
            <span>Target ID</span>
            <input className="av-audit-input" placeholder="Discord ID"
              value={filters.targetDiscordId} onChange={(e) => update({ targetDiscordId: e.target.value })} />
          </label>
          <label className="av-audit-field">
            <span>From</span>
            <input className="av-audit-input" type="datetime-local"
              value={filters.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
          </label>
          <label className="av-audit-field">
            <span>To</span>
            <input className="av-audit-input" type="datetime-local"
              value={filters.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
          </label>
          <label className="av-audit-field">
            <span>Amount ≥</span>
            <input className="av-audit-input" type="number" placeholder="0"
              value={filters.amountMin} onChange={(e) => update({ amountMin: e.target.value })} />
          </label>
          <label className="av-audit-field">
            <span>Amount ≤</span>
            <input className="av-audit-input" type="number" placeholder="∞"
              value={filters.amountMax} onChange={(e) => update({ amountMax: e.target.value })} />
          </label>
        </div>

        {filters.actions.length > 0 && (
          <div className="av-audit-chips">
            {filters.actions.map((a) => (
              <button key={a} type="button" className={`av-audit-chip av-audit-badge-${actionTone(a)}`}
                onClick={() => toggleAction(a)} title="Remove filter">
                {a} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* RESULTS META */}
      <div className="av-audit-meta">
        <span>
          {loading ? 'Loading…' : `${total.toLocaleString()} ${total === 1 ? 'event' : 'events'}`}
          {hasFilters && !loading && ' matching filters'}
        </span>
        <label className="av-audit-meta-size">
          Per page
          <select className="av-audit-input av-audit-input--sm"
            value={filters.limit}
            onChange={(e) => update({ limit: Number(e.target.value) })}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>
      </div>

      {/* TABLE */}
      <section className="av-surface av-audit-table-wrap">
        <table className="av-audit-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} aria-hidden="true" />
              <th style={{ width: 180 }}>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th style={{ textAlign: 'right', width: 120 }}>Amount</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !loading && (
              <tr><td colSpan={7} className="av-audit-empty">No events match these filters.</td></tr>
            )}
            {entries.map((e, idx) => {
              const isOpen = expanded.has(e._id);
              const isActive = idx === active;
              const ctxItems = [
                {
                  label: 'Open admin peek',
                  icon: '◇',
                  run: () => openPeek(e.adminDiscordId),
                },
                ...(e.targetDiscordId ? [{
                  label: 'Open target peek',
                  icon: '◇',
                  run: () => openPeek(e.targetDiscordId!),
                }] : []),
                'separator' as const,
                {
                  label: 'Filter: this action',
                  icon: '⌕',
                  run: () => update({ actions: [e.action] }),
                },
                {
                  label: 'Filter: this admin',
                  icon: '⌕',
                  run: () => update({ adminDiscordId: e.adminDiscordId }),
                },
                ...(e.targetDiscordId ? [{
                  label: 'Filter: this target',
                  icon: '⌕',
                  run: () => update({ targetDiscordId: e.targetDiscordId! }),
                }] : []),
                'separator' as const,
                {
                  label: 'Copy event ID',
                  icon: '⧉',
                  run: () => navigator.clipboard?.writeText(e._id),
                },
              ];
              return (
                <tr key={e._id} className={isOpen ? 'av-audit-row-open' : ''} data-row-index={idx} data-active={isActive}>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <ContextMenu items={ctxItems}>
                    <div
                      className={`av-audit-row-trigger${isActive ? ' av-audit-row-trigger--active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setActive(idx); toggleRow(e._id); }}
                      onKeyDown={onButtonKey(() => toggleRow(e._id))}
                      aria-expanded={isOpen}
                    >
                      <span className="av-audit-expand-icon" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                      <span className="av-audit-cell av-audit-cell-ts">{fmtTs(e.timestamp)}</span>
                      <span className="av-audit-cell av-audit-cell-admin">
                        <strong>{e.adminUsername}</strong>
                        <UserLink userId={e.adminDiscordId} className="av-audit-user-id">
                          <small>{e.adminDiscordId}</small>
                        </UserLink>
                      </span>
                      <span className="av-audit-cell">
                        <span className={`av-audit-badge av-audit-badge-${actionTone(e.action)}`}>{e.action}</span>
                      </span>
                      <span className="av-audit-cell av-audit-cell-target">
                        {e.targetDiscordId
                          ? <UserLink userId={e.targetDiscordId} asCode />
                          : <em>—</em>}
                      </span>
                      <span className="av-audit-cell av-audit-cell-amount">
                        {typeof e.metadata?.amount === 'number' ? e.metadata.amount.toLocaleString() : '—'}
                      </span>
                      <span className="av-audit-cell av-audit-cell-reason">
                        {e.metadata?.reason || <em>—</em>}
                      </span>
                    </div>
                    </ContextMenu>
                    {isOpen && (
                      <div className="av-audit-detail">
                        <div className="av-audit-detail-meta">
                          <div><span>Event ID</span><code>{e._id}</code></div>
                        </div>
                        <div className="av-audit-detail-cols av-audit-detail-cols--2">
                          <div>
                            <h4>Change</h4>
                            <JsonDiff before={e.before} after={e.after} />
                          </div>
                          <div>
                            <h4>Metadata</h4>
                            <pre className="av-audit-json">{JSON.stringify(e.metadata ?? {}, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* PAGINATION */}
      <nav className="av-audit-pager" aria-label="Pagination">
        <button type="button" className="av-btn av-btn-ghost" disabled={page <= 1 || loading}
          onClick={() => setPage(1)}>« First</button>
        <button type="button" className="av-btn av-btn-ghost" disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
        <span className="av-audit-pager-meta">
          Page <strong>{page}</strong> of {totalPages.toLocaleString()}
        </span>
        <button type="button" className="av-btn av-btn-ghost" disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
        <button type="button" className="av-btn av-btn-ghost" disabled={page >= totalPages || loading}
          onClick={() => setPage(totalPages)}>Last »</button>
      </nav>
    </div>
  );
}
