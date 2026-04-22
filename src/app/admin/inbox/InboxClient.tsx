'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ContextMenu from '../_components/ContextMenu';
import { usePeek } from '../_components/PeekProvider';
import { useTableKeys } from '../_components/useTableKeys';
import { onButtonKey } from '../_components/a11y';
import { useSavedViews } from '../_components/useSavedViews';
import { useTimezone } from '../_components/TimezoneProvider';
import TicketDetail from './TicketDetail';
import ApplicationDetail from './ApplicationDetail';
import type { InboxKind, InboxStatus, UnifiedInboxItem, InboxCategory } from '@/lib/admin/inbox';

interface InitialInbox {
  items: UnifiedInboxItem[];
  total: number;
  byStatus: Record<InboxStatus, number>;
}

interface Props {
  initial: InitialInbox;
  categories: InboxCategory[];
  adminId: string;
  guildId: string;
  votesRequired: number;
}

interface Filters {
  q: string;
  kind: 'all' | InboxKind;
  status: 'all' | InboxStatus;
  categoryId: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
}

const EMPTY: Filters = { q: '', kind: 'all', status: 'all', categoryId: '', userId: '', dateFrom: '', dateTo: '', limit: 50 };

const KIND_LABEL: Record<'all' | InboxKind, string> = { all: 'All', ticket: 'Tickets', application: 'Applications' };
const STATUS_LABEL: Record<'all' | InboxStatus, string> = {
  all: 'All',
  open: 'Open',
  pending: 'Pending',
  accepted: 'Accepted',
  closed: 'Closed',
  rejected: 'Rejected',
};

