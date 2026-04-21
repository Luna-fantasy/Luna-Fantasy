'use client';

import { useEffect, useState } from 'react';
import type { RecentTransaction } from '@/types/admin';

function fmt(n: number) { return n.toLocaleString('en-US'); }

function relativeTime(ts: number, now: number): string {
  const diff = now - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Props { transactions: RecentTransaction[] }

export default function RecentTransactionsList({ transactions }: Props) {
  // Compute time on client only — avoids server/client time mismatch
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (transactions.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No recent transactions
      </div>
    );
  }

  return (
    <div className="av-list">
      {transactions.map((t) => {
        const positive = t.amount > 0;
        const initial = (t.username || t.discordId || '?').charAt(0).toUpperCase();
        const ts = typeof t.timestamp === 'string' ? new Date(t.timestamp).getTime() : t.timestamp.getTime();
        return (
          <div className="av-list-row" key={String(t._id)}>
            <div className="av-list-avatar">
              {t.avatar ? <img src={t.avatar} alt="" /> : initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="av-list-name">{t.username || t.discordId}</div>
              <div className="av-list-sub">{t.type}{t.description ? ` · ${t.description}` : ''}</div>
            </div>
            <span className="av-list-amount" data-tone={positive ? 'positive' : 'negative'}>
              {positive ? '+' : ''}{fmt(t.amount)}
            </span>
            <span className="av-list-time" suppressHydrationWarning>
              {now ? relativeTime(ts, now) : '…'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
