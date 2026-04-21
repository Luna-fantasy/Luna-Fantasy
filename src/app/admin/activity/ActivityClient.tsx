'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';

interface ActivityEvent {
  id: string;
  kind: 'audit' | 'lunari' | 'card' | 'stone';
  action: string;
  actor?: string;
  target?: string;
  targetName?: string;
  targetAvatar?: string | null;
  amount?: number;
  timestamp: string;
  description?: string;
}

type Kind = 'all' | 'audit' | 'lunari' | 'card' | 'stone';

const KIND_META: Record<Exclude<Kind, 'all'>, { label: string; color: string; glyph: string }> = {
  audit:  { label: 'Admin',  color: 'var(--accent-legendary, #fbbf24)', glyph: '⚙' },
  lunari: { label: 'Lunari', color: 'var(--accent-primary)',            glyph: '◈' },
  card:   { label: 'Card',   color: '#b066ff',                          glyph: '◆' },
  stone:  { label: 'Stone',  color: '#ff3366',                          glyph: '◉' },
};

const ACTION_META: Record<string, { label: string; tone: 'gain' | 'loss' | 'neutral' }> = {
  lunari_added:       { label: 'Lunari added',        tone: 'gain' },
  lunari_spent:       { label: 'Lunari spent',        tone: 'loss' },
  daily_reward:       { label: 'Daily reward',        tone: 'gain' },
  trade_win:          { label: 'Trade win',           tone: 'gain' },
  trade_loss:         { label: 'Trade loss',          tone: 'loss' },
  shop_purchase:      { label: 'Shop purchase',       tone: 'loss' },
  transfer_in:        { label: 'Transfer received',   tone: 'gain' },
  transfer_out:       { label: 'Transfer sent',       tone: 'loss' },
  loan_taken:         { label: 'Loan taken',          tone: 'gain' },
  loan_repaid:        { label: 'Loan repaid',         tone: 'loss' },
  game_win:           { label: 'Game win',            tone: 'gain' },
  game_loss:          { label: 'Game loss',           tone: 'loss' },
  card_pull:          { label: 'Card pulled',         tone: 'gain' },
  card_sell:          { label: 'Card sold',           tone: 'gain' },
  card_gift:          { label: 'Card gifted',         tone: 'neutral' },
  card_swap:          { label: 'Card swapped',        tone: 'neutral' },
  card_auction_win:   { label: 'Card auction won',    tone: 'gain' },
  luckbox:            { label: 'Luckbox',             tone: 'neutral' },
  stone_chest:        { label: 'Stone chest',         tone: 'gain' },
  stone_gift:         { label: 'Stone gifted',        tone: 'neutral' },
  stone_sell:         { label: 'Stone sold',          tone: 'gain' },
  stone_auction_win:  { label: 'Stone auction won',   tone: 'gain' },
  stone_swap:         { label: 'Stone swapped',       tone: 'neutral' },
};

function humanizeAction(action: string) {
  const meta = ACTION_META[action];
  if (meta) return meta;
  const label = action.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { label, tone: 'neutral' as const };
}

function formatAmount(n: number, tone: 'gain' | 'loss' | 'neutral') {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : tone === 'gain' ? '+' : tone === 'loss' ? '−' : '';
  const cls = n < 0 || tone === 'loss' ? 'av-pulse-amt--loss' : tone === 'gain' ? 'av-pulse-amt--gain' : 'av-pulse-amt--neutral';
  return { text: `${sign}${abs.toLocaleString()}`, cls };
}

const PAGE_SIZE = 50;
const REFRESH_MS = 30_000;

