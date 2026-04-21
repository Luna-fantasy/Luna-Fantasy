'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../_components/Icon';
import Sparkline from '../_components/Sparkline';
import ContextMenu from '../_components/ContextMenu';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import { onButtonKey } from '../_components/a11y';
import {
  BulkSelectProvider,
  BulkCheckbox,
  BulkSelectAll,
  BulkActionBar,
  useBulkSelect,
  type BulkAction,
} from '../_components/BulkSelect';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import BulkMessageDialog from './BulkMessageDialog';
import BulkBalanceDialog from './BulkBalanceDialog';

interface Rank {
  id: string;
  title: string;
  tier: number;
  tone: string;
  tone2: string | null;
  glyph: string;
}

interface UserRow {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  balance: number;
  level: number;
  passport: { number?: string; faction?: string; staffRole?: string } | null;
  cardCount: number;
  stoneCount: number;
  sparkline: number[];
  anomalies: string[];
  lastActive: string | null;
  rank: Rank;
}

const FACTION_GLYPH: Record<string, string> = {
  lunarians: '☾', sentinel: '⚔', mastermind: '◈',
  underworld: '✦', siren: '◐', seer: '✧',
};

const ANOMALY_META: Record<string, { label: string; icon: string; tone: string }> = {
  'top-holder': { label: 'Top holder (90th %ile)', icon: '⬆', tone: 'legend' },
  'big-gain':   { label: '+1M in last 14 days',    icon: '▲', tone: 'gain' },
  'big-loss':   { label: '−1M in last 14 days',    icon: '▼', tone: 'loss' },
  'ghost':      { label: 'Inactive with big bag',  icon: '●', tone: 'ghost' },
};

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

type Sort = 'balance' | 'level' | 'name' | 'recent';

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  if (!res.ok) throw new Error('CSRF fetch failed');
  return (await res.json()).token;
}

