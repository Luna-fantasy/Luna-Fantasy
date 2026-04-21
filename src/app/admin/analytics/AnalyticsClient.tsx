'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePeek } from '../_components/PeekProvider';

type Tab = 'banking' | 'games' | 'chat' | 'collections' | 'shops';

const TABS: { id: Tab; label: string }[] = [
  { id: 'banking', label: 'Banking' },
  { id: 'games', label: 'Games' },
  { id: 'chat', label: 'Chat & Voice' },
  { id: 'collections', label: 'Cards & Stones' },
  { id: 'shops', label: 'Shops' },
];

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtVoice(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: '#00FF99', RARE: '#0077FF', EPIC: '#B066FF',
  UNIQUE: '#FF3366', LEGENDARY: '#FFD54F', SECRET: '#FFD27F',
  FORBIDDEN: '#FF0044',
};

const SHOP_LABELS: Record<string, string> = {
  mells_purchase: 'Mells Selvair', brimor_purchase: 'Brimor', shop_purchase: 'General Shop',
  seluna_purchase: 'Seluna', meluna_purchase: 'Meluna', card_purchase: 'Luckboxes',
  ticket_purchase: 'Ticket Shop', luckbox_spend: 'Luckbox (legacy)', stonebox_spend: 'Stonebox',
  ticket_spend: 'Tickets (legacy)',
};

