'use client';

import { useEffect, useState } from 'react';
import { useTimezone } from '../../_components/TimezoneProvider';

interface Source {
  type: string;
  label: string;
  total: number;
  count: number;
}

interface Category {
  key: string;
  label: string;
  color: string;
  glyph: string;
  earned: number;
  spent: number;
  net: number;
  count: number;
  earnedItems: Source[];
  spentItems: Source[];
}

interface Observation {
  lunari: {
    totalEarned: number;
    totalSpent: number;
    net: number;
    totalTransactions: number;
    earnedBy: Source[];
    spentBy: Source[];
    categories: Category[];
  };
  cards: {
    pulled: number;
    lunariEarned: number;
    lunariSpent: number;
    byRarity: { rarity: string; pulled: number; earned: number; spent: number }[];
  };
  stones: {
    chests: number;
    lunariEarned: number;
    lunariSpent: number;
    byTier: { tier: string; chests: number; earned: number; spent: number; count: number }[];
  };
  games: { wins: number; losses: number; played: number; winRate: number | null };
  activity: { firstSeen: string | null; lastActive: string | null };
}

const RARITY_COLOR: Record<string, string> = {
  COMMON:    '#00FF99',
  RARE:      '#0077FF',
  EPIC:      '#B066FF',
  UNIQUE:    '#FF3366',
  LEGENDARY: '#FFD54F',
  SECRET:    '#FFD27F',
  FORBIDDEN: '#EF4444',
  UNKNOWN:   '#6b7280',
};

