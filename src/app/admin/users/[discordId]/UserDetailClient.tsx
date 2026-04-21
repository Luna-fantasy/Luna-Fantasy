'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '../../_components/Toast';
import { useUndo } from '../../_components/UndoProvider';
import { usePendingAction } from '../../_components/PendingActionProvider';
import { useTimezone } from '../../_components/TimezoneProvider';
import { trackRecent } from '../../_components/RecentlyViewed';
import ActivityHeatmap from './ActivityHeatmap';
import UserObservation from './UserObservation';
import InlineEdit from '../../_components/InlineEdit';
import Skeleton from '../../_components/Skeleton';
import Icon from '../../_components/Icon';
import ModeratorConsole from './ModeratorConsole';
import UserCooldowns from './UserCooldowns';

interface Rank {
  id: string;
  title: string;
  tier: number;
  tone: string;
  tone2: string | null;
  glyph: string;
}

interface PeekData {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  balance: number;
  level: number;
  xp: number;
  passport: {
    number?: string;
    fullName?: string;
    faction?: string;
    staffRole?: string;
  } | null;
  counts: { cards: number; stones: number; tickets: number };
  recentAudit: Array<{ id: string; action: string; admin: string; amount?: number; reason?: string; timestamp: string }>;
  recentLunari: Array<{ id: string; type: string; amount: number; after: number; timestamp: string }>;
  rank: Rank;
}

function fmt(n: number): string { return n.toLocaleString('en-US'); }

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  if (!res.ok) throw new Error('CSRF fetch failed');
  const data = await res.json();
  return data.token;
}

