'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { saveEconomySection } from './BankingClient';

interface DailyReward {
  amount: number;
  cooldown: number;
}

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function formatCooldown(ms: number): string {
  if (ms >= 24 * HOUR_MS && ms % (24 * HOUR_MS) === 0) return `${ms / (24 * HOUR_MS)}d`;
  if (ms >= HOUR_MS && ms % HOUR_MS === 0) return `${ms / HOUR_MS}h`;
  return `${Math.round(ms / MIN_MS)}m`;
}

export default function DailyRewardPanel({
  value,
  onSaved,
}: {
  value: DailyReward;
  onSaved: (next: DailyReward) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [w, setW] = useState<DailyReward>(value);

  const dirty = JSON.stringify(w) !== JSON.stringify(value);
  const hours = Math.round(w.cooldown / HOUR_MS);

  const save = () => {
    pending.queue({
      label: 'Save daily reward',
      detail: `${fmt(w.amount)} Lunari every ${formatCooldown(w.cooldown)}`,
      delayMs: 4500,
      run: async () => {
        try {
          await saveEconomySection('daily_reward', w);
          onSaved(w);
          toast.show({ tone: 'success', title: 'Saved', message: 'Daily reward updated.' });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <section className="av-banking-panel">
      <header className="av-banking-panel-head">
        <div>
          <h3>Daily reward</h3>
          <p>The base payout for <code>!daily</code>. Investors receive this PLUS the investor bonus on top.</p>
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setW(value)}>Reset</button>
            <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save daily</button>
          </div>
        )}
      </header>

      <div className="av-banking-investment-grid">
        <label className="av-banking-field">
          <span>Reward amount (Lunari)</span>
          <input
            type="number"
            className="av-audit-input"
            min={0}
            max={1_000_000_000}
            value={w.amount}
            onChange={(e) => setW({ ...w, amount: Number(e.target.value) || 0 })}
          />
          <small>Fixed amount paid to every user who runs /daily.</small>
        </label>

        <label className="av-banking-field">
          <span>Cooldown (hours)</span>
          <input
            type="number"
            className="av-audit-input"
            min={1}
            max={8760}
            value={hours}
            onChange={(e) => setW({ ...w, cooldown: Math.max(MIN_MS, (Number(e.target.value) || 1) * HOUR_MS) })}
          />
          <small>Users must wait this long between claims. 24h = once a day.</small>
        </label>
      </div>

      <div className="av-banking-preview-box">
        <strong>Preview:</strong> Every player gets <strong>{fmt(w.amount)}</strong> Lunari every{' '}
        <strong>{formatCooldown(w.cooldown)}</strong>. Investors stack their bonus on top of this.
      </div>
    </section>
  );
}
