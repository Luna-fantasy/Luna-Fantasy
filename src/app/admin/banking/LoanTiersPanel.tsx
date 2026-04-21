'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { saveBankingSection } from './BankingClient';

interface Tier {
  level: number;
  amount: number;
  interest: number;
  duration: number;
  passport_required?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function msToDays(ms: number): number {
  return Math.round(ms / DAY_MS);
}
function daysToMs(days: number): number {
  return Math.floor(days * DAY_MS);
}
function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export default function LoanTiersPanel({
  tiers,
  onSaved,
}: {
  tiers: Tier[];
  onSaved: (next: Tier[]) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [working, setWorking] = useState<Tier[]>(tiers);

  const dirty = JSON.stringify(working) !== JSON.stringify(tiers);

  const update = (i: number, patch: Partial<Tier>) => {
    setWorking((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const add = () => {
    const last = working[working.length - 1];
    setWorking((ts) => [
      ...ts,
      {
        level: last?.level ?? 1,
        amount: (last?.amount ?? 10000) + 10000,
        interest: last?.interest ?? 0.20,
        duration: last?.duration ?? 7 * DAY_MS,
      },
    ]);
  };
  const remove = (i: number) => {
    const t = working[i];
    if (!t) return;
    setWorking((ts) => ts.filter((_, idx) => idx !== i));
    toast.show({
      tone: 'info',
      title: 'Tier removed',
      message: `${fmt(t.amount)} Lunari tier — click Save to persist, Reset to undo.`,
    });
  };
  const reset = () => setWorking(tiers);

  const save = () => {
    pending.queue({
      label: 'Save loan tiers',
      detail: `${working.length} tiers · Butler reloads within ~30s`,
      delayMs: 4500,
      run: async () => {
        try {
          await saveBankingSection('loan_tiers', working);
          onSaved(working);
          toast.show({ tone: 'success', title: 'Saved', message: `${working.length} loan tiers updated.` });
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
          <h3>Loan tiers · {working.length}</h3>
          <p>What Avelle lends and at what rate. Players pick a tier; interest accrues, and Luna's vault backs the loan.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={add}>+ Add tier</button>
          {dirty && <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={reset}>Reset</button>}
          {dirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save tiers</button>}
        </div>
      </header>

      {working.length === 0 ? (
        <div className="av-flows-empty">
          No loan tiers yet — <button type="button" className="av-shop-empty-add" onClick={add}>add the first tier</button>.
        </div>
      ) : (
        <div className="av-banking-tiers-grid">
          {working.map((t, i) => (
            <article key={i} className="av-banking-tier-card">
              <header className="av-banking-tier-head">
                <div className="av-banking-tier-amount">
                  {fmt(t.amount)} <small>Lunari</small>
                </div>
                <button
                  type="button"
                  className="av-shop-item-action av-shop-item-action--danger"
                  onClick={() => remove(i)}
                  title="Remove tier"
                >
                  🗑
                </button>
              </header>

              <div className="av-banking-tier-grid">
                <label>
                  <span>Amount</span>
                  <input
                    type="number"
                    className="av-audit-input av-audit-input--sm"
                    min={1}
                    max={100_000_000}
                    value={t.amount}
                    onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span>Interest (% of principal)</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      className="av-audit-input av-audit-input--sm"
                      step={1}
                      min={0}
                      max={200}
                      value={Math.round(t.interest * 100)}
                      onChange={(e) => update(i, { interest: (Number(e.target.value) || 0) / 100 })}
                    />
                    <span className="av-text-muted">%</span>
                  </div>
                </label>
                <label>
                  <span>Duration (days)</span>
                  <input
                    type="number"
                    className="av-audit-input av-audit-input--sm"
                    min={1}
                    max={365}
                    value={msToDays(t.duration)}
                    onChange={(e) => update(i, { duration: daysToMs(Number(e.target.value) || 1) })}
                  />
                </label>
                <label>
                  <span>Required level</span>
                  <input
                    type="number"
                    className="av-audit-input av-audit-input--sm"
                    min={0}
                    max={200}
                    value={t.level}
                    onChange={(e) => update(i, { level: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>

              <label className="av-banking-tier-passport">
                <input
                  type="checkbox"
                  checked={t.passport_required ?? false}
                  onChange={(e) => update(i, { passport_required: e.target.checked || undefined })}
                />
                <span>Passport required · only VIP / staff passport holders can take this tier</span>
              </label>

              <div className="av-banking-tier-preview">
                Repays <strong>{fmt(Math.floor(t.amount * (1 + t.interest)))}</strong> Lunari over {msToDays(t.duration)}d
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
