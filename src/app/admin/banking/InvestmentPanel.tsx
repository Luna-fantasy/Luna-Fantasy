'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { saveBankingSection } from './BankingClient';

interface Investment {
  profit_rate: number;
  min_amount: number;
  maturity_period: number;
  early_withdrawal_fee: number;
  check_interval: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export default function InvestmentPanel({
  investment,
  onSaved,
}: {
  investment: Investment;
  onSaved: (i: Investment) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [w, setW] = useState<Investment>(investment);

  const dirty = JSON.stringify(w) !== JSON.stringify(investment);

  const save = () => {
    pending.queue({
      label: 'Save investment config',
      detail: `${Math.round(w.profit_rate * 100)}% over ${Math.round(w.maturity_period / DAY_MS)}d`,
      delayMs: 4500,
      run: async () => {
        try {
          await saveBankingSection('investment', w);
          onSaved(w);
          toast.show({ tone: 'success', title: 'Saved', message: 'Investment config updated.' });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const maturityDays = Math.round(w.maturity_period / DAY_MS);
  const checkMins = Math.round(w.check_interval / MIN_MS);
  const projectedReturn = Math.floor(w.min_amount * (1 + w.profit_rate));

  return (
    <section className="av-banking-panel">
      <header className="av-banking-panel-head">
        <div>
          <h3>Investment configuration</h3>
          <p>Players lock Lunari into Avelle's vault. They get it back with interest at maturity, or pay a fee to withdraw early.</p>
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setW(investment)}>Reset</button>
            <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save investment</button>
          </div>
        )}
      </header>

      <div className="av-banking-investment-grid">
        <label className="av-banking-field">
          <span>Profit rate (% of principal)</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              className="av-audit-input"
              step={1}
              min={0}
              max={500}
              value={Math.round(w.profit_rate * 100)}
              onChange={(e) => setW({ ...w, profit_rate: (Number(e.target.value) || 0) / 100 })}
            />
            <span className="av-text-muted">%</span>
          </div>
          <small>Return paid out at maturity.</small>
        </label>

        <label className="av-banking-field">
          <span>Minimum deposit (Lunari)</span>
          <input
            type="number"
            className="av-audit-input"
            min={1}
            max={100_000_000}
            value={w.min_amount}
            onChange={(e) => setW({ ...w, min_amount: Number(e.target.value) || 0 })}
          />
          <small>Qualifies the user for the "Investor" role.</small>
        </label>

        <label className="av-banking-field">
          <span>Maturity period (days)</span>
          <input
            type="number"
            className="av-audit-input"
            min={1}
            max={365}
            value={maturityDays}
            onChange={(e) => setW({ ...w, maturity_period: (Number(e.target.value) || 1) * DAY_MS })}
          />
          <small>Time before the investment can be withdrawn without penalty.</small>
        </label>

        <label className="av-banking-field">
          <span>Early-withdrawal fee (Lunari)</span>
          <input
            type="number"
            className="av-audit-input"
            min={0}
            max={100_000_000}
            value={w.early_withdrawal_fee}
            onChange={(e) => setW({ ...w, early_withdrawal_fee: Number(e.target.value) || 0 })}
          />
          <small>Deducted if the player cashes out before maturity.</small>
        </label>

        <label className="av-banking-field">
          <span>Check interval (minutes)</span>
          <input
            type="number"
            className="av-audit-input"
            min={1}
            max={1440}
            value={checkMins}
            onChange={(e) => setW({ ...w, check_interval: Math.max(MIN_MS, (Number(e.target.value) || 1) * MIN_MS) })}
          />
          <small>How often the bot checks for matured investments.</small>
        </label>
      </div>

      <div className="av-banking-preview-box">
        <strong>Preview:</strong> A player deposits <strong>{fmt(w.min_amount)}</strong> Lunari. After{' '}
        <strong>{maturityDays}</strong> days Avelle returns <strong>{fmt(projectedReturn)}</strong> Lunari
        ({fmt(projectedReturn - w.min_amount)} profit). Early withdrawal deducts{' '}
        <strong>{fmt(w.early_withdrawal_fee)}</strong> Lunari.
      </div>
    </section>
  );
}