async function changeBalance(discordId: string, amount: number, reason: string): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/users/${discordId}/balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ amount, reason }),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function UserDetailClient({ discordId }: { discordId: string }) {
  const [data, setData] = useState<PeekData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const { fmtRel, absolute } = useTimezone();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/peek/${discordId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 404 ? 'User not found' : `HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
      setError(null);
      trackRecent({
        kind: 'user',
        id: d.discordId,
        label: d.globalName || d.username || d.discordId,
        href: `/admin/users/${d.discordId}`,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [discordId]);

  useEffect(() => { refresh(); }, [refresh]);

  const credit = async (amount: number) => {
    if (!data) return;
    const label = `${amount > 0 ? 'Credit' : 'Debit'} ${fmt(Math.abs(amount))} Lunari`;
    const prevBalance = data.balance;
    const ok = await pending.queue({
      label,
      detail: `${data.globalName ?? data.discordId} · ${amount > 0 ? '+' : '−'}${fmt(Math.abs(amount))}`,
      delayMs: 5000,
      tone: amount < 0 ? 'danger' : 'default',
      run: async () => {
        try {
          await changeBalance(discordId, amount, 'v2-admin-panel');
          await refresh();
          // Register an undo
          undo.push({
            label,
            detail: `${data.globalName ?? discordId}`,
            revert: async () => {
              await changeBalance(discordId, -amount, 'undo:v2-admin-panel');
              await refresh();
              toast.show({ tone: 'success', title: 'Reverted', message: label });
            },
          });
          toast.show({ tone: 'success', title: 'Applied', message: label });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Failed', message: (e as Error).message });
        }
      },
    });
    if (!ok) return;
  };

  const saveBalance = async (next: number) => {
    if (!data) return;
    const delta = next - data.balance;
    if (delta === 0) return;
    const prevBalance = data.balance;
    try {
      await changeBalance(discordId, delta, 'inline-edit');
      await refresh();
      undo.push({
        label: `Balance ${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`,
        detail: `${data.globalName ?? discordId}`,
        revert: async () => {
          await changeBalance(discordId, -delta, 'undo:inline-edit');
          await refresh();
          toast.show({ tone: 'success', title: 'Reverted', message: 'Balance change undone' });
        },
      });
    } catch (e) {
      throw e;
    }
  };

  if (loading) return <Skeleton variant="card" height={300} />;
  if (error) return <div className="av-health-error"><span className="av-health-dot av-health-dot--err" /><div><strong>Failed to load</strong><small>{error}</small></div></div>;
  if (!data) return null;

  const factionGlyph = (f?: string): string => {
    const map: Record<string, string> = { lunarians: '☾', sentinel: '⚔', mastermind: '◈', underworld: '✦', siren: '◐', seer: '✧' };
    return map[(f ?? '').toLowerCase()] ?? '◯';
  };

  const rank = data.rank;
  const rankStyle = {
    ['--rank-tone' as any]: rank.tone,
    ['--rank-tone-2' as any]: rank.tone2 ?? rank.tone,
  };

  return (
    <div className="av-udet" style={rankStyle}>
      <section className={`av-surface av-udet-hero av-rank-${rank.id}`}>
        <div className="av-udet-hero-head">
          <div
            className="av-peek-avatar av-udet-avatar av-vt-avatar"
            style={{
              ['--vt-name' as any]: `av-${discordId}`,
              borderColor: `color-mix(in srgb, ${rank.tone} 65%, transparent)`,
            }}
          >
            {data.image
              ? <img src={data.image} alt="" />
              : <span>{(data.globalName ?? data.username ?? '?').slice(0, 1).toUpperCase()}</span>}
            {data.passport?.staffRole && (
              <span className={`av-peek-badge av-peek-badge-${data.passport.staffRole.toLowerCase()}`}>
                {data.passport.staffRole.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="av-udet-ident">
            <div className="av-udet-rank">
              <span className="av-udet-rank-glyph" aria-hidden="true">{rank.glyph}</span>
              <span>{rank.title}</span>
            </div>
            <h1>{data.globalName ?? data.username ?? 'Unknown'}</h1>
            {data.username && data.username !== data.globalName && <p className="av-peek-handle">@{data.username}</p>}
            <p className="av-peek-id">
              <code>{data.discordId}</code>
              <button type="button" className="av-peek-copy" onClick={() => navigator.clipboard?.writeText(data.discordId)}>⧉</button>
            </p>
          </div>
          <div className="av-udet-actions">
            <Link href={`/admin/audit?targetDiscordId=${data.discordId}`} className="av-btn av-btn-ghost">
              <Icon name="audit" size={12} /> Audit trail
            </Link>
          </div>
        </div>

        <div className="av-udet-stats">
          <div className="av-udet-stat">
            <div className="av-udet-stat-label">
              <span className="av-udet-stat-icon"><Icon name="coins" size={12} /></span>
              Lunari
            </div>
            <InlineEdit
              initial={data.balance}
              type="number"
              format={(v) => fmt(Number(v))}
              onSave={async (next) => saveBalance(Number(next))}
              aria-label="Edit Lunari balance"
            />
            <span className="av-udet-stat-sub">click to edit</span>
          </div>
          <div className="av-udet-stat">
            <div className="av-udet-stat-label">
              <span className="av-udet-stat-icon"><Icon name="trending" size={12} /></span>
              Level
            </div>
            <span className="av-udet-stat-value">{data.level}</span>
            <span className="av-udet-stat-sub">{fmt(data.xp)} XP</span>
          </div>
          <div className="av-udet-stat">
            <div className="av-udet-stat-label">
              <span className="av-udet-stat-icon"><Icon name="cards" size={12} /></span>
              Cards
            </div>
            <span className="av-udet-stat-value">{fmt(data.counts.cards)}</span>
          </div>
          <div className="av-udet-stat">
            <div className="av-udet-stat-label">
              <span className="av-udet-stat-icon"><Icon name="gem" size={12} /></span>
              Stones
            </div>
            <span className="av-udet-stat-value">{fmt(data.counts.stones)}</span>
          </div>
          <div className="av-udet-stat">
            <div className="av-udet-stat-label">
              <span className="av-udet-stat-icon"><Icon name="ticket" size={12} /></span>
              Tickets
            </div>
            <span className="av-udet-stat-value">{fmt(data.counts.tickets)}</span>
          </div>
        </div>

        {data.passport && (
          <div className="av-peek-passport" style={{ marginTop: 14 }}>
            <span className="av-peek-passport-glyph">{factionGlyph(data.passport.faction)}</span>
            <div style={{ flex: 1 }}>
              <div className="av-peek-passport-num">{data.passport.number ?? '—'}</div>
              {data.passport.fullName && <div className="av-peek-passport-name">{data.passport.fullName}</div>}
              {data.passport.faction && <div className="av-peek-passport-faction">{data.passport.faction}</div>}
            </div>
          </div>
        )}
      </section>

      <ModeratorConsole
        discordId={discordId}
        displayName={data.globalName ?? data.username ?? data.discordId}
        current={{ balance: data.balance, level: data.level, tickets: data.counts.tickets }}
        onMutated={refresh}
      />

      <UserCooldowns discordId={discordId} />

      <UserObservation discordId={discordId} />

      <section className="av-surface">
        <header className="av-flows-head">
          <div>
            <h3>Activity · last 365 days</h3>
            <p>Daily count of transactions, card pulls, stone chests, and admin actions targeting this user.</p>
          </div>
        </header>
        <ActivityHeatmap discordId={discordId} />
      </section>

      <div className="av-grid-2">
        <section className="av-surface">
          <header className="av-flows-head"><div><h3>Recent admin actions</h3></div></header>
          {data.recentAudit.length === 0 ? (
            <div className="av-flows-empty">No admin actions on this user yet.</div>
          ) : (
            <ul className="av-peek-feed">
              {data.recentAudit.map((a) => (
                <li key={a.id}>
                  <span className="av-peek-feed-tag">{a.action}</span>
                  <span className="av-peek-feed-by">by {a.admin}</span>
                  {typeof a.amount === 'number' && <span className="av-peek-feed-amt">{fmt(a.amount)}</span>}
                  <span className="av-peek-feed-time" title={absolute(a.timestamp)}>{fmtRel(a.timestamp)}</span>
                  {a.reason && <div className="av-peek-feed-reason">{a.reason}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="av-surface">
          <header className="av-flows-head"><div><h3>Recent Lunari flow</h3></div></header>
          {data.recentLunari.length === 0 ? (
            <div className="av-flows-empty">No transactions recorded.</div>
          ) : (
            <ul className="av-peek-feed">
              {data.recentLunari.map((t) => (
                <li key={t.id}>
                  <span className="av-peek-feed-tag">{t.type}</span>
                  <span className={`av-peek-feed-amt ${t.amount >= 0 ? 'av-peek-feed-pos' : 'av-peek-feed-neg'}`}>
                    {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                  </span>
                  <span className="av-peek-feed-after">→ {fmt(t.after)}</span>
                  <span className="av-peek-feed-time" title={absolute(t.timestamp)}>{fmtRel(t.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
