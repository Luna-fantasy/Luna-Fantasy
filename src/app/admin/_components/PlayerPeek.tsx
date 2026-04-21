'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePeek } from './PeekProvider';
import { trackRecent } from './RecentlyViewed';
import { useTimezone } from './TimezoneProvider';

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
  recentAudit: Array<{
    id: string;
    action: string;
    admin: string;
    amount?: number;
    reason?: string;
    timestamp: string;
  }>;
  recentLunari: Array<{
    id: string;
    type: string;
    amount: number;
    after: number;
    timestamp: string;
  }>;
}

function fmt(n: number): string { return n.toLocaleString('en-US'); }

export default function PlayerPeek() {
  const { userId, closePeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<PeekData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on Esc
  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePeek(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userId, closePeek]);

  // Fetch on open
  useEffect(() => {
    if (!userId) { setData(null); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/peek/${encodeURIComponent(userId)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'User not found' : `HTTP ${r.status}`);
        return r.json() as Promise<PeekData>;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        trackRecent({
          kind: 'user',
          id: d.discordId,
          label: d.globalName || d.username || d.discordId,
          href: `/admin/users/${d.discordId}`,
        });
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [userId]);

  if (!mounted || !userId) return null;

  const factionGlyph = (faction?: string): string => {
    const map: Record<string, string> = {
      lunarians: '☾', sentinel: '⚔', mastermind: '◈',
      underworld: '✦', siren: '◐', seer: '✧',
      wizard: '◇', thief: '▼', knight: '▲', guardian: '■',
    };
    return map[(faction ?? '').toLowerCase()] ?? '◯';
  };

  const portal = (
    <>
      <div className="av-peek-scrim" onClick={closePeek} aria-hidden="true" />
      <aside className="av-peek" role="dialog" aria-modal="true" aria-label="Player peek">
        <header className="av-peek-head">
          <button type="button" className="av-peek-close" onClick={closePeek} aria-label="Close">×</button>
          {loading && <div className="av-peek-skeleton">Loading…</div>}
          {error && <div className="av-peek-error">⚠ {error}</div>}
          {data && (
            <>
              <div className="av-peek-avatar">
                {data.image && data.image.startsWith('https://') ? <img src={data.image} alt="" /> : <span>{(data.globalName ?? data.username ?? '?').slice(0, 1).toUpperCase()}</span>}
                {data.passport?.staffRole && (
                  <span className={`av-peek-badge av-peek-badge-${data.passport.staffRole.toLowerCase()}`} title={data.passport.staffRole}>
                    {data.passport.staffRole.slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="av-peek-ident">
                <h2>{data.globalName || data.username || 'Unknown'}</h2>
                {data.username && data.username !== data.globalName && <p className="av-peek-handle">@{data.username}</p>}
                <p className="av-peek-id">
                  <code>{data.discordId}</code>
                  <button type="button" className="av-peek-copy" onClick={() => navigator.clipboard?.writeText(data.discordId)} title="Copy ID">⧉</button>
                </p>
              </div>
            </>
          )}
        </header>

        {data && (
          <>
            <div className="av-peek-stats">
              <div className="av-peek-stat">
                <span>Lunari</span>
                <strong>{fmt(data.balance)}</strong>
              </div>
              <div className="av-peek-stat">
                <span>Level</span>
                <strong>{data.level}</strong>
                <small>{fmt(data.xp)} XP</small>
              </div>
              <div className="av-peek-stat">
                <span>Cards</span>
                <strong>{fmt(data.counts.cards)}</strong>
              </div>
              <div className="av-peek-stat">
                <span>Stones</span>
                <strong>{fmt(data.counts.stones)}</strong>
              </div>
              <div className="av-peek-stat">
                <span>Tickets</span>
                <strong>{fmt(data.counts.tickets)}</strong>
              </div>
            </div>

            {data.passport && (
              <section className="av-peek-section">
                <h3>Passport</h3>
                <div className="av-peek-passport">
                  <span className="av-peek-passport-glyph">{factionGlyph(data.passport.faction)}</span>
                  <div>
                    <div className="av-peek-passport-num">{data.passport.number ?? '—'}</div>
                    {data.passport.fullName && <div className="av-peek-passport-name">{data.passport.fullName}</div>}
                    {data.passport.faction && <div className="av-peek-passport-faction">{data.passport.faction}</div>}
                  </div>
                </div>
              </section>
            )}

            {data.recentAudit.length > 0 && (
              <section className="av-peek-section">
                <h3>Recent admin actions</h3>
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
              </section>
            )}

            {data.recentLunari.length > 0 && (
              <section className="av-peek-section">
                <h3>Recent Lunari flow</h3>
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
              </section>
            )}

            <footer className="av-peek-foot">
              <Link href={`/admin/users/${data.discordId}`} className="av-btn av-btn-primary" onClick={closePeek}>
                Full profile →
              </Link>
              <Link href={`/admin/audit?targetDiscordId=${data.discordId}`} className="av-btn av-btn-ghost" onClick={closePeek}>
                Audit trail
              </Link>
            </footer>
          </>
        )}
      </aside>
    </>
  );

  return createPortal(portal, document.body);
}
