'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import Icon from '../_components/Icon';
import StatCard from '../_components/StatCard';
import AvellePersonaPanel from './AvellePersonaPanel';
import ReservePanel from './ReservePanel';
import LoanTiersPanel from './LoanTiersPanel';
import InvestmentPanel from './InvestmentPanel';
import InsuranceTypesPanel from './InsuranceTypesPanel';
import CoreSettingsPanel from './CoreSettingsPanel';
import DailyRewardPanel from './DailyRewardPanel';
import SalaryPanel from './SalaryPanel';
import InvestorRewardPanel from './InvestorRewardPanel';
import StealSystemPanel from './StealSystemPanel';

type TabId =
  | 'persona' | 'reserve' | 'loans' | 'investment' | 'insurance' | 'core'
  | 'daily' | 'salary' | 'investor' | 'steal';

const TABS: { id: TabId; label: string; caption: string }[] = [
  { id: 'persona',    label: 'Avelle',      caption: 'Persona · portrait · greeting' },
  { id: 'reserve',    label: 'Reserve',     caption: 'Luna vault · withdrawals' },
  { id: 'loans',      label: 'Loan tiers',  caption: 'Amounts · interest · duration' },
  { id: 'investment', label: 'Investment',  caption: 'Rate · maturity · minimum' },
  { id: 'insurance',  label: 'Insurance',   caption: 'Steal protection · other plans' },
  { id: 'daily',      label: 'Daily',       caption: 'Base payout · cooldown' },
  { id: 'salary',     label: 'Salary',      caption: 'Staff / role monthly pay' },
  { id: 'investor',   label: 'Investor',    caption: 'VIP bonus on top of daily' },
  { id: 'steal',      label: 'Steal',       caption: 'Chance · range · cooldown' },
  { id: 'core',       label: 'Core',        caption: 'Enable · roles · trade level' },
];

