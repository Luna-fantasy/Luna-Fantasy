'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { saveEconomySection } from './BankingClient';

interface InvestorReward {
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

export default function InvestorRewardPanel({
  value,
  onSaved,
}: {
  value: InvestorReward;
  onSaved: (next: InvestorReward) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [w, setW] = useState<InvestorReward>(value);

  const dirty = JSON.stringify(w) !== JSON.stringify(value);
  const hours = Math.round(w.cooldown / HOUR_MS);

  const save = () => {
    pending.queue({
      label: 'Save investor reward',
      detail: `+${fmt(w.amount)} Lunari every ${formatCooldown(w.cooldown)} for investors`,
      delayMs: 4500,
      run: async () => {
        try {
          await saveEconomySection('investor_reward', w);
          onSaved(w);
          toast.show({ tone: 'success', title: 'Saved', message: 'Investor reward updated.' });
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
          <h3>Investor bonus (VIP reward)</h3>
          <p>
            Stacked on top of the daily reward for users with an active bank investment. Stored under
            <code> investor_reward</code>; Butler still reads legacy <code>vip_reward</code> as fallback.
          </p>
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setW(value)}>Reset</button>
            <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save bonus</button>
          </div>
        )}
      </header>

      <div className="av-banking-investment-grid">
        <label className="av-banking-field">
          <span>Bonus amount (Lunari)</span>
          <input
            type="number"
            className="av-audit-input"
            min={0}
            max={1_000_000_000}
            value={w.amount}
            onChange={(e) => setW({ ...w, amount: Number(e.target.value) || 0 })}
          />
          <small>Added on top of the base daily reward for active investors.</small>
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
          <small>Usually 24h — matches the base daily cooldown.</small>
        </label>
      </div>

      <div className="av-banking-preview-box">
        <strong>Preview:</strong> Investors earn an extra <strong>+{fmt(w.amount)}</strong> Lunari every{' '}
        <strong>{formatCooldown(w.cooldown)}</strong>. To qualify they must hold an active investment at or above the minimum deposit.
      </div>
    </section>
  );
}