export default function ActivityClient() {
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [kind, setKind] = useState<Kind>('all');
  const [action, setAction] = useState<string>('');
  const [userQuery, setUserQuery] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async (replace: boolean, currentOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(currentOffset),
      });
      if (kind !== 'all') params.set('kind', kind);
      if (action) params.set('action', action);
      if (userId) params.set('userId', userId);
      else if (userQuery) params.set('userQuery', userQuery);

      const res = await fetch(`/api/admin/activity/search?${params}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setEvents((prev) => replace ? body.events : [...prev, ...body.events]);
      setTotal(body.total ?? 0);
      setHasMore(!!body.hasMore);
      setLastRefresh(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind, action, userId, userQuery]);

  useEffect(() => {
    setOffset(0);
    void load(true, 0);
  }, [kind, action, userId, userQuery, load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => { void load(true, 0); setOffset(0); }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [autoRefresh, load]);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    void load(false, next);
  };

  const resetFilters = () => {
    setKind('all');
    setAction('');
    setUserQuery('');
    setUserId('');
  };

  const anyFilter = kind !== 'all' || !!action || !!userId || !!userQuery;

  return (
    <section className="av-surface av-activity">
      <div className="av-activity-toolbar">
        <div className="av-activity-chips">
          {([
            { id: 'all' as Kind,    label: 'All',    count: total },
            { id: 'lunari' as Kind, label: '◈ Lunari' },
            { id: 'card' as Kind,   label: '◆ Cards' },
            { id: 'stone' as Kind,  label: '◉ Stones' },
            { id: 'audit' as Kind,  label: '⚙ Admin' },
          ]).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`av-activity-chip${kind === c.id ? ' av-activity-chip--active' : ''}`}
              onClick={() => setKind(c.id)}
            >
              {c.label}
              {typeof c.count === 'number' && c.count > 0 && <span className="av-activity-chip-count">{c.count.toLocaleString()}</span>}
            </button>
          ))}
        </div>

        <div className="av-activity-filters">
          <input
            className="av-audit-input av-activity-filter"
            placeholder="Filter by action (e.g. card_pull, lunari_added)"
            value={action}
            onChange={(e) => setAction(e.target.value.trim())}
          />
          <input
            className="av-audit-input av-activity-filter"
            placeholder="Username"
            value={userQuery}
            onChange={(e) => { setUserQuery(e.target.value); setUserId(''); }}
          />
          <input
            className="av-audit-input av-activity-filter av-activity-filter--mono"
            placeholder="…or Discord ID"
            inputMode="numeric"
            value={userId}
            onChange={(e) => { setUserId(e.target.value.replace(/[^\d]/g, '').slice(0, 20)); if (e.target.value) setUserQuery(''); }}
          />
          {anyFilter && (
            <button type="button" className="av-btn av-btn-ghost" onClick={resetFilters}>✕ Clear</button>
          )}
        </div>

        <div className="av-activity-toolbar-right">
          <label className="av-activity-auto">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <span>Auto-refresh (30s)</span>
          </label>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => { setOffset(0); void load(true, 0); }} disabled={loading}>
            {loading ? '⏳' : '↻'} Refresh
          </button>
          {lastRefresh && mounted && (
            <span className="av-activity-last-refresh">updated {fmtRel(lastRefresh.toISOString())}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="av-inbox-transcript-empty">
          <strong>Activity unavailable.</strong> {error}
          <button type="button" className="av-btn av-btn-ghost" onClick={() => { setOffset(0); void load(true, 0); }} style={{ marginTop: 8 }}>Retry</button>
        </div>
      )}

      <ul className="av-pulse-list av-activity-list">
        {events.length === 0 && !loading && (
          <li className="av-pulse-empty">
            {anyFilter
              ? 'No activity matches these filters. Clear them to see everything.'
              : 'No activity yet — the chronicle is quiet.'}
          </li>
        )}
        {events.map((e) => {
          const km = KIND_META[e.kind];
          const { label: actionLabel, tone } = humanizeAction(e.action);
          const displayName = e.targetName || e.target || '';
          const canPeek = !!e.target;
          return (
            <li key={e.id} className="av-pulse-row" style={{ ['--pulse-c' as any]: km.color }}>
              <span className="av-pulse-stripe" aria-hidden="true" />
              <span className="av-pulse-kind" title={km.label}>
                <span className="av-pulse-kind-glyph" aria-hidden="true">{km.glyph}</span>
                <span>{km.label}</span>
              </span>

              {canPeek ? (
                <button
                  type="button"
                  className="av-pulse-user"
                  onClick={(ev) => { ev.stopPropagation(); openPeek(e.target!); }}
                  title={`Open ${displayName || e.target}`}
                >
                  {e.targetAvatar ? (
                    <img className="av-pulse-avatar" src={e.targetAvatar} alt="" loading="lazy" />
                  ) : (
                    <span className="av-pulse-avatar-fallback">{(displayName || '?').slice(0, 1).toUpperCase()}</span>
                  )}
                  <span className="av-pulse-uname">{displayName || 'Unknown user'}</span>
                </button>
              ) : <span />}

              <span className={`av-pulse-action av-pulse-action--${tone}`}>
                {actionLabel}
                {e.description && <em className="av-activity-desc"> · {e.description}</em>}
              </span>

              {typeof e.amount === 'number' && e.amount !== 0 && (() => {
                const { text, cls } = formatAmount(e.amount, tone);
                return <span className={`av-pulse-amt ${cls}`}>{text}</span>;
              })()}

              {e.actor && <span className="av-pulse-actor" title={`Admin action by ${e.actor}`}>by {e.actor}</span>}

              <span className="av-pulse-time" title={absolute(e.timestamp)}>
                {mounted ? fmtRel(e.timestamp) : '—'}
              </span>
            </li>
          );
        })}
      </ul>

      {events.length > 0 && (
        <div className="av-activity-footer">
          <span>{events.length.toLocaleString()} shown{total > 0 ? ` of ${total.toLocaleString()}` : ''}</span>
          {hasMore && (
            <button type="button" className="av-btn av-btn-primary" onClick={loadMore} disabled={loading}>
              {loading ? '⏳ Loading…' : 'Load older →'}
            </button>
          )}
          {!hasMore && events.length > 0 && (
            <span className="av-activity-end">— end of chronicle —</span>
          )}
        </div>
      )}
    </section>
  );
}
