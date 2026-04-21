'use client';

import { useEffect, useMemo, useState } from 'react';

interface Inputs {
  dailyAmount: number;
  salaryAmount: number;
  investorAmount: number;
  activeDailyUsers: number;
  activeSalaryUsers: number;
  activeInvestorUsers: number;
}

interface CurrentState {
  dailyAmount: number;
  salaryAmount: number;
  investorAmount: number;
  totalUsers: number;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

export default function EconomySimulator({ current }: { current: CurrentState }) {
  const [baseline, setBaseline] = useState<Inputs>({
    dailyAmount: current.dailyAmount,
    salaryAmount: current.salaryAmount,
    investorAmount: current.investorAmount,
    activeDailyUsers: Math.round(current.totalUsers * 0.3),
    activeSalaryUsers: Math.round(current.totalUsers * 0.15),
    activeInvestorUsers: Math.round(current.totalUsers * 0.05),
  });

  const [proposed, setProposed] = useState<Inputs>(baseline);

  const [days, setDays] = useState(30);

  useEffect(() => {
    setBaseline((b) => ({
      ...b,
      dailyAmount: current.dailyAmount,
      salaryAmount: current.salaryAmount,
      investorAmount: current.investorAmount,
    }));
    setProposed((p) => ({
      ...p,
      dailyAmount: current.dailyAmount,
      salaryAmount: current.salaryAmount,
      investorAmount: current.investorAmount,
    }));
  }, [current.dailyAmount, current.salaryAmount, current.investorAmount]);

  const calc = (inp: Inputs, daysCount: number) => {
    const dailyInflow = inp.dailyAmount * inp.activeDailyUsers * daysCount;
    const investorInflow = inp.investorAmount * inp.activeInvestorUsers * daysCount;
    const salaryInflow = (inp.salaryAmount * inp.activeSalaryUsers * daysCount) / 30;
    return {
      daily: dailyInflow,
      investor: investorInflow,
      salary: salaryInflow,
      total: dailyInflow + investorInflow + salaryInflow,
    };
  };

  const baselineResult = useMemo(() => calc(baseline, days), [baseline, days]);
  const proposedResult = useMemo(() => calc(proposed, days), [proposed, days]);
  const delta = proposedResult.total - baselineResult.total;
  const deltaPct = baselineResult.total > 0 ? (delta / baselineResult.total) * 100 : 0;

  const reset = () => setProposed(baseline);

  const update = (key: keyof Inputs, val: number) => setProposed((p) => ({ ...p, [key]: Math.max(0, val) }));

  return (
    <section className="av-surface av-simulator">
      <header className="av-flows-head">
        <div>
          <h3>Economy simulator — "what if?"</h3>
          <p>Preview how changing daily/salary/investor payouts shifts Lunari inflow over time. Pure math on active-user estimates — does not change live config.</p>
        </div>
        <div className="av-flows-actions" style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--av-text-sm)' }}>
            Window:
            <select className="av-shopf-input" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 100 }}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </label>
          <button type="button" className="av-btn av-btn-ghost" onClick={reset}>Reset to current</button>
        </div>
      </header>

      <div className="av-simulator-grid">
        <div className="av-simulator-col">
          <h4>Baseline (current config)</h4>
          <div className="av-simulator-inputs">
            <Row label="Daily reward amount" value={baseline.dailyAmount} onChange={(v) => setBaseline({ ...baseline, dailyAmount: v })} suffix="Lunari" />
            <Row label="Monthly salary" value={baseline.salaryAmount} onChange={(v) => setBaseline({ ...baseline, salaryAmount: v })} suffix="Lunari" />
            <Row label="Investor daily bonus" value={baseline.investorAmount} onChange={(v) => setBaseline({ ...baseline, investorAmount: v })} suffix="Lunari" />
            <Row label="Active daily claimants" value={baseline.activeDailyUsers} onChange={(v) => setBaseline({ ...baseline, activeDailyUsers: v })} suffix="users" />
            <Row label="Active salary claimants" value={baseline.activeSalaryUsers} onChange={(v) => setBaseline({ ...baseline, activeSalaryUsers: v })} suffix="users/month" />
            <Row label="Active investor claimants" value={baseline.activeInvestorUsers} onChange={(v) => setBaseline({ ...baseline, activeInvestorUsers: v })} suffix="investors" />
          </div>
        </div>

        <div className="av-simulator-col av-simulator-col--proposed">
          <h4>Proposed config</h4>
          <div className="av-simulator-inputs">
            <Row label="Daily reward amount" value={proposed.dailyAmount} onChange={(v) => update('dailyAmount', v)} suffix="Lunari" diff={proposed.dailyAmount - baseline.dailyAmount} />
            <Row label="Monthly salary" value={proposed.salaryAmount} onChange={(v) => update('salaryAmount', v)} suffix="Lunari" diff={proposed.salaryAmount - baseline.salaryAmount} />
            <Row label="Investor daily bonus" value={proposed.investorAmount} onChange={(v) => update('investorAmount', v)} suffix="Lunari" diff={proposed.investorAmount - baseline.investorAmount} />
            <Row label="Active daily claimants" value={proposed.activeDailyUsers} onChange={(v) => update('activeDailyUsers', v)} suffix="users" diff={proposed.activeDailyUsers - baseline.activeDailyUsers} />
            <Row label="Active salary claimants" value={proposed.activeSalaryUsers} onChange={(v) => update('activeSalaryUsers', v)} suffix="users/month" diff={proposed.activeSalaryUsers - baseline.activeSalaryUsers} />
            <Row label="Active investor claimants" value={proposed.activeInvestorUsers} onChange={(v) => update('activeInvestorUsers', v)} suffix="investors" diff={proposed.activeInvestorUsers - baseline.activeInvestorUsers} />
          </div>
        </div>
      </div>

      <div className="av-simulator-results">
        <div className="av-simulator-metric">
          <span>Baseline inflow ({days}d)</span>
          <strong>{fmt(baselineResult.total)} Lunari</strong>
          <div className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>
            Daily {fmt(baselineResult.daily)} · Salary {fmt(baselineResult.salary)} · Investor {fmt(baselineResult.investor)}
          </div>
        </div>
        <div className="av-simulator-metric">
          <span>Proposed inflow ({days}d)</span>
          <strong>{fmt(proposedResult.total)} Lunari</strong>
          <div className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>
            Daily {fmt(proposedResult.daily)} · Salary {fmt(proposedResult.salary)} · Investor {fmt(proposedResult.investor)}
          </div>
        </div>
        <div className="av-simulator-metric av-simulator-delta">
          <span>Change</span>
          <strong className={delta > 0 ? 'av-text-gain' : delta < 0 ? 'av-text-loss' : ''}>
            {delta > 0 ? '+' : ''}{fmt(delta)} Lunari
          </strong>
          <div className={delta > 0 ? 'av-text-gain' : delta < 0 ? 'av-text-loss' : 'av-text-muted'} style={{ fontSize: 'var(--av-text-xs)' }}>
            {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}% vs baseline
          </div>
        </div>
      </div>

      <div className="av-commands-banner" data-tone="info" style={{ marginTop: 12 }}>
        <strong>Heads up</strong>
        <span>
          This simulator estimates <em>inflow only</em> — it doesn't model sinks (shop purchases, game losses, investments, bank interest).
          The "active claimants" defaults are rough starting points. Adjust them based on your real analytics numbers from the transaction history.
        </span>
      </div>
    </section>
  );
}

function Row({ label, value, onChange, suffix, diff }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  diff?: number;
}) {
  return (
    <div className="av-simulator-row">
      <label>{label}</label>
      <div className="av-simulator-row-input">
        <input
          type="number"
          min={0}
          step={label.includes('Lunari') ? 100 : 1}
          className="av-shopf-input"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)', minWidth: 60 }}>{suffix}</span>
      </div>
      {diff !== undefined && diff !== 0 && (
        <span className={`av-simulator-diff ${diff > 0 ? 'av-text-gain' : 'av-text-loss'}`}>
          {diff > 0 ? '+' : ''}{diff.toLocaleString()}
        </span>
      )}
    </div>
  );
}
