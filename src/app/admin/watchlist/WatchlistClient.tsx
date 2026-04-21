'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { usePeek } from '../_components/PeekProvider';

interface Flag {
  type: string;
  reason: string;
  addedBy: string;
  addedByUsername?: string;
  addedAt: string;
}

interface WatchedUser {
  userId: string;
  username?: string;
  avatar?: string;
  balance?: number;
  flags: Flag[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const FLAG_LABELS: Record<string, { label: string; tone: string; glyph: string }> = {
  suspicious_lunari:  { label: 'Suspicious Lunari', tone: '#FFD54F', glyph: '💰' },
  alt_account:        { label: 'Alt account',       tone: '#B066FF', glyph: '👥' },
  grinding:           { label: 'Grinding abuse',    tone: '#00FF99', glyph: '⚙️' },
  manual:             { label: 'Manual flag',       tone: '#48D8FF', glyph: '📌' },
  trade_abuse:        { label: 'Trade abuse',       tone: '#FF3366', glyph: '🔄' },
  chargeback_risk:    { label: 'Chargeback risk',   tone: '#ED4245', glyph: '⚠️' },
};

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function fmt(n?: number): string { return (n ?? 0).toLocaleString(); }
function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default function WatchlistClient() {
  const toast = useToast();
  const pending = usePendingAction();
  const { openPeek } = usePeek();

  const [users, setUsers] = useState<WatchedUser[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newType, setNewType] = useState<string>('manual');
  const [newReason, setNewReason] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/watchlist', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setUsers(body.watchlist ?? []);
      setStats(body.stats ?? {});
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const addFlag = async () => {
    if (!/^\d{17,20}$/.test(newUserId)) {
      toast.show({ tone: 'error', title: 'Invalid ID', message: 'Discord IDs are 17-20 digits' });
      return;
    }
    setAdding(true);
    try {
      const token = await fetchCsrf();
      const res = await fetch('/api/admin/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify({ userId: newUserId, type: newType, reason: newReason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      toast.show({ tone: 'success', title: 'Flagged', message: `${newUserId} added to watchlist` });
      setNewUserId(''); setNewReason(''); setNewType('manual');
      void load();
    } catch (e) {
      toast.show({ tone: 'error', title: 'Add failed', message: (e as Error).message });
    } finally {
      setAdding(false);
    }
  };

  const removeFlag = (userId: string, flagIndex: number, label: string) => {
    pending.queue({
      label: `Remove flag: ${label}`,
      detail: 'One flag will be removed from this user',
      delayMs: 4500,
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/watchlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ userId, flagIndex }),
          });
          if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || `HTTP ${res.status}`); }
          toast.show({ tone: 'success', title: 'Removed', message: label });
          void load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Remove failed', message: (e as Error).message });
        }
      },
    });
  };

  const clearUser = (userId: string, flagCount: number) => {
    pending.queue({
      label: `Remove from watchlist (${flagCount} flags)`,
      detail: 'This user will be entirely removed from the list',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/watchlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ userId, clearAll: true }),
          });
          if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || `HTTP ${res.status}`); }
          toast.show({ tone: 'success', title: 'Cleared', message: userId });
          void load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Clear failed', message: (e as Error).message });
        }
      },
    });
  };

  const filtered = users.filter((u) => {
    if (filter === 'all') return true;
    return u.flags.some((f) => f.type === filter);
  });

  return (
    <div className="av-watchlist-page">
      <div className="av-voice-stat-summary">
        <div><strong>{users.length}</strong><span>Watched users</span></div>
        <div><strong>{users.reduce((s, u) => s + u.flags.length, 0)}</strong><span>Total flags</span></div>
        {Object.entries(stats).slice(0, 3).map(([type, count]) => (
          <div key={type}><strong>{count}</strong><span>{FLAG_LABELS[type]?.label ?? type}</span></div>
        ))}
      </div>

      <article className="av-surface">
        <header className="av-flows-head">
          <div>
            <h3>Add to watchlist</h3>
            <p>Flag a user for future attention. You can add multiple flags per user over time.</p>
          </div>
        </header>
        <div className="av-watchlist-add">
          <input
            type="text"
            className="av-shopf-input av-shopf-input--mono"
            placeholder="Discord ID"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            style={{ maxWidth: 220 }}
          />
          <select className="av-shopf-input" value={newType} onChange={(e) => setNewType(e.target.value)} style={{ maxWidth: 220 }}>
            {Object.entries(FLAG_LABELS).map(([key, info]) => (
              <option key={key} value={key}>{info.glyph} {info.label}</option>
            ))}
          </select>
          <input
            type="text"
            className="av-shopf-input"
            placeholder="Reason (optional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value.slice(0, 500))}
          />
          <button type="button" className="av-btn av-btn-primary" onClick={addFlag} disabled={adding || !newUserId}>
            {adding ? 'Adding…' : 'Flag user'}
          </button>
        </div>
      </article>

      <div className="av-commands-controls">
        <div className="av-inbox-chipset">
          <button type="button" className={`av-inbox-chip${filter === 'all' ? ' av-inbox-chip--active' : ''}`} onClick={() => setFilter('all')}>All</button>
          {Object.entries(FLAG_LABELS).map(([key, info]) => (
            <button key={key} type="button" className={`av-inbox-chip${filter === key ? ' av-inbox-chip--active' : ''}`} onClick={() => setFilter(key)}>
              {info.glyph} {info.label} {stats[key] ? `(${stats[key]})` : ''}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" className="av-btn av-btn-ghost" onClick={load} disabled={loading}>{loading ? '…' : '↻ Refresh'}</button>
      </div>

      {!loading && filtered.length === 0 && <div className="av-commands-empty">No flagged users.</div>}

      <div className="av-watchlist-grid">
        {filtered.map((u) => (
          <article key={u.userId} className="av-watchlist-card">
            <header className="av-watchlist-card-head">
              <button type="button" className="av-inbox-userlink av-watchlist-user" onClick={() => openPeek(u.userId)}>
                {u.avatar && <img src={`https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64`} alt="" width={36} height={36} style={{ borderRadius: '50%' }} />}
                <div style={{ textAlign: 'left' }}>
                  <strong>{u.username || u.userId}</strong>
                  <div className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>{u.userId} · {fmt(u.balance)} Lunari</div>
                </div>
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <Link
                  href={`/admin/audit?actions=watchlist_add,watchlist_remove_flag,watchlist_clear&target=${u.userId}`}
                  className="av-btn av-btn-ghost av-btn-sm"
                  title="View flag history for this user in the audit log"
                >
                  History
                </Link>
                <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => clearUser(u.userId, u.flags.length)}>
                  Clear
                </button>
              </div>
            </header>

            <div className="av-watchlist-flags">
              {u.flags.map((f, i) => {
                const info = FLAG_LABELS[f.type] ?? { label: f.type, tone: '#6b7280', glyph: '❓' };
                return (
                  <div key={i} className="av-watchlist-flag" style={{ borderColor: `${info.tone}55` }}>
                    <div className="av-watchlist-flag-head">
                      <span className="av-badges-kind" style={{ background: `${info.tone}22`, color: info.tone }}>
                        {info.glyph} {info.label}
                      </span>
                      <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>
                        {relativeTime(f.addedAt)} · by {f.addedByUsername || f.addedBy.slice(0, 6)}
                      </span>
                      <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => removeFlag(u.userId, i, info.label)}>×</button>
                    </div>
                    {f.reason && <div className="av-watchlist-reason">{f.reason}</div>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
