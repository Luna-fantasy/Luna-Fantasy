'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { saveBankingSection } from './BankingClient';

interface InsuranceType {
  name: string;
  type: string;
  price: number;
  duration: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
function daysOrLifetime(ms: number): string {
  if (ms === -1) return 'Lifetime';
  const d = Math.round(ms / DAY_MS);
  return `${d}d`;
}

export default function InsuranceTypesPanel({
  types,
  onSaved,
}: {
  types: InsuranceType[];
  onSaved: (next: InsuranceType[]) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [working, setWorking] = useState<InsuranceType[]>(types);

  const dirty = JSON.stringify(working) !== JSON.stringify(types);

  const update = (i: number, patch: Partial<InsuranceType>) => {
    setWorking((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const add = () => {
    setWorking((ts) => [
      ...ts,
      { name: 'New plan', type: 'custom', price: 100000, duration: -1 },
    ]);
  };
  const remove = (i: number) => {
    const t = working[i];
    if (!t) return;
    setWorking((ts) => ts.filter((_, idx) => idx !== i));
    toast.show({ tone: 'info', title: 'Plan removed', message: `${t.name} — click Save to persist.` });
  };

  const save = () => {
    pending.queue({
      label: 'Save insurance plans',
      detail: `${working.length} plan${working.length === 1 ? '' : 's'}`,
      delayMs: 4500,
      run: async () => {
        try {
          await saveBankingSection('insurance_types', working);
          onSaved(working);
          toast.show({ tone: 'success', title: 'Saved', message: 'Insurance plans updated.' });
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
          <h3>Insurance plans · {working.length}</h3>
          <p>Protections Avelle sells. Example: steal-protection blocks the /steal command against this player for the plan's duration.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={add}>+ Add plan</button>
          {dirty && <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setWorking(types)}>Reset</button>}
          {dirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save plans</button>}
        </div>
      </header>

      {working.length === 0 ? (
        <div className="av-flows-empty">
          No insurance plans yet — <button type="button" className="av-shop-empty-add" onClick={add}>add the first plan</button>.
        </div>
      ) : (
        <div className="av-banking-insurance-grid">
          {working.map((t, i) => (
            <article key={i} className="av-banking-insurance-card">
              <header className="av-banking-insurance-head">
                <input
                  className="av-audit-input"
                  value={t.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Plan name (Arabic or English)"
                  maxLength={120}
                />
                <button
                  type="button"
                  className="av-shop-item-action av-shop-item-action--danger"
                  onClick={() => remove(i)}
                  title="Remove plan"
                >
                  🗑
                </button>
              </header>
              <div className="av-banking-insurance-row">
                <label>
                  <span>Insurance code</span>
                  <input
                    className="av-audit-input av-audit-input--sm"
                    value={t.type}
                    onChange={(e) => update(i, { type: e.target.value.replace(/[^a-z0-9_-]/gi, '') })}
                    placeholder="e.g. steal_protection"
                    maxLength={60}
                  />
                  <small style={{ opacity: 0.65, fontSize: 11 }}>Internal code the bot uses to match this plan. Lowercase, digits, _ or - only.</small>
                </label>
                <label>
                  <span>Price (Lunari)</span>
                  <input
                    type="number"
                    className="av-audit-input av-audit-input--sm"
                    min={0}
                    max={100_000_000}
                    value={t.price}
                    onChange={(e) => update(i, { price: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span>Duration</span>
                  <select
                    className="av-audit-input av-audit-input--sm"
                    value={t.duration === -1 ? 'lifetime' : 'custom'}
                    onChange={(e) => {
                      if (e.target.value === 'lifetime') update(i, { duration: -1 });
                      else update(i, { duration: 30 * DAY_MS });
                    }}
                  >
                    <option value="lifetime">Lifetime</option>
                    <option value="custom">Custom (days)</option>
                  </select>
                </label>
                {t.duration !== -1 && (
                  <label>
                    <span>Days</span>
                    <input
                      type="number"
                      className="av-audit-input av-audit-input--sm"
                      min={1}
                      max={365}
                      value={Math.round(t.duration / DAY_MS)}
                      onChange={(e) => update(i, { duration: (Number(e.target.value) || 1) * DAY_MS })}
                    />
                  </label>
                )}
              </div>
              <div className="av-banking-insurance-preview">
                <strong>{fmt(t.price)}</strong> Lunari · {daysOrLifetime(t.duration)} · <code>{t.type}</code>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
