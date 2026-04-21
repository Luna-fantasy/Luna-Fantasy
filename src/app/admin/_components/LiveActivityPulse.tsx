'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePeek } from './PeekProvider';
import { useTimezone } from './TimezoneProvider';

interface PulseEvent {
  id: string;
  kind: 'audit' | 'lunari' | 'card' | 'stone';
  action: string;
  actor?: string;
  target?: string;
  targetName?: string;
  targetAvatar?: string | null;
  amount?: number;
  timestamp: string;
}

const KIND_META: Record<PulseEvent['kind'], { label: string; color: string; glyph: string }> = {
  audit:  { label: 'Admin',  color: 'var(--accent-legendary, #fbbf24)', glyph: '⚙' },
  lunari: { label: 'Lunari', color: 'var(--accent-primary)',            glyph: '◈' },
  card:   { label: 'Card',   color: '#b066ff',                          glyph: '◆' },
  stone:  { label: 'Stone',  color: '#ff3366',                          glyph: '◉' },
};

// Human-friendly action labels + amount polarity
// tone: 'gain' (green) or 'loss' (red) tints the amount
const ACTION_META: Record<string, { label: string; tone: 'gain' | 'loss' | 'neutral' }> = {
  // Lunari
  lunari_added:       { label: 'Lunari added',        tone: 'gain' },
  lunari_spent:       { label: 'Lunari spent',        tone: 'loss' },
  daily_reward:       { label: 'Daily reward',        tone: 'gain' },
  investor_bonus:     { label: 'Investor bonus',      tone: 'gain' },
  vip_bonus:          { label: 'Investor bonus',      tone: 'gain' },
  passport_bonus:     { label: 'Passport bonus',      tone: 'gain' },
  trade_win:          { label: 'Trade win',           tone: 'gain' },
  trade_loss:         { label: 'Trade loss',          tone: 'loss' },
  shop_purchase:      { label: 'Shop purchase',       tone: 'loss' },
  transfer_in:        { label: 'Transfer received',   tone: 'gain' },
  transfer_out:       { label: 'Transfer sent',       tone: 'loss' },
  loan_taken:         { label: 'Loan taken',          tone: 'gain' },
  loan_repaid:        { label: 'Loan repaid',         tone: 'loss' },
  game_win:           { label: 'Game win',            tone: 'gain' },
  game_loss:          { label: 'Game loss',           tone: 'loss' },
  // Cards
  card_pull:          { label: 'Card pulled',         tone: 'gain' },
  card_sell:          { label: 'Card sold',           tone: 'gain' },
  card_gift:          { label: 'Card gifted',         tone: 'neutral' },
  card_swap:          { label: 'Card swapped',        tone: 'neutral' },
  card_auction_win:   { label: 'Card auction won',    tone: 'gain' },
  luckbox:            { label: 'Luckbox',             tone: 'neutral' },
  // Stones
  stone_chest:        { label: 'Stone chest',         tone: 'gain' },
  stone_gift:         { label: 'Stone gifted',        tone: 'neutral' },
  stone_sell:         { label: 'Stone sold',          tone: 'gain' },
  stone_auction_win:  { label: 'Stone auction won',   tone: 'gain' },
  stone_swap:         { label: 'Stone swapped',       tone: 'neutral' },
};

function humanizeAction(action: string): { label: string; tone: 'gain' | 'loss' | 'neutral' } {
  const meta = ACTION_META[action];
  if (meta) return meta;
  const label = action
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label, tone: 'neutral' };
}

function formatAmount(n: number, tone: 'gain' | 'loss' | 'neutral'): { text: string; cls: string } {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : tone === 'gain' ? '+' : tone === 'loss' ? '−' : '';
  const cls = n < 0 || tone === 'loss' ? 'av-pulse-amt--loss' : tone === 'gain' ? 'av-pulse-amt--gain' : 'av-pulse-amt--neutral';
  return { text: `${sign}${abs.toLocaleString()}`, cls };
}

function Initials({ name, target }: { name?: string; target?: string }) {
  const src = (name || target || '?').trim();
  const letter = src.slice(0, 1).toUpperCase();
  return <span className="av-pulse-avatar-fallback" aria-hidden="true">{letter}</span>;
}

export default function LiveActivityPulse({ pollMs = 5000 }: { pollMs?: number }) {
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch('/api/admin/activity/stream?limit=30', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setEvents((prev) => {
          const existing = new Set(prev.map((e) => e.id));
          const incoming: PulseEvent[] = data.events ?? [];
          for (const e of incoming) {
            if (!existing.has(e.id)) seenRef.current.add(e.id);
          }
          return incoming.slice(0, 30);
        });
      } catch { /* ignore */ }
    };

    fetchOnce();
    if (paused) return () => { cancelled = true; };
    const t = window.setInterval(fetchOnce, pollMs);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [pollMs, paused]);

  return (
    <section className="av-surface av-pulse">
      <header className="av-pulse-head">
        <div>
          <h3>Live Activity</h3>
          <p>Every action across Luna as it happens.</p>
        </div>
        <div className="av-pulse-head-actions">
          <Link href="/admin/activity" className="av-pulse-viewall" title="Open full activity log with filters">
            View all →
          </Link>
          <button
            type="button"
            className={`av-pulse-toggle${paused ? '' : ' av-pulse-toggle--live'}`}
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Resume' : 'Pause'}
          >
            <span className="av-pulse-dot" aria-hidden="true" />
            {paused ? 'Paused' : 'Live'}
          </button>
        </div>
      </header>
      <ul className="av-pulse-list">
        {events.length === 0 && <li className="av-pulse-empty">Waiting for activity…</li>}
        {events.map((e) => {
          const kindMeta = KIND_META[e.kind];
          const { label: actionLabel, tone } = humanizeAction(e.action);
          const isNew = seenRef.current.has(e.id);
          const displayName = e.targetName || e.target || '';
          const canPeek = !!e.target;
          return (
            <li
              key={e.id}
              className={`av-pulse-row${isNew ? ' av-pulse-row--new' : ''}`}
              style={{ ['--pulse-c' as any]: kindMeta.color }}
            >
              <span className="av-pulse-stripe" aria-hidden="true" />
              <span className="av-pulse-kind" title={kindMeta.label}>
                <span className="av-pulse-kind-glyph" aria-hidden="true">{kindMeta.glyph}</span>
                <span>{kindMeta.label}</span>
              </span>

              {canPeek && (
                <button
                  type="button"
                  className="av-pulse-user"
                  onClick={(ev) => { ev.stopPropagation(); openPeek(e.target!); }}
                  title={`Open ${displayName || e.target}`}
                >
                  {e.targetAvatar ? (
                    <img className="av-pulse-avatar" src={e.targetAvatar} alt="" loading="lazy" />
                  ) : (
                    <Initials name={e.targetName} target={e.target} />
                  )}
                  <span className="av-pulse-uname">{displayName || 'Unknown user'}</span>
                </button>
              )}

              <span className={`av-pulse-action av-pulse-action--${tone}`}>{actionLabel}</span>

              {typeof e.amount === 'number' && e.amount !== 0 && (() => {
                const { text, cls } = formatAmount(e.amount, tone);
                return <span className={`av-pulse-amt ${cls}`}>{text}</span>;
              })()}

              {e.actor && (
                <span className="av-pulse-actor" title={`Admin action by ${e.actor}`}>by {e.actor}</span>
              )}

              <span className="av-pulse-time" title={absolute(e.timestamp)}>
                {mounted ? fmtRel(e.timestamp) : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
