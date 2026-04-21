'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ContextMenu from '../_components/ContextMenu';
import { useTableKeys } from '../_components/useTableKeys';
import { onButtonKey } from '../_components/a11y';
import { useTimezone } from '../_components/TimezoneProvider';
import { usePeek } from '../_components/PeekProvider';
import ActiveHero, { NoActiveHero } from './ActiveHero';
import ChallengeDetail from './ChallengeDetail';
import CreateDialog from './CreateDialog';
import HallOfFame from './HallOfFame';
import SettingsCard from './SettingsCard';
import TextCustomization from './TextCustomization';
import type {
  Challenge,
  ChallengeConfig,
  ChallengeStatus,
  ChallengeTemplate,
  ChannelOption,
  HoFWinner,
  ListResponse,
  ListStats,
} from './types';

interface Props {
  initial: ListResponse;
  config: ChallengeConfig;
  channels: ChannelOption[];
  templates: ChallengeTemplate[];
}

type Filter = 'all' | ChallengeStatus;

const STATUS_TONE: Record<ChallengeStatus, 'cyan' | 'muted' | 'red' | 'gold'> = {
  active: 'cyan',
  closed: 'muted',
  cancelled: 'red',
  scheduled: 'gold',
};

function rewardSummary(reward: Challenge['reward']): string | null {
  if (!reward || !Array.isArray(reward.tiers) || reward.tiers.length === 0) return null;
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
  const byRank = new Map(reward.tiers.map((t) => [t.rank, t.amount]));
  const parts = [
    byRank.get(1) ? `🥇 ${fmt(byRank.get(1)!)}` : null,
    byRank.get(2) ? `🥈 ${fmt(byRank.get(2)!)}` : null,
    byRank.get(3) ? `🥉 ${fmt(byRank.get(3)!)}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export default function ChallengesClient({ initial, config, channels, templates }: Props) {
  const { fmtRel, absolute } = useTimezone();
  const { openPeek } = usePeek();

  const [active, setActive] = useState<Challenge | null>(initial.activeChallenge);
  const [history, setHistory] = useState<Challenge[]>(initial.challenges);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [stats, setStats] = useState<ListStats>(initial.stats);
  const [hof, setHof] = useState<HoFWinner[]>(initial.hallOfFame);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [tpls, setTpls] = useState<ChallengeTemplate[]>(templates);

  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async (opts?: { filter?: Filter; page?: number; limit?: number }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const f = opts?.filter ?? filter;
    const p = opts?.page ?? page;
    const l = opts?.limit ?? limit;
    const params = new URLSearchParams();
    if (f !== 'all') params.set('status', f);
    params.set('page', String(p));
    params.set('limit', String(l));
    try {
      const res = await fetch(`/api/admin/challenges?${params.toString()}`, { cache: 'no-store', signal: ctrl.signal });
      const body = (await res.json()) as ListResponse;
      if (ctrl.signal.aborted) return;
      setActive(body.activeChallenge);
      setHistory(body.challenges);
      setTotal(body.total);
      setStats(body.stats);
      setHof(body.hallOfFame);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e);
    }
  }, [filter, page, limit]);

  // Debounced refetch when filter / page / limit change (skip first mount)
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = window.setTimeout(() => { void refetch(); }, 200);
    return () => window.clearTimeout(t);
  }, [filter, page, limit, refetch]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return history.filter((c) => {
      if (!ql) return true;
      return c.name.toLowerCase().includes(ql) || (c.description ?? '').toLowerCase().includes(ql);
    });
  }, [history, q]);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { active: activeIdx, setActive: setActiveIdx } = useTableKeys(filtered.length, {
    onActivate: (i) => { const row = filtered[i]; if (row) toggleRow(row._id); },
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="av-audit av-challenges">
      {active
        ? <ActiveHero challenge={active} onAfterAction={() => void refetch()} onCreateClicked={() => setCreating(true)} />
        : <NoActiveHero onCreateClicked={() => setCreating(true)} />}

      <section className="av-surface av-audit-filters">
        <div className="av-audit-row">
          <div className="av-audit-search">
            <input
              className="av-audit-input"
              placeholder="Search by name or description…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search challenges"
            />
            {q && <button type="button" className="av-audit-clear" onClick={() => setQ('')} aria-label="Clear search">×</button>}
          </div>

          <div className="av-inbox-chipset" role="tablist" aria-label="Status">
            {(['all', 'active', 'scheduled', 'closed', 'cancelled'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={`av-inbox-chip av-inbox-chip--status${filter === f ? ' av-inbox-chip--active' : ''}`}
                data-tone={f === 'active' ? 'cyan' : f === 'scheduled' ? 'gold' : f === 'closed' ? 'muted' : f === 'cancelled' ? 'red' : 'muted'}
                onClick={() => { setFilter(f); setPage(1); }}
              >{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>

          <div style={{ flex: 1 }} />
          <button type="button" className="av-btn av-btn-primary" onClick={() => setCreating(true)} disabled={Boolean(active)}
            title={active ? 'An active challenge already exists — close or cancel it first.' : undefined}>
            + New challenge
          </button>
        </div>
      </section>

      <div className="av-audit-meta">
        <span>
          {total.toLocaleString()} total · <span className="av-inbox-meta-seg" data-tone="cyan">{stats.active}</span> active ·{' '}
          <span className="av-inbox-meta-seg" data-tone="muted">{stats.closed}</span> closed ·{' '}
          <span className="av-inbox-meta-seg" data-tone="red">{stats.cancelled}</span> cancelled ·{' '}
          <span>{stats.totalEntries.toLocaleString()} entries</span> ·{' '}
          <span>{stats.totalVotes.toLocaleString()} votes</span>
        </span>
        <label className="av-audit-meta-size">
          Per page
          <select
            className="av-audit-input av-audit-input--sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <section className="av-surface av-audit-table-wrap">
        <table className="av-audit-table av-challenges-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>Challenge</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 90, textAlign: 'right' }}>Entries</th>
              <th style={{ width: 90, textAlign: 'right' }}>Votes</th>
              <th>Rewards</th>
              <th style={{ width: 160 }}>Created</th>
              <th style={{ width: 160 }}>Closed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="av-inbox-empty-cell">Nothing matches those filters.</td></tr>
            )}
            {filtered.map((c, idx) => {
              const isOpen = expanded.has(c._id);
              const isActiveRow = idx === activeIdx;
              const rSummary = rewardSummary(c.reward);
              const ctxItems = [
                { label: 'Open creator', icon: '◇', run: () => openPeek(c.createdBy) },
                { label: 'Export CSV',   icon: '↓', run: () => window.open(`/api/admin/challenges/export?id=${encodeURIComponent(c._id)}&format=csv`, '_blank') },
                { label: 'Export JSON',  icon: '↓', run: () => window.open(`/api/admin/challenges/export?id=${encodeURIComponent(c._id)}&format=json`, '_blank') },
              ];

              return (
                <tr key={c._id} className={isOpen ? 'av-audit-row-open' : ''}>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <ContextMenu items={ctxItems}>
                    <div
                      className={`av-audit-row-trigger av-challenges-row${isActiveRow ? ' av-audit-row-trigger--active' : ''}`}
                      role="button"
                      tabIndex={0}
                      data-row-index={idx}
                      data-active={isActiveRow}
                      onClick={() => { setActiveIdx(idx); toggleRow(c._id); }}
                      onKeyDown={onButtonKey(() => toggleRow(c._id))}
                    >
                      <span className="av-audit-expand-icon" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                      <span className="av-challenges-cell-name">
                        <strong>{c.name}</strong>
                        {c.description && <span className="av-challenges-cell-desc">{c.description}</span>}
                      </span>
                      <span className="av-inbox-status-badge" data-tone={STATUS_TONE[c.status]}>{c.status}</span>
                      <span className="av-challenges-cell-num">{c.entryCount}</span>
                      <span className="av-challenges-cell-num">
                        {c.voteCount}
                        {c.flaggedVoteCount > 0 && <span className="av-challenges-cell-flag" title="Flagged votes">· {c.flaggedVoteCount}⚑</span>}
                      </span>
                      <span className="av-challenges-reward-chip">{rSummary ?? '—'}</span>
                      <span className="av-challenges-cell-time" title={absolute(c.createdAt)}>{fmtRel(c.createdAt)}</span>
                      <span className="av-challenges-cell-time" title={c.closedAt ? absolute(c.closedAt) : undefined}>
                        {c.closedAt ? fmtRel(c.closedAt) : '—'}
                      </span>
                    </div>
                    </ContextMenu>

                    {isOpen && (
                      <div className="av-audit-detail av-challenges-detail-wrap">
                        <ChallengeDetail challengeId={c._id} summary={c} onAfterMutation={() => void refetch()} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {totalPages > 1 && (
        <nav className="av-audit-pager" aria-label="Pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
          <span className="av-audit-pager-meta">Page <strong>{page}</strong> of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
        </nav>
      )}

      <HallOfFame winners={hof} />
      <SettingsCard initial={config} />
      <TextCustomization />

      {creating && (
        <CreateDialog
          templates={tpls}
          channels={channels}
          onCreated={() => { setCreating(false); void refetch({ filter: 'all', page: 1 }); setFilter('all'); setPage(1); }}
          onClose={() => setCreating(false)}
          onTemplateSaved={(t) => setTpls((prev) => [...prev, t])}
          onTemplateDeleted={(id) => setTpls((prev) => prev.filter((x) => x.id !== id))}
        />
      )}
    </div>
  );
}