export interface BankingConfig {
  persona: {
    name: string;
    title: string;
    description: string;
    portrait: string;
    portraitVersion: number;
  };
  enabled: boolean;
  trade_level: number;
  loan_tiers: Array<{
    level: number;
    amount: number;
    interest: number;
    duration: number;
    passport_required?: boolean;
  }>;
  investor_interest: number;
  insurance_types: Array<{
    name: string;
    type: string;
    price: number;
    duration: number;
  }>;
  investment: {
    profit_rate: number;
    min_amount: number;
    maturity_period: number;
    early_withdrawal_fee: number;
    check_interval: number;
  };
  overdue_debt_role_id: string;
  investor_deposit_role_id: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface EconomyConfig {
  daily_reward: { amount: number; cooldown: number };
  salary: { amount: number; cooldown: number };
  investor_reward: { amount: number; cooldown: number };
  steal_system: {
    enabled: boolean;
    cooldown: number;
    min_percentage: number;
    max_percentage: number;
    required_roles: string[];
    success_title?: string;
    success_footer?: string;
    success_image?: string;
    fail_title?: string;
    fail_description?: string;
    fail_image?: string;
  };
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

export async function saveBankingSection(section: string, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/banking/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

export async function saveEconomySection(section: string, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/economy/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

interface Props {
  initialReserve: number;
  initialActiveLoans: number;
  initialLoanValue: number;
  initialTotalDebt: number;
}

export default function BankingClient({ initialReserve, initialActiveLoans, initialLoanValue, initialTotalDebt }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('persona');
  const [config, setConfig] = useState<BankingConfig | null>(null);
  const [economy, setEconomy] = useState<EconomyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bankingRes, economyRes] = await Promise.all([
        fetch('/api/admin/banking/config', { cache: 'no-store' }),
        fetch('/api/admin/economy/config', { cache: 'no-store' }),
      ]);
      const bankingBody = await bankingRes.json();
      const economyBody = await economyRes.json();
      if (!bankingRes.ok) throw new Error(bankingBody.error ?? `Banking HTTP ${bankingRes.status}`);
      if (!economyRes.ok) throw new Error(economyBody.error ?? `Economy HTTP ${economyRes.status}`);
      setConfig(bankingBody as BankingConfig);
      setEconomy({
        daily_reward:    economyBody.daily_reward,
        salary:          economyBody.salary,
        investor_reward: economyBody.investor_reward,
        steal_system:    economyBody.steal_system,
      });
      setLoadError(null);
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      toast.show({ tone: 'error', title: 'Load failed', message: msg });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const mutateConfig = (patch: Partial<BankingConfig>) => {
    setConfig((c) => (c ? { ...c, ...patch } : c));
  };

  const mutateEconomy = (patch: Partial<EconomyConfig>) => {
    setEconomy((c) => (c ? { ...c, ...patch } : c));
  };

  if (loading) {
    return <div className="av-commands-empty">Loading banking configuration…</div>;
  }

  if (loadError || !config || !economy) {
    return (
      <div className="av-flows-empty">
        <span>Couldn't load banking config — {loadError ?? 'unknown error'}</span>
        <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => void load()}>↻ Retry</button>
      </div>
    );
  }

  return (
    <>
      {/* Headline stats — Avelle's domain at a glance */}
      <div className="av-stat-grid">
        <StatCard
          label="Luna's Bank Reserve"
          icon="bank"
          tone="purple"
          value={initialReserve}
          copyable
          hint="Lunari held in Avelle's vault. Backs loans + investments. Withdrawals are audited."
          meta="Owned by Avelle Adar"
        />
        <StatCard
          label="Active Loans"
          icon="trending"
          tone="green"
          value={initialActiveLoans}
          copyable
          hint="Users with outstanding debt to the bank."
          meta={initialLoanValue > 0 ? `${fmt(initialLoanValue)} Lunari out` : 'No outstanding'}
        />
        <StatCard
          label="Outstanding Debt"
          icon="shield"
          tone={initialTotalDebt > 0 ? 'red' : 'cyan'}
          value={initialTotalDebt}
          copyable
          hint="Total Lunari owed across every active loan."
          meta={initialTotalDebt > 0 ? 'Needs attention' : 'Clean ledger'}
        />
        <StatCard
          label="Loan Tiers"
          icon="coins"
          tone="gold"
          value={config.loan_tiers.length}
          hint="Distinct loan amounts Avelle offers."
          meta={`Base rate ${(config.loan_tiers[0]?.interest ?? 0) * 100}%`}
        />
      </div>

      {/* Avelle hero strip — always visible above the tabs */}
      <section className="av-banking-hero" style={{ ['--vendor-tone' as any]: '#facc15' }}>
        <div className="av-banking-hero-portrait">
          {config.persona.portrait
            ? <img src={`${config.persona.portrait.split('?')[0]}?v=${config.persona.portraitVersion || 1}`} alt={config.persona.name} onError={(e) => (e.currentTarget.style.opacity = '0.3')} />
            : <div className="av-banking-hero-portrait-fallback">A</div>}
        </div>
        <div className="av-banking-hero-body">
          <div className="av-banking-hero-chip">
            <Icon name="bank" size={12} />
            <span>{config.persona.title || 'Lord Treasurer of Luna'}</span>
          </div>
          <h2>{config.persona.name}</h2>
          <p>{config.persona.description}</p>
          {config.updatedAt && (
            <span className="av-banking-hero-updated">
              Last edit · {new Date(config.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </section>

      {/* Tabs */}
      <nav className="av-banking-tabs" role="tablist" aria-label="Banking sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`av-banking-tab${tab === t.id ? ' av-banking-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="av-banking-tab-label">{t.label}</span>
            <span className="av-banking-tab-caption">{t.caption}</span>
          </button>
        ))}
      </nav>

      {/* Tab panels */}
      {tab === 'persona' && (
        <AvellePersonaPanel
          persona={config.persona}
          onSaved={(p) => mutateConfig({ persona: { ...p, portraitVersion: Date.now() } })}
        />
      )}
      {tab === 'reserve' && <ReservePanel initialReserve={initialReserve} />}
      {tab === 'loans' && (
        <LoanTiersPanel
          tiers={config.loan_tiers}
          onSaved={(tiers) => mutateConfig({ loan_tiers: tiers })}
        />
      )}
      {tab === 'investment' && (
        <InvestmentPanel
          investment={config.investment}
          onSaved={(investment) => mutateConfig({ investment })}
        />
      )}
      {tab === 'insurance' && (
        <InsuranceTypesPanel
          types={config.insurance_types}
          onSaved={(types) => mutateConfig({ insurance_types: types })}
        />
      )}
      {tab === 'daily' && (
        <DailyRewardPanel
          value={economy.daily_reward}
          onSaved={(daily_reward) => mutateEconomy({ daily_reward })}
        />
      )}
      {tab === 'salary' && (
        <SalaryPanel
          value={economy.salary}
          onSaved={(salary) => mutateEconomy({ salary })}
        />
      )}
      {tab === 'investor' && (
        <InvestorRewardPanel
          value={economy.investor_reward}
          onSaved={(investor_reward) => mutateEconomy({ investor_reward })}
        />
      )}
      {tab === 'steal' && (
        <StealSystemPanel
          value={economy.steal_system}
          onSaved={(steal_system) => mutateEconomy({ steal_system })}
        />
      )}
      {tab === 'core' && (
        <CoreSettingsPanel
          enabled={config.enabled}
          tradeLevel={config.trade_level}
          investorInterest={config.investor_interest}
          overdueDebtRoleId={config.overdue_debt_role_id}
          investorDepositRoleId={config.investor_deposit_role_id}
          onSaved={(patch) => mutateConfig(patch as any)}
        />
      )}
    </>
  );
}