function UserChip({ userId, username, avatar, onClick }: { userId: string; username?: string; avatar?: string; onClick: () => void }) {
  const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=32` : null;
  return (
    <button type="button" className="av-inbox-userlink" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {avatarUrl && <img src={avatarUrl} alt="" width={20} height={20} style={{ borderRadius: '50%' }} />}
      {username || userId}
    </button>
  );
}

export default function AnalyticsClient() {
  const toast = useToast();
  const { openPeek } = usePeek();
  const [tab, setTab] = useState<Tab>('banking');
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async (section: Tab) => {
    if (data[section] || loading[section]) return;
    setLoading((p) => ({ ...p, [section]: true }));
    try {
      const res = await fetch(`/api/admin/analytics/${section}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setData((p) => ({ ...p, [section]: body }));
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading((p) => ({ ...p, [section]: false }));
    }
  }, [data, loading, toast]);

  useEffect(() => { void load(tab); }, [tab]);

  const refresh = () => {
    setData((p) => { const next = { ...p }; delete next[tab]; return next; });
    setTimeout(() => load(tab), 50);
  };

  const isLoading = loading[tab] && !data[tab];

  return (
    <div className="av-voice">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Analytics section">
        {TABS.map((t) => (
          <button
            key={t.id} type="button" role="tab"
            aria-selected={tab === t.id}
            className={`av-inbox-chip${tab === t.id ? ' av-inbox-chip--active' : ''}`}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </nav>

      <div className="av-commands-controls" style={{ marginBottom: 12 }}>
        <button type="button" className="av-btn av-btn-ghost" onClick={refresh} disabled={isLoading}>
          {isLoading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {isLoading && <div className="av-commands-empty">Loading analytics…</div>}

      {tab === 'banking' && data.banking && <BankingPanel data={data.banking} onPeek={openPeek} />}
      {tab === 'games' && data.games && <GamesPanel data={data.games} onPeek={openPeek} />}
      {tab === 'chat' && data.chat && <ChatPanel data={data.chat} onPeek={openPeek} />}
      {tab === 'collections' && data.collections && <CollectionsPanel data={data.collections} />}
      {tab === 'shops' && data.shops && <ShopsPanel data={data.shops} onPeek={openPeek} />}
    </div>
  );
}

// ─── Banking Panel ───

function BankingPanel({ data, onPeek }: { data: any; onPeek: (id: string) => void }) {
  return (
    <section className="av-voice-panel">
      <div className="av-voice-stat-summary">
        <div><strong>{fmt(data.reserve)}</strong><span>Bank Reserve</span></div>
        <div><strong>{data.activeLoans.count}</strong><span>Active Loans</span></div>
        <div><strong>{fmt(data.activeLoans.totalAmount)}</strong><span>Loaned Out</span></div>
        <div><strong>{data.overdueLoans.count}</strong><span>Overdue</span></div>
      </div>
      <div className="av-voice-stat-summary">
        <div><strong>{data.investments.count}</strong><span>Active Investments</span></div>
        <div><strong>{fmt(data.investments.totalAmount)}</strong><span>Invested</span></div>
        <div><strong>{data.debt.count}</strong><span>In Debt</span></div>
        <div><strong>{fmt(data.debt.totalAmount)}</strong><span>Total Debt</span></div>
      </div>

      {data.recentLoans?.length > 0 && (
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Recent active loans</h4></header>
          <div className="av-analytics-table">
            <div className="av-analytics-table-head">
              <span>User</span><span>Amount</span><span>Repayment</span><span>Due</span>
            </div>
            {data.recentLoans.map((r: any, i: number) => {
              const overdue = r.loan.dueDate < Date.now();
              return (
                <div key={i} className={`av-analytics-table-row${overdue ? ' av-analytics-row--warn' : ''}`}>
                  <UserChip userId={r.userId} username={r.username} onClick={() => onPeek(r.userId)} />
                  <span>{fmt(r.loan.amount)}</span>
                  <span>{fmt(r.loan.repaymentAmount)}</span>
                  <span className={overdue ? 'av-text-loss' : ''}>{overdue ? 'OVERDUE' : new Date(r.loan.dueDate).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </article>
      )}
    </section>
  );
}

// ─── Games Panel ───

function GamesPanel({ data, onPeek }: { data: any; onPeek: (id: string) => void }) {
  const totals = data.totalsByGame;
  const totalAllGames = (totals.luna_fantasy || 0) + (totals.grand_fantasy || 0) + (totals.faction_war || 0);

  return (
    <section className="av-voice-panel">
      <div className="av-voice-stat-summary">
        <div><strong>{fmt(totalAllGames)}</strong><span>Total Game Wins</span></div>
        <div><strong>{fmt(totals.luna_fantasy || 0)}</strong><span>Luna Fantasy</span></div>
        <div><strong>{fmt(totals.grand_fantasy || 0)}</strong><span>Grand Fantasy</span></div>
        <div><strong>{fmt(totals.faction_war || 0)}</strong><span>Faction War</span></div>
      </div>

      <div className="av-commands-row-grid">
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Top players</h4></header>
          <div className="av-voice-hall-list">
            {(data.topPlayers ?? []).map((p: any, i: number) => (
              <div key={i} className="av-voice-hall-row">
                <span>#{i + 1}</span>
                <UserChip userId={p.userId} username={p.username} avatar={p.avatar} onClick={() => onPeek(p.userId)} />
                <strong>{p.totalWins} wins</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Top nemesis rivalries</h4></header>
          <div className="av-voice-hall-list">
            {(data.nemesisRankings ?? []).map((n: any, i: number) => (
              <div key={i} className="av-voice-hall-row" style={{ gap: 8 }}>
                <span>#{i + 1}</span>
                <span style={{ flex: 1 }}>
                  <UserChip userId={n.user1.id} username={n.user1.username} onClick={() => onPeek(n.user1.id)} />
                  <span className="av-text-gain"> {n.user1.wins}</span>
                  <span style={{ margin: '0 4px', opacity: 0.4 }}>vs</span>
                  <span className="av-text-loss">{n.user2.wins} </span>
                  <UserChip userId={n.user2.id} username={n.user2.username} onClick={() => onPeek(n.user2.id)} />
                </span>
                <span>{n.totalGames} games</span>
              </div>
            ))}
            {(data.nemesisRankings ?? []).length === 0 && <div className="av-commands-empty">No rivalries recorded yet.</div>}
          </div>
        </article>
      </div>

      {(data.revenueByType ?? []).length > 0 && (
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Transaction volume by game type</h4></header>
          <div className="av-analytics-bar-list">
            {data.revenueByType.map((r: any) => (
              <div key={r._id} className="av-analytics-bar-row">
                <span className="av-analytics-bar-label">{r._id}</span>
                <div className="av-analytics-bar-track">
                  <div className="av-analytics-bar-fill" style={{ width: `${Math.min(100, (r.count / (data.revenueByType[0]?.count || 1)) * 100)}%` }} />
                </div>
                <span className="av-analytics-bar-value">{fmt(r.count)} txns · {fmt(r.total)} L</span>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}

// ─── Chat & Voice Panel ───

function ChatPanel({ data, onPeek }: { data: any; onPeek: (id: string) => void }) {
  const daily = data.dailyMessages ?? [];
  const maxMsg = Math.max(...daily.map((d: any) => d.count), 1);

  return (
    <section className="av-voice-panel">
      <div className="av-voice-stat-summary">
        <div><strong>{fmt(data.totalMessages30d)}</strong><span>Messages (30d)</span></div>
        <div><strong>{daily.length > 0 ? fmt(Math.round(data.totalMessages30d / daily.length)) : 0}</strong><span>Daily average</span></div>
        <div><strong>{fmt(Math.max(...daily.map((d: any) => d.count), 0))}</strong><span>Peak day</span></div>
      </div>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Daily messages (30 days)</h4></header>
        <div className="av-analytics-chart">
          {daily.map((d: any) => (
            <div key={d.date} className="av-analytics-chart-bar" title={`${d.date}: ${fmt(d.count)} messages`}>
              <div className="av-analytics-chart-fill" style={{ height: `${(d.count / maxMsg) * 100}%` }} />
              <span className="av-analytics-chart-label">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </article>

      <div className="av-commands-row-grid">
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Top chatters (all time)</h4></header>
          <div className="av-voice-hall-list">
            {(data.topChatters ?? []).map((u: any, i: number) => (
              <div key={i} className="av-voice-hall-row">
                <span>#{i + 1}</span>
                <UserChip userId={u.userId} username={u.username} avatar={u.avatar} onClick={() => onPeek(u.userId)} />
                <strong>{fmt(u.messages)} msgs</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Voice leaders (all time)</h4></header>
          <div className="av-voice-hall-list">
            {(data.voiceLeaders ?? []).map((u: any, i: number) => (
              <div key={i} className="av-voice-hall-row">
                <span>#{i + 1}</span>
                <UserChip userId={u.userId} username={u.username} avatar={u.avatar} onClick={() => onPeek(u.userId)} />
                <strong>{fmtVoice(u.voiceTime)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

// ─── Collections Panel ───

function CollectionsPanel({ data }: { data: any }) {
  const cards = data.cards;
  const stones = data.stones;

  return (
    <section className="av-voice-panel">
      <div className="av-voice-stat-summary">
        <div><strong>{fmt(cards.totalOwned)}</strong><span>Total Cards</span></div>
        <div><strong>{cards.totalHolders}</strong><span>Card Holders</span></div>
        <div><strong>{fmt(stones.totalOwned)}</strong><span>Total Stones</span></div>
        <div><strong>{stones.totalHolders}</strong><span>Stone Holders</span></div>
      </div>

      <div className="av-commands-row-grid">
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Cards by rarity</h4></header>
          <div className="av-analytics-bar-list">
            {(cards.byRarity ?? []).map((r: any) => (
              <div key={r._id} className="av-analytics-bar-row">
                <span className="av-analytics-bar-label" style={{ color: RARITY_COLORS[r._id] || '#6b7280' }}>{r._id}</span>
                <div className="av-analytics-bar-track">
                  <div className="av-analytics-bar-fill" style={{ width: `${(r.count / (cards.totalOwned || 1)) * 100}%`, background: RARITY_COLORS[r._id] || 'var(--accent-primary)' }} />
                </div>
                <span className="av-analytics-bar-value">{fmt(r.count)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Stones by type</h4></header>
          <div className="av-analytics-bar-list">
            {(stones.byName ?? []).map((s: any) => (
              <div key={s._id} className="av-analytics-bar-row">
                <span className="av-analytics-bar-label">{s._id}</span>
                <div className="av-analytics-bar-track">
                  <div className="av-analytics-bar-fill" style={{ width: `${(s.count / (stones.totalOwned || 1)) * 100}%` }} />
                </div>
                <span className="av-analytics-bar-value">{fmt(s.count)}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="av-commands-row-grid">
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Rarest cards (fewest copies)</h4></header>
          <div className="av-voice-hall-list">
            {(cards.rarest ?? []).map((c: any, i: number) => (
              <div key={i} className="av-voice-hall-row">
                <span>#{i + 1}</span>
                <strong style={{ color: RARITY_COLORS[c.rarity] }}>{c._id}</strong>
                <span>{c.count} {c.count === 1 ? 'copy' : 'copies'}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Most common cards</h4></header>
          <div className="av-voice-hall-list">
            {(cards.mostCommon ?? []).map((c: any, i: number) => (
              <div key={i} className="av-voice-hall-row">
                <span>#{i + 1}</span>
                <strong style={{ color: RARITY_COLORS[c.rarity] }}>{c._id}</strong>
                <span>{fmt(c.count)} copies</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

// ─── Shops Panel ───

function ShopsPanel({ data, onPeek }: { data: any; onPeek: (id: string) => void }) {
  const daily = data.dailyRevenue ?? [];
  const maxRev = Math.max(...daily.map((d: any) => d.total), 1);

  return (
    <section className="av-voice-panel">
      <div className="av-voice-stat-summary">
        <div><strong>{fmt(data.totalRevenue)}</strong><span>Total Shop Revenue</span></div>
        <div><strong>{fmt(data.totalPurchases)}</strong><span>Total Purchases</span></div>
      </div>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Revenue by vendor</h4></header>
        <div className="av-analytics-bar-list">
          {(data.revenueByType ?? []).map((r: any) => (
            <div key={r._id} className="av-analytics-bar-row">
              <span className="av-analytics-bar-label">{SHOP_LABELS[r._id] || r._id}</span>
              <div className="av-analytics-bar-track">
                <div className="av-analytics-bar-fill" style={{ width: `${(r.totalSpent / (data.revenueByType[0]?.totalSpent || 1)) * 100}%` }} />
              </div>
              <span className="av-analytics-bar-value">{fmt(r.totalSpent)} L · {fmt(r.count)} purchases</span>
            </div>
          ))}
        </div>
      </article>

      {daily.length > 0 && (
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Daily shop revenue (30 days)</h4></header>
          <div className="av-analytics-chart">
            {daily.map((d: any) => (
              <div key={d._id} className="av-analytics-chart-bar" title={`${d._id}: ${fmt(d.total)} L (${d.count} purchases)`}>
                <div className="av-analytics-chart-fill" style={{ height: `${(d.total / maxRev) * 100}%` }} />
                <span className="av-analytics-chart-label">{d._id.slice(8)}</span>
              </div>
            ))}
          </div>
        </article>
      )}

      {(data.topSpenders ?? []).length > 0 && (
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Top shop spenders</h4></header>
          <div className="av-voice-hall-list">
            {data.topSpenders.map((s: any, i: number) => (
              <div key={i} className="av-voice-hall-row">
                <span>#{i + 1}</span>
                <UserChip userId={s.userId} username={s.username} avatar={s.avatar} onClick={() => onPeek(s.userId)} />
                <strong>{fmt(s.totalSpent)} L · {s.purchases} purchases</strong>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
