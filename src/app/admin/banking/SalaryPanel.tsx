'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { saveEconomySection } from './BankingClient';

interface Salary {
  amount: number;
  cooldown: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export default function SalaryPanel({
  value,
  onSaved,
}: {
  value: Salary;
  onSaved: (next: Salary) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [w, setW] = useState<Salary>(value);

  const dirty = JSON.stringify(w) !== JSON.stringify(value);
  const days = Math.max(1, Math.round(w.cooldown / DAY_MS));

  const save = () => {
    pending.queue({
      label: 'Save staff salary',
      detail: `${fmt(w.amount)} Lunari every ${days}d`,
      delayMs: 4500,
      run: async () => {
        try {
          await saveEconomySection('salary', w);
          onSaved(w);
          toast.show({ tone: 'success', title: 'Saved', message: 'Salary config updated.' });
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
          <h3>Staff / role salary</h3>
          <p>Monthly payout for users with eligible roles (staff, boosters, nobles). Runs via <code>!salary</code>.</p>
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setW(value)}>Reset</button>
            <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save salary</button>
          </div>
        )}
      </header>

      <div className="av-banking-investment-grid">
        <label className="av-banking-field">
          <span>Salary amount (Lunari)</span>
          <input
            type="number"
            className="av-audit-input"
            min={0}
            max={1_000_000_000}
            value={w.amount}
            onChange={(e) => setW({ ...w, amount: Number(e.target.value) || 0 })}
          />
          <small>Paid per cycle to every eligible role holder.</small>
        </label>

        <label className="av-banking-field">
          <span>Cycle (days)</span>
          <input
            type="number"
            className="av-audit-input"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setW({ ...w, cooldown: Math.max(MIN_MS, (Number(e.target.value) || 1) * DAY_MS) })}
          />
          <small>How long between payouts. 30d = monthly.</small>
        </label>
      </div>

      <div className="av-banking-preview-box">
        <strong>Preview:</strong> Eligible users receive <strong>{fmt(w.amount)}</strong> Lunari every{' '}
        <strong>{days}</strong> day{days === 1 ? '' : 's'}. Eligible roles are defined in <code>bank-config.ts</code> (staff, boosters, Luna Noble, etc.).
      </div>
    </section>
  );
}