function fmt(n: number): string { return Math.round(n).toLocaleString('en-US'); }

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="av-obs-bar">
      <span className="av-obs-bar-fill" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}55` }} />
    </div>
  );
}

export default function UserObservation({ discordId }: { discordId: string }) {
  const { fmtRel, absolute } = useTimezone();
  const [data, setData] = useState<Observation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/users/${discordId}/observation`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setError(body?.error ?? `HTTP ${r.status}`); return; }
        setData(body);
        setError(null);
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [discordId]);

  if (loading) {
    return (
      <section className="av-surface av-obs">
        <header className="av-obs-head">
          <h3>Lunari observation</h3>
          <p>Loading full activity breakdown…</p>
        </header>
      </section>
    );
  }

  if (error) {
    return (
      <section className="av-surface av-obs">
        <header className="av-obs-head">
          <h3>Lunari observation</h3>
          <p className="av-obs-error">⚠ {error}</p>
        </header>
      </section>
    );
  }

  if (!data) return null;

  const maxEarn = Math.max(1, ...data.lunari.earnedBy.map((s) => s.total));
  const maxSpend = Math.max(1, ...data.lunari.spentBy.map((s) => s.total));
  const maxRarity = Math.max(1, ...data.cards.byRarity.map((r) => r.pulled));
  const maxTier = Math.max(1, ...data.stones.byTier.map((t) => t.count));

  return (
    <section className="av-surface av-obs">
      <header className="av-obs-head">
        <div>
          <h3>Lunari observation</h3>
          <p>Full economic picture — every source of earnings and every place this user has spent.</p>
        </div>
        <div className="av-obs-meta">
          {data.activity.firstSeen && mounted && (
            <span title={absolute(data.activity.firstSeen)}>First tx {fmtRel(data.activity.firstSeen)}</span>
          )}
          {data.activity.lastActive && mounted && (
            <span title={absolute(data.activity.lastActive)}>Last tx {fmtRel(data.activity.lastActive)}</span>
          )}
          <span>{fmt(data.lunari.totalTransactions)} total transactions</span>
        </div>
      </header>

      <div className="av-obs-totals">
        <div className="av-obs-total av-obs-total--earned">
          <div className="av-obs-total-label">Total earned</div>
          <div className="av-obs-total-value">+{fmt(data.lunari.totalEarned)}</div>
          <div className="av-obs-total-sub">Lunari</div>
        </div>
        <div className="av-obs-total av-obs-total--spent">
          <div className="av-obs-total-label">Total spent</div>
          <div className="av-obs-total-value">−{fmt(data.lunari.totalSpent)}</div>
          <div className="av-obs-total-sub">Lunari</div>
        </div>
        <div className={`av-obs-total av-obs-total--net${data.lunari.net >= 0 ? ' av-obs-total--net-gain' : ' av-obs-total--net-loss'}`}>
          <div className="av-obs-total-label">Net</div>
          <div className="av-obs-total-value">{data.lunari.net >= 0 ? '+' : '−'}{fmt(Math.abs(data.lunari.net))}</div>
          <div className="av-obs-total-sub">Lunari lifetime</div>
        </div>
      </div>

      {data.lunari.categories && data.lunari.categories.length > 0 && (
        <div className="av-obs-categories">
          {data.lunari.categories.map((c) => {
            const total = c.earned + c.spent;
            const earnPct = total > 0 ? (c.earned / total) * 100 : 0;
            const spendPct = total > 0 ? (c.spent / total) * 100 : 0;
            return (
              <article key={c.key} className="av-obs-cat" style={{ ['--cat-c' as any]: c.color }}>
                <header className="av-obs-cat-head">
                  <span className="av-obs-cat-glyph" aria-hidden="true">{c.glyph}</span>
                  <strong>{c.label}</strong>
                  <span className="av-obs-cat-count">{c.count}×</span>
                </header>
                <div className="av-obs-cat-totals">
                  {c.earned > 0 && <span className="av-obs-cat-earn">+{fmt(c.earned)}</span>}
                  {c.spent > 0 && <span className="av-obs-cat-spend">−{fmt(c.spent)}</span>}
                </div>
                <div className="av-obs-cat-bar">
                  {earnPct > 0 && <span className="av-obs-cat-bar-earn" style={{ width: `${earnPct}%` }} />}
                  {spendPct > 0 && <span className="av-obs-cat-bar-spend" style={{ width: `${spendPct}%` }} />}
                </div>
                <details className="av-obs-cat-details">
                  <summary>Breakdown ({c.earnedItems.length + c.spentItems.length} types)</summary>
                  <ul>
                    {c.earnedItems.map((it) => (
                      <li key={`e-${it.type}`}>
                        <span>{it.label}</span>
                        <span className="av-obs-inline-gain">+{fmt(it.total)}</span>
                        <span className="av-obs-cat-item-count">{it.count}×</span>
                      </li>
                    ))}
                    {c.spentItems.map((it) => (
                      <li key={`s-${it.type}`}>
                        <span>{it.label}</span>
                        <span className="av-obs-inline-loss">−{fmt(it.total)}</span>
                        <span className="av-obs-cat-item-count">{it.count}×</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            );
          })}
        </div>
      )}

      <div className="av-obs-cols">
        <div className="av-obs-col">
          <div className="av-obs-col-head av-obs-col-head--gain">Where they earn it</div>
          {data.lunari.earnedBy.length === 0 && (
            <div className="av-obs-empty">No Lunari earned yet.</div>
          )}
          <ul className="av-obs-list">
            {data.lunari.earnedBy.map((s) => (
              <li key={s.type} className="av-obs-row">
                <span className="av-obs-label">{s.label}</span>
                <Bar value={s.total} max={maxEarn} color="var(--av-success)" />
                <span className="av-obs-amount av-obs-amount--gain">+{fmt(s.total)}</span>
                <span className="av-obs-count">{fmt(s.count)}×</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="av-obs-col">
          <div className="av-obs-col-head av-obs-col-head--loss">Where they spend it</div>
          {data.lunari.spentBy.length === 0 && (
            <div className="av-obs-empty">No Lunari spent yet.</div>
          )}
          <ul className="av-obs-list">
            {data.lunari.spentBy.map((s) => (
              <li key={s.type} className="av-obs-row">
                <span className="av-obs-label">{s.label}</span>
                <Bar value={s.total} max={maxSpend} color="var(--av-danger)" />
                <span className="av-obs-amount av-obs-amount--loss">−{fmt(s.total)}</span>
                <span className="av-obs-count">{fmt(s.count)}×</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(data.cards.pulled > 0 || data.cards.byRarity.length > 0) && (
        <div className="av-obs-section">
          <div className="av-obs-section-head">
            <h4>Cards</h4>
            <span className="av-obs-section-sub">
              {fmt(data.cards.pulled)} pulled · spent {fmt(data.cards.lunariSpent)} Lunari · earned {fmt(data.cards.lunariEarned)} from sales
            </span>
          </div>
          <ul className="av-obs-list">
            {data.cards.byRarity.map((r) => (
              <li key={r.rarity} className="av-obs-row">
                <span className="av-obs-rarity" style={{ color: RARITY_COLOR[r.rarity] ?? RARITY_COLOR.UNKNOWN }}>{r.rarity}</span>
                <Bar value={r.pulled} max={maxRarity} color={RARITY_COLOR[r.rarity] ?? RARITY_COLOR.UNKNOWN} />
                <span className="av-obs-amount">{fmt(r.pulled)} cards</span>
                <span className="av-obs-count">
                  {r.spent > 0 && <span className="av-obs-inline-loss">−{fmt(r.spent)}</span>}
                  {r.earned > 0 && <span className="av-obs-inline-gain">+{fmt(r.earned)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(data.stones.chests > 0 || data.stones.byTier.length > 0) && (
        <div className="av-obs-section">
          <div className="av-obs-section-head">
            <h4>Stones</h4>
            <span className="av-obs-section-sub">
              {fmt(data.stones.chests)} chests opened · spent {fmt(data.stones.lunariSpent)} · earned {fmt(data.stones.lunariEarned)}
            </span>
          </div>
          <ul className="av-obs-list">
            {data.stones.byTier.map((t) => (
              <li key={t.tier} className="av-obs-row">
                <span className="av-obs-rarity" style={{ color: '#ff3366' }}>{t.tier}</span>
                <Bar value={t.count} max={maxTier} color="#ff3366" />
                <span className="av-obs-amount">{fmt(t.count)} events</span>
                <span className="av-obs-count">
                  {t.spent > 0 && <span className="av-obs-inline-loss">−{fmt(t.spent)}</span>}
                  {t.earned > 0 && <span className="av-obs-inline-gain">+{fmt(t.earned)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.games.played > 0 && (
        <div className="av-obs-section">
          <div className="av-obs-section-head">
            <h4>Games</h4>
            <span className="av-obs-section-sub">
              {fmt(data.games.played)} played · win rate {data.games.winRate ?? 0}%
            </span>
          </div>
          <div className="av-obs-games">
            <div className="av-obs-game-stat av-obs-game-stat--win">
              <span className="av-obs-game-label">Wins</span>
              <span className="av-obs-game-value">{fmt(data.games.wins)}</span>
            </div>
            <div className="av-obs-game-stat av-obs-game-stat--loss">
              <span className="av-obs-game-label">Losses</span>
              <span className="av-obs-game-value">{fmt(data.games.losses)}</span>
            </div>
            <div className="av-obs-game-bar">
              <span className="av-obs-game-bar-win" style={{ width: `${data.games.played > 0 ? (data.games.wins / data.games.played) * 100 : 0}%` }} />
              <span className="av-obs-game-bar-loss" style={{ width: `${data.games.played > 0 ? (data.games.losses / data.games.played) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