export default function InboxClient({ initial, categories, adminId, guildId, votesRequired }: Props) {
  const { fmtRel, absolute } = useTimezone();
  const { openPeek } = usePeek();
  const savedViews = useSavedViews<Filters>('inbox');
  const search = useSearchParams();

  const initialFilters = useMemo<Filters>(() => {
    const kindParam = search?.get('kind');
    const statusParam = search?.get('status');
    const kind: Filters['kind'] = kindParam === 'ticket' || kindParam === 'application' ? kindParam : 'all';
    const status: Filters['status'] =
      statusParam === 'open' || statusParam === 'pending' || statusParam === 'accepted'
        || statusParam === 'closed' || statusParam === 'rejected'
        ? statusParam : 'all';
    return { ...EMPTY, kind, status };
  }, [search]);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UnifiedInboxItem[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [byStatus, setByStatus] = useState(initial.byStatus);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewsOpen, setViewsOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const firstRun = useRef(true);

  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const reset = () => { setFilters(EMPTY); setPage(1); };

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { active, setActive } = useTableKeys(items.length, {
    onActivate: (i) => { const row = items[i]; if (row) toggleRow(row._id); },
  });

  // Debounced refetch on filter change
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = window.setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.kind !== 'all') params.set('kind', filters.kind);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      params.set('limit', String(filters.limit));
      params.set('offset', String((page - 1) * filters.limit));

      fetch(`/api/admin/v2/inbox?${params.toString()}`, { cache: 'no-store', signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          if (ctrl.signal.aborted) return;
          setItems(Array.isArray(data.items) ? data.items : []);
          setTotal(Number(data.total ?? 0));
          setByStatus(data.byStatus ?? { open: 0, closed: 0, pending: 0, accepted: 0, rejected: 0 });
        })
        .catch((e) => { if ((e as Error).name !== 'AbortError') console.error(e); })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 250);

    return () => window.clearTimeout(t);
  }, [filters, page]);

  const patchItem = useCallback((next: UnifiedInboxItem) => {
    setItems((list) => list.map((i) => i._id === next._id ? next : i));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  // Seed a couple of helpful default views once
  useEffect(() => {
    if (savedViews.views.length > 0) return;
    savedViews.add('Pending applications', { ...EMPTY, kind: 'application', status: 'pending' });
    savedViews.add('Open tickets',          { ...EMPTY, kind: 'ticket',      status: 'open' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="av-audit av-inbox">
      {/* FILTER BAR */}
      <section className="av-surface av-audit-filters">
        <div className="av-audit-row">
          <div className="av-audit-search">
            <input
              className="av-audit-input"
              placeholder="Search users, categories, reasons, answers…"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              aria-label="Search inbox"
            />
            {filters.q && (
              <button type="button" className="av-audit-clear" onClick={() => update({ q: '' })} aria-label="Clear search">×</button>
            )}
          </div>

          <div className="av-inbox-chipset" role="tablist" aria-label="Kind">
            {(['all', 'ticket', 'application'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filters.kind === k}
                className={`av-inbox-chip${filters.kind === k ? ' av-inbox-chip--active' : ''}`}
                data-kind={k}
                onClick={() => update({ kind: k })}
              >{KIND_LABEL[k]}</button>
            ))}
          </div>

          <div className="av-inbox-chipset" role="tablist" aria-label="Status">
            {(['all', 'open', 'pending', 'accepted', 'closed', 'rejected'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={filters.status === s}
                className={`av-inbox-chip av-inbox-chip--status${filters.status === s ? ' av-inbox-chip--active' : ''}`}
                data-tone={toneFor(s)}
                onClick={() => update({ status: s })}
                title={s === 'all' ? 'Every status' : s}
              >{STATUS_LABEL[s]}</button>
            ))}
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
              <span>Views{savedViews.views.length > 0 ? ` (${savedViews.views.length})` : ''}</span>
              <span aria-hidden="true">▾</span>
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
                        title={v.pinned ? 'Unpin' : 'Pin'}>{v.pinned ? '◉' : '○'}</button>
                      <button type="button" className="av-audit-view-icon av-audit-view-icon--danger"
                        onClick={() => savedViews.remove(v.id)} title="Delete">×</button>
                    </div>
                  ))}
                {hasFilters && (
                  <button
                    type="button"
                    className="av-audit-view-save"
                    onClick={() => {
                      const name = window.prompt('Name this view:');
                      if (name?.trim()) { savedViews.add(name.trim(), filters); setViewsOpen(false); }
                    }}
                  >+ Save current filter</button>
                )}
              </div>
            )}
          </div>

          {hasFilters && (
            <button type="button" className="av-btn av-btn-ghost" onClick={reset}>Reset</button>
          )}
        </div>

        <div className="av-audit-row av-audit-row--grid">
          <label className="av-audit-field">
            <span>Category</span>
            <select
              className="av-audit-input av-audit-input--sm"
              value={filters.categoryId}
              onChange={(e) => update({ categoryId: e.target.value })}
            >
              <option value="">Any</option>
              {categories
                .filter((c) => filters.kind === 'all' || c.kind === filters.kind)
                .map((c) => <option key={`${c.kind}:${c.id}`} value={c.id}>{c.title} ({c.kind})</option>)}
            </select>
          </label>

          <label className="av-audit-field">
            <span>User ID</span>
            <input
              className="av-audit-input av-audit-input--sm"
              value={filters.userId}
              placeholder="Discord ID"
              inputMode="numeric"
              onChange={(e) => update({ userId: e.target.value.replace(/[^\d]/g, '') })}
            />
          </label>

          <label className="av-audit-field">
            <span>From</span>
            <input
              className="av-audit-input av-audit-input--sm"
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
            />
          </label>
          <label className="av-audit-field">
            <span>To</span>
            <input
              className="av-audit-input av-audit-input--sm"
              type="datetime-local"
              value={filters.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
            />
          </label>
        </div>
      </section>

      {/* META */}
      <div className="av-audit-meta">
        <span>
          {total.toLocaleString()} {total === 1 ? 'item' : 'items'} · <span className="av-inbox-meta-seg" data-tone="cyan">{byStatus.open}</span> open ·{' '}
          <span className="av-inbox-meta-seg" data-tone="gold">{byStatus.pending}</span> pending ·{' '}
          <span className="av-inbox-meta-seg" data-tone="green">{byStatus.accepted}</span> accepted ·{' '}
          <span className="av-inbox-meta-seg" data-tone="muted">{byStatus.closed}</span> closed ·{' '}
          <span className="av-inbox-meta-seg" data-tone="red">{byStatus.rejected}</span> rejected
          {loading && <span className="av-inbox-loading"> · refreshing…</span>}
        </span>
        <label className="av-audit-meta-size">
          Per page
          <select
            className="av-audit-input av-audit-input--sm"
            value={filters.limit}
            onChange={(e) => update({ limit: Number(e.target.value) })}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>
      </div>

      {/* TABLE */}
      <section className="av-surface av-audit-table-wrap">
        <table className="av-audit-table av-inbox-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th style={{ width: 56 }}>Kind</th>
              <th style={{ width: 220 }}>User</th>
              <th>Category</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 180 }}>Opened</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="av-inbox-empty-cell">Nothing matches those filters.</td></tr>
            )}
            {items.map((row, idx) => {
              const isOpen = expanded.has(row._id);
              const isActive = idx === active;
              const ctxItems = [
                { label: 'Open peek', icon: '◇', run: () => openPeek(row.userId) },
                ...(row.kind === 'ticket' && row.threadId
                  ? [{ label: 'Open in Discord', icon: '↗', run: () => window.open(`https://discord.com/channels/${guildId}/${row.threadId}`, '_blank') }]
                  : []),
                'separator' as const,
                { label: 'Filter this user',     icon: '⌕', run: () => update({ userId: row.userId }) },
                { label: 'Filter this category', icon: '⌕', run: () => update({ categoryId: row.categoryId }) },
              ];

              return (
                <tr key={row._id} className={isOpen ? 'av-audit-row-open' : ''}>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <ContextMenu items={ctxItems}>
                    <div
                      className={`av-audit-row-trigger${isActive ? ' av-audit-row-trigger--active' : ''}`}
                      role="button"
                      tabIndex={0}
                      data-row-index={idx}
                      data-active={isActive}
                      onClick={() => { setActive(idx); toggleRow(row._id); }}
                      onKeyDown={onButtonKey(() => toggleRow(row._id))}
                    >
                      <span className="av-audit-expand-icon" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>

                      <span className="av-inbox-kind-icon" data-kind={row.kind} title={row.kind}>
                        {row.kind === 'ticket' ? '✉' : '◈'}
                      </span>

                      <span className="av-inbox-cell-user">
                        {row.userAvatar
                          ? <img className="av-inbox-cell-avatar" src={row.userAvatar} alt="" />
                          : <span className="av-inbox-cell-avatar av-inbox-cell-avatar--fallback">{(row.userName ?? row.userId).slice(0, 1).toUpperCase()}</span>}
                        <span className="av-inbox-cell-name">{row.userName ?? row.userId}</span>
                      </span>

                      <span className="av-inbox-cell-category">
                        {row.kind === 'ticket' && row.ticketNumber != null && (
                          <span className="av-inbox-cell-num">#{row.ticketNumber}</span>
                        )}
                        {row.categoryTitle ?? row.categoryId}
                      </span>

                      <span className="av-inbox-status-badge" data-tone={row.tone}>{row.status}</span>

                      <span className="av-inbox-cell-time" title={absolute(row.createdAt)}>{fmtRel(row.createdAt)}</span>
                    </div>
                    </ContextMenu>

                    {isOpen && (
                      <div className="av-audit-detail av-inbox-detail-wrap">
                        {row.kind === 'ticket'
                          ? <TicketDetail       item={row} guildId={guildId}    onStatusChange={patchItem} />
                          : <ApplicationDetail  item={row} votesRequired={votesRequired} adminId={adminId} onStatusChange={patchItem} />}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* PAGER */}
      {totalPages > 1 && (
        <nav className="av-audit-pager" aria-label="Pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
          <span className="av-audit-pager-meta">Page <strong>{page}</strong> of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
        </nav>
      )}
    </div>
  );
}

function toneFor(status: 'all' | InboxStatus): string {
  switch (status) {
    case 'open':     return 'cyan';
    case 'pending':  return 'gold';
    case 'accepted': return 'green';
    case 'closed':   return 'muted';
    case 'rejected': return 'red';
    default:         return 'muted';
  }
}