export default function UsersClient() {
  const { openPeek } = usePeek();
  const { fmtRel } = useTimezone();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [faction, setFaction] = useState('');
  const [staffOnly, setStaffOnly] = useState(false);
  const [passportOnly, setPassportOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('balance');
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
    if (passportOnly) params.set('passportOnly', '1');
    params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', String(limit));

    try {
      const res = await fetch(`/api/admin/users/list?${params.toString()}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Users list fetch:', err);
      }
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, [q, faction, staffOnly, passportOnly, sort, page, limit]);

  // Debounce text search + reset page on filter change
  useEffect(() => {
    const t = window.setTimeout(fetchList, 220);
    return () => window.clearTimeout(t);
  }, [fetchList]);

  const filterTag = `${q}|${faction}|${staffOnly}|${passportOnly}|${sort}`;
  const prevFilterRef = useRef(filterTag);
  useEffect(() => {
    if (prevFilterRef.current !== filterTag) {
      prevFilterRef.current = filterTag;
      setPage(1);
    }
  }, [filterTag]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const allIds = useMemo(() => rows.map((r) => r.discordId), [rows]);

  return (
    <BulkSelectProvider ids={allIds}>
    <div className="av-users">
      <section className="av-surface av-users-filters">
        <div className="av-users-filter-row">
          <div className="av-audit-search" style={{ flex: '1 1 260px' }}>
            <Icon name="search" size={14} />
            <input
              className="av-audit-input"
              placeholder="Search by name or Discord ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button type="button" className="av-audit-clear" onClick={() => setQ('')}>×</button>}
          </div>

          <select className="av-audit-input av-audit-input--sm"
            value={faction} onChange={(e) => setFaction(e.target.value)}
            style={{ width: 160 }}>
            <option value="">All factions</option>
            <option value="lunarians">Lunarians</option>
            <option value="sentinel">Sentinel</option>
            <option value="mastermind">Mastermind</option>
            <option value="underworld">Underworld</option>
            <option value="siren">Siren</option>
            <option value="seer">Seer</option>
          </select>

          <select className="av-audit-input av-audit-input--sm"
            value={sort} onChange={(e) => setSort(e.target.value as Sort)}
            style={{ width: 160 }}>
            <option value="balance">Sort: Balance</option>
            <option value="level">Sort: Level</option>
            <option value="name">Sort: Name</option>
            <option value="recent">Sort: Recent</option>
          </select>

          <label className="av-users-toggle">
            <input type="checkbox" checked={staffOnly} onChange={(e) => setStaffOnly(e.target.checked)} />
            <span>Staff only</span>
          </label>
          <label className="av-users-toggle">
            <input type="checkbox" checked={passportOnly} onChange={(e) => setPassportOnly(e.target.checked)} />
            <span>With passport</span>
          </label>
        </div>
      </section>

      <div className="av-audit-meta">
        <span className="av-users-meta-select">
          <BulkSelectAll />
          <span>{loading ? 'Loading…' : `${total.toLocaleString()} ${total === 1 ? 'resident' : 'residents'}`}</span>
        </span>
      </div>

      <div className="av-users-grid">
        {rows.length === 0 && !loading && (
          <div className="av-flows-empty" style={{ gridColumn: '1 / -1' }}>
            No residents match these filters.
          </div>
        )}

        {rows.map((u) => (
          <ContextMenu
            key={u.discordId}
            items={[
              { label: 'Peek', icon: '◇', run: () => openPeek(u.discordId) },
              { label: 'Open profile', icon: '›', run: () => { window.location.href = `/admin/users/${u.discordId}`; } },
              'separator' as const,
              { label: 'Copy Discord ID', icon: '⧉', run: () => navigator.clipboard?.writeText(u.discordId) },
              { label: 'View audit trail', icon: '⌕', run: () => { window.location.href = `/admin/audit?targetDiscordId=${u.discordId}`; } },
            ]}
          >
          <div
            className={`av-user-card av-rank-${u.rank.id}${u.anomalies.length > 0 ? ' av-user-card--flagged' : ''}`}
            onClick={() => openPeek(u.discordId)}
            onKeyDown={onButtonKey(() => openPeek(u.discordId))}
            role="button"
            tabIndex={0}
            style={{
              ['--vt-name' as any]: `u-${u.discordId}`,
              ['--rank-tone' as any]: u.rank.tone,
              ['--rank-tone-2' as any]: u.rank.tone2 ?? u.rank.tone,
            }}
          >
            <span className="av-user-card-bulk">
              <BulkCheckbox id={u.discordId} aria-label={`Select ${u.globalName ?? u.username ?? u.discordId}`} />
            </span>
            <div className="av-user-card-rank">
              <span className="av-user-card-rank-glyph" aria-hidden="true">{u.rank.glyph}</span>
              <span>{u.rank.title}</span>
            </div>
            <div className="av-user-card-top">
              <div
                className="av-user-card-avatar av-vt-avatar"
                style={{
                  ['--vt-name' as any]: `av-${u.discordId}`,
                  borderColor: `color-mix(in srgb, ${u.rank.tone} 60%, transparent)`,
                }}
              >
                {u.image
                  ? <img src={u.image} alt="" />
                  : <span>{(u.globalName ?? u.username ?? '?').slice(0, 1).toUpperCase()}</span>}
                {u.passport?.staffRole && (
                  <span className={`av-peek-badge av-peek-badge-${u.passport.staffRole.toLowerCase()}`}
                    title={u.passport.staffRole}>
                    {u.passport.staffRole.slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="av-user-card-ident">
                <div className="av-user-card-name">{u.globalName ?? u.username ?? '—'}</div>
                {u.passport?.number && (
                  <div className="av-user-card-pass">
                    <span aria-hidden="true">
                      {FACTION_GLYPH[(u.passport.faction ?? '').toLowerCase()] ?? '◯'}
                    </span>
                    {u.passport.number}
                  </div>
                )}
                {!u.passport && <div className="av-user-card-pass av-user-card-pass--none">No passport</div>}
              </div>
            </div>

            <div className="av-user-card-stats">
              <div>
                <span>Lunari</span>
                <strong>{fmt(u.balance)}</strong>
              </div>
              <div>
                <span>Level</span>
                <strong>{u.level}</strong>
              </div>
              <div>
                <span>Cards</span>
                <strong>{fmt(u.cardCount)}</strong>
              </div>
              <div>
                <span>Stones</span>
                <strong>{fmt(u.stoneCount)}</strong>
              </div>
            </div>

            {u.sparkline && u.sparkline.length > 1 && (() => {
              const min = Math.min(...u.sparkline);
              const max = Math.max(...u.sparkline);
              // Only render if there's actual variation — otherwise it's just a flat line adding noise
              return max - min > Math.max(1, max * 0.01);
            })() && (
              <div className="av-user-card-spark" title="14-day balance trajectory">
                <Sparkline data={u.sparkline} width={240} height={36} tone="var(--accent-primary)" />
              </div>
            )}

            {u.anomalies.length > 0 && (
              <div className="av-user-card-flags">
                {u.anomalies.map((a) => {
                  const meta = ANOMALY_META[a] ?? { label: a, icon: '⚠', tone: 'ghost' };
                  return (
                    <span key={a} className={`av-flag av-flag-${meta.tone}`} title={meta.label}>
                      <span>{meta.icon}</span>
                      <small>{meta.label}</small>
                    </span>
                  );
                })}
              </div>
            )}

            {u.lastActive && (
              <div className="av-user-card-last">Active {fmtRel(u.lastActive)}</div>
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

      <UsersBulkBar rows={rows} onDone={fetchList} />
    </div>
    </BulkSelectProvider>
  );
}

function UsersBulkBar({ rows, onDone }: { rows: UserRow[]; onDone: () => void }) {
  const { selected, clear } = useBulkSelect();
  const toast = useToast();
  const undo = useUndo();
  const [dialog, setDialog] = useState<'message' | 'balance' | null>(null);

  const selectedIds = Array.from(selected);
  if (selectedIds.length === 0 && !dialog) return null;

  const sendBulkMessage = async (message: string) => {
    const token = await fetchCsrf().catch(() => '');
    const targets = selectedIds;
    let ok = 0;
    let failed = 0;
    for (const discordId of targets) {
      try {
        const res = await fetch('/api/admin/dm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          credentials: 'include',
          body: JSON.stringify({ targetUserId: discordId, content: message }),
        });
        if (res.ok) ok++; else failed++;
      } catch { failed++; }
      // small spacing to avoid hammering rate limit
      await new Promise((r) => setTimeout(r, 150));
    }
    setDialog(null);
    clear();
    toast.show({
      tone: failed === 0 ? 'success' : ok === 0 ? 'error' : 'warn',
      title: failed === 0 ? 'Queued' : 'Partial',
      message: `${ok} delivered, ${failed} failed`,
    });
  };

  const applyBulkBalance = async (amount: number, reason: string) => {
    const token = await fetchCsrf().catch(() => '');
    const targets = selectedIds;
    const applied: Array<{ discordId: string; balanceBefore: number; balanceAfter: number }> = [];
    let failed = 0;
    for (const discordId of targets) {
      try {
        const res = await fetch(`/api/admin/users/${discordId}/balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          credentials: 'include',
          body: JSON.stringify({ amount, reason }),
        });
        if (res.ok) {
          const data = await res.json();
          applied.push({ discordId, balanceBefore: data.balanceBefore, balanceAfter: data.balanceAfter });
        } else {
          failed++;
        }
      } catch { failed++; }
      await new Promise((r) => setTimeout(r, 150));
    }
    setDialog(null);
    clear();

    // One grouped undo entry that reverses every successful adjustment
    if (applied.length > 0) {
      undo.push({
        label: `${applied.length} balance ${applied.length === 1 ? 'change' : 'changes'} reversed`,
        detail: `${amount > 0 ? '+' : ''}${amount.toLocaleString()} Lunari`,
        revert: async () => {
          const revertToken = await fetchCsrf().catch(() => '');
          let reverted = 0;
          for (const a of applied) {
            try {
              const res = await fetch(`/api/admin/users/${a.discordId}/balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': revertToken },
                credentials: 'include',
                body: JSON.stringify({ amount: -amount, reason: `Undo bulk adjust: ${reason}` }),
              });
              if (res.ok) reverted++;
            } catch { /* continue reverting others */ }
            await new Promise((r) => setTimeout(r, 150));
          }
          toast.show({
            tone: reverted === applied.length ? 'success' : 'warn',
            title: 'Undone',
            message: `${reverted}/${applied.length} balance changes reversed`,
          });
          onDone();
        },
      });
    }

    toast.show({
      tone: failed === 0 ? 'success' : applied.length === 0 ? 'error' : 'warn',
      title: failed === 0 ? 'Applied' : 'Partial',
      message: `${applied.length} applied, ${failed} failed`,
    });
    onDone();
  };

  const actions: BulkAction[] = [
    { label: `Message ${selectedIds.length}`,  tone: 'default', onRun: () => { setDialog('message'); } },
    { label: `Adjust balance`,                 tone: 'primary', onRun: () => { setDialog('balance'); } },
  ];

  return (
    <>
      <BulkActionBar actions={actions} />
      {dialog === 'message' && (
        <BulkMessageDialog count={selectedIds.length} onClose={() => setDialog(null)} onSend={sendBulkMessage} />
      )}
      {dialog === 'balance' && (
        <BulkBalanceDialog count={selectedIds.length} onClose={() => setDialog(null)} onApply={applyBulkBalance} />
      )}
    </>
  );
}
