'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import ConfigTable from '../components/ConfigTable';
import SaveDeployBar from '../components/SaveDeployBar';
import StatCard from '../components/StatCard';
import BotBadge from '../components/BotBadge';
import ToggleSwitch from '../components/ToggleSwitch';
import DurationInput, { formatDuration } from '../components/DurationInput';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import type { EconomyOverview } from '@/types/admin';

interface DailyRewardConfig {
  min: number;
  max: number;
  cooldown: number;
}

interface SalaryConfig {
  amount: number;
  cooldown: number;
}

interface VipRewardConfig {
  amount: number;
  cooldown: number;
}

interface LoanTier {
  level: number;
  amount: number;
  interest: number;
  duration: number;
}

interface InvestmentConfig {
  profit_rate: number;
  min_amount: number;
  maturity_period: number;
  early_withdrawal_fee: number;
  check_interval: number;
}

interface StealSystemConfig {
  enabled: boolean;
  min_percentage: number;
  max_percentage: number;
  cooldown: number;
  [key: string]: any;
}

interface TradeConfig {
  max_amount: number;
  win_rate: number;
  loss_rate: number;
  win_chance: number;
  cooldown: number;
}

interface InsuranceConfig {
  cost: number;
}

type Tab = 'settings' | 'loans' | 'overview';

export default function BankingPage() {
  const [tab, setTab] = useState<Tab>('settings');

  // Settings state
  const [dailyReward, setDailyReward] = useState<DailyRewardConfig>({ min: 0, max: 0, cooldown: 86400000 });
  const [dailyRewardOriginal, setDailyRewardOriginal] = useState<DailyRewardConfig>({ min: 0, max: 0, cooldown: 86400000 });
  const [salary, setSalary] = useState<SalaryConfig>({ amount: 0, cooldown: 86400000 });
  const [salaryOriginal, setSalaryOriginal] = useState<SalaryConfig>({ amount: 0, cooldown: 86400000 });
  const [vipReward, setVipReward] = useState<VipRewardConfig>({ amount: 0, cooldown: 86400000 });
  const [vipRewardOriginal, setVipRewardOriginal] = useState<VipRewardConfig>({ amount: 0, cooldown: 86400000 });
  const [loanTiers, setLoanTiers] = useState<LoanTier[]>([]);
  const [loanTiersOriginal, setLoanTiersOriginal] = useState<LoanTier[]>([]);
  const [investment, setInvestment] = useState<InvestmentConfig>({
    profit_rate: 0.3,
    min_amount: 0,
    maturity_period: 86400000,
    early_withdrawal_fee: 0,
    check_interval: 60000,
  });
  const [investmentOriginal, setInvestmentOriginal] = useState<InvestmentConfig>({
    profit_rate: 0.3,
    min_amount: 0,
    maturity_period: 86400000,
    early_withdrawal_fee: 0,
    check_interval: 60000,
  });
  const [stealSystem, setStealSystem] = useState<StealSystemConfig>({ enabled: false, min_percentage: 0, max_percentage: 0, cooldown: 0 });
  const [stealSystemOriginal, setStealSystemOriginal] = useState<StealSystemConfig>({ enabled: false, min_percentage: 0, max_percentage: 0, cooldown: 0 });
  const [tradeSettings, setTradeSettings] = useState<TradeConfig>({ max_amount: 50000, win_rate: 0.20, loss_rate: 0.30, win_chance: 0.50, cooldown: 14400000 });
  const [tradeSettingsOriginal, setTradeSettingsOriginal] = useState<TradeConfig>({ max_amount: 50000, win_rate: 0.20, loss_rate: 0.30, win_chance: 0.50, cooldown: 14400000 });
  const [insurance, setInsurance] = useState<InsuranceConfig>({ cost: 500000 });
  const [insuranceOriginal, setInsuranceOriginal] = useState<InsuranceConfig>({ cost: 500000 });
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Loans tab state
  const [loans, setLoans] = useState<any[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanActionLoading, setLoanActionLoading] = useState('');

  // Overview state
  const [overview, setOverview] = useState<EconomyOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  const { toast } = useToast();

  // Fetch Butler config for settings tab
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/butler');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sections = data.sections || {};

      if (sections.daily_reward) {
        setDailyReward(sections.daily_reward);
        setDailyRewardOriginal(sections.daily_reward);
      }
      if (sections.salary) {
        setSalary(sections.salary);
        setSalaryOriginal(sections.salary);
      }
      if (sections.vip_reward) {
        setVipReward(sections.vip_reward);
        setVipRewardOriginal(sections.vip_reward);
      }
      if (sections.loan_tiers) {
        setLoanTiers(sections.loan_tiers);
        setLoanTiersOriginal(sections.loan_tiers);
      }
      if (sections.investment) {
        setInvestment(sections.investment);
        setInvestmentOriginal(sections.investment);
      }
      if (sections.steal_system) {
        setStealSystem(sections.steal_system);
        setStealSystemOriginal(sections.steal_system);
      }
      if (sections.trade_settings) {
        setTradeSettings(sections.trade_settings);
        setTradeSettingsOriginal(sections.trade_settings);
      }
      if (sections.insurance) {
        setInsurance(sections.insurance);
        setInsuranceOriginal(sections.insurance);
      }
    } catch {
      toast('Failed to load banking config. Try refreshing.', 'error');
    } finally {
      setConfigLoading(false);
    }
  }, [toast]);

  const fetchLoans = useCallback(async () => {
    setLoansLoading(true);
    try {
      const res = await fetch('/api/admin/banking/loans');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setLoans(data.loans ?? []);
    } catch {
      console.error('Failed to load loans');
    } finally {
      setLoansLoading(false);
    }
  }, []);

  // Fetch economy overview for overview tab
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/economy/overview');
      if (!res.ok) throw new Error('Failed');
      setOverview(await res.json());
      setLastUpdated(Date.now());
    } catch {
      console.error('Failed to load economy overview');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (tab === 'loans') {
      fetchLoans();
      const interval = setInterval(fetchLoans, 30_000);
      return () => clearInterval(interval);
    }
  }, [tab, fetchLoans]);

  useEffect(() => {
    if (tab === 'overview') {
      setOverviewLoading(true);
      fetchOverview();
      const interval = setInterval(fetchOverview, 30_000);
      return () => clearInterval(interval);
    }
  }, [tab, fetchOverview]);

  // Tick the "last updated" counter every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Change detection
  const dailyRewardChanged = JSON.stringify(dailyReward) !== JSON.stringify(dailyRewardOriginal);
  const salaryChanged = JSON.stringify(salary) !== JSON.stringify(salaryOriginal);
  const vipRewardChanged = JSON.stringify(vipReward) !== JSON.stringify(vipRewardOriginal);
  const loanTiersChanged = JSON.stringify(loanTiers) !== JSON.stringify(loanTiersOriginal);
  const investmentChanged = JSON.stringify(investment) !== JSON.stringify(investmentOriginal);
  const stealSystemChanged = JSON.stringify(stealSystem) !== JSON.stringify(stealSystemOriginal);
  const tradeSettingsChanged = JSON.stringify(tradeSettings) !== JSON.stringify(tradeSettingsOriginal);
  const insuranceChanged = JSON.stringify(insurance) !== JSON.stringify(insuranceOriginal);
  const hasChanges = dailyRewardChanged || salaryChanged || vipRewardChanged || loanTiersChanged || investmentChanged || stealSystemChanged || tradeSettingsChanged || insuranceChanged;

  // Save
  async function saveConfig() {
    setSaving(true);

    try {
      const toSave: Array<{ section: string; value: any }> = [];
      if (dailyRewardChanged) toSave.push({ section: 'daily_reward', value: dailyReward });
      if (salaryChanged) toSave.push({ section: 'salary', value: salary });
      if (vipRewardChanged) toSave.push({ section: 'vip_reward', value: vipReward });
      if (loanTiersChanged) toSave.push({ section: 'loan_tiers', value: loanTiers });
      if (investmentChanged) toSave.push({ section: 'investment', value: investment });
      if (stealSystemChanged) toSave.push({ section: 'steal_system', value: stealSystem });
      if (tradeSettingsChanged) toSave.push({ section: 'trade_settings', value: tradeSettings });
      if (insuranceChanged) toSave.push({ section: 'insurance', value: insurance });

      for (const { section, value } of toSave) {
        const res = await fetch('/api/admin/config/butler', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ section, value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to save ${section}`);
        }
      }

      if (dailyRewardChanged) setDailyRewardOriginal({ ...dailyReward });
      if (salaryChanged) setSalaryOriginal({ ...salary });
      if (vipRewardChanged) setVipRewardOriginal({ ...vipReward });
      if (loanTiersChanged) setLoanTiersOriginal([...loanTiers]);
      if (investmentChanged) setInvestmentOriginal({ ...investment });
      if (stealSystemChanged) setStealSystemOriginal({ ...stealSystem });
      if (tradeSettingsChanged) setTradeSettingsOriginal({ ...tradeSettings });
      if (insuranceChanged) setInsuranceOriginal({ ...insurance });

      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleLoanAction(action: string, discordId: string, extra?: Record<string, any>) {
    setLoanActionLoading(`${action}_${discordId}`);
    try {
      const res = await fetch('/api/admin/banking/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action, discordId, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }
      toast(`Loan ${action} successful`, 'success');
      await fetchLoans();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoanActionLoading('');
    }
  }

  const secondsAgo = Math.floor((now - lastUpdated) / 1000);

  if (configLoading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Banking</h1>
          <p className="admin-page-subtitle">Rewards, loans, investments, theft, and banking overview</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading banking config...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Banking</h1>
        <p className="admin-page-subtitle">Rewards, loans, investments, theft, and banking overview</p>
      </div>

      {/* Tab bar */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'settings' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <button
          className={`admin-tab ${tab === 'loans' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('loans')}
        >
          Loans
        </button>
        <button
          className={`admin-tab ${tab === 'overview' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && (
        <>
          <ConfigSection title="Daily Reward" description="Lunari earned from the daily command">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <NumberInput label="Minimum" value={dailyReward.min} onChange={(v) => setDailyReward({ ...dailyReward, min: v })} min={0} description="Smallest amount of Lunari per claim" />
              <NumberInput label="Maximum" value={dailyReward.max} onChange={(v) => setDailyReward({ ...dailyReward, max: v })} min={0} description="Largest amount of Lunari per claim" />
              <DurationInput label="Cooldown" value={dailyReward.cooldown} onChange={(v) => setDailyReward({ ...dailyReward, cooldown: v })} description="Time between claims" />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Salary" description="Monthly payment for active staff members">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <NumberInput label="Amount" value={salary.amount} onChange={(v) => setSalary({ ...salary, amount: v })} min={0} description="Lunari paid per salary claim" />
              <DurationInput label="Cooldown" value={salary.cooldown} onChange={(v) => setSalary({ ...salary, cooldown: v })} description="Time between salary payments" />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="VIP Reward" description="Extra daily reward for VIP members">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <NumberInput label="Amount" value={vipReward.amount} onChange={(v) => setVipReward({ ...vipReward, amount: v })} min={0} description="Lunari per VIP claim" />
              <DurationInput label="Cooldown" value={vipReward.cooldown} onChange={(v) => setVipReward({ ...vipReward, cooldown: v })} description="Time between VIP claims" />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection
            title="Loan Tiers"
            description="Loan options available to users. Higher levels unlock larger loans."
          >
            <ConfigTable
              columns={[
                { key: 'level', label: 'Required Level', type: 'number', width: '120px' },
                { key: 'amount', label: 'Loan Amount (Lunari)', type: 'number' },
                { key: 'interest', label: 'Interest Rate', type: 'number' },
                { key: 'duration', label: 'Repayment Time (ms)', type: 'number' },
              ]}
              rows={loanTiers}
              onChange={(rows) => setLoanTiers(rows as LoanTier[])}
              addLabel="Add Loan Tier"
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Interest Rate: 0.20 = 20%. Repayment Time is in milliseconds
              {loanTiers.length > 0 && (
                <> &mdash; current durations: {loanTiers.map((t, i) => (
                  <span key={i}>{i > 0 ? ', ' : ''}{formatDuration(t.duration)}</span>
                ))}</>
              )}
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection
            title="Investment"
            description="Users can invest Lunari and earn profit after a maturity period"
          >
            <NumberInput
              label="Profit Rate"
              value={investment.profit_rate}
              onChange={(v) => setInvestment({ ...investment, profit_rate: v })}
              step={0.01}
              min={0}
              max={1}
              description="How much profit an investment earns when it matures. 0.30 = 30% profit on maturity"
            />
            <NumberInput
              label="Minimum Investment"
              value={investment.min_amount}
              onChange={(v) => setInvestment({ ...investment, min_amount: v })}
              min={0}
              description="Smallest amount of Lunari a user can invest"
            />
            <DurationInput
              label="Maturity Period"
              value={investment.maturity_period}
              onChange={(v) => setInvestment({ ...investment, maturity_period: v })}
              description="How long until the investment matures and pays out"
            />
            <NumberInput
              label="Early Withdrawal Fee"
              value={investment.early_withdrawal_fee}
              onChange={(v) => setInvestment({ ...investment, early_withdrawal_fee: v })}
              min={0}
              description="Lunari deducted from the investment if the user withdraws before it matures"
            />
            <DurationInput
              label="Check Interval"
              value={investment.check_interval}
              onChange={(v) => setInvestment({ ...investment, check_interval: v })}
              description="How often the bot checks for matured investments and pays them out"
            />
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection
            title="Steal System"
            description="Players can attempt to steal a percentage of another player's Lunari"
          >
            <ToggleSwitch
              label="Enabled"
              checked={stealSystem.enabled}
              onChange={(v) => setStealSystem({ ...stealSystem, enabled: v })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
              <NumberInput
                label="Min Steal %"
                value={stealSystem.min_percentage}
                onChange={(v) => setStealSystem({ ...stealSystem, min_percentage: v })}
                min={0}
                max={100}
                description="Smallest percentage of a player's Lunari that can be stolen"
              />
              <NumberInput
                label="Max Steal %"
                value={stealSystem.max_percentage}
                onChange={(v) => setStealSystem({ ...stealSystem, max_percentage: v })}
                min={0}
                max={100}
                description="Largest percentage of a player's Lunari that can be stolen"
              />
              <DurationInput
                label="Cooldown"
                value={stealSystem.cooldown}
                onChange={(v) => setStealSystem({ ...stealSystem, cooldown: v })}
                description="Time between steal attempts"
              />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Trade Settings" description="Lunari trading game parameters">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <NumberInput label="Max Trade Amount" value={tradeSettings.max_amount} onChange={(v) => setTradeSettings({ ...tradeSettings, max_amount: v })} min={0} description="Maximum Lunari that can be traded at once" />
              <NumberInput label="Win Chance" value={tradeSettings.win_chance} onChange={(v) => setTradeSettings({ ...tradeSettings, win_chance: v })} step={0.01} min={0} max={1} description="Probability of winning a trade. 0.50 = 50%" />
              <NumberInput label="Win Rate" value={tradeSettings.win_rate} onChange={(v) => setTradeSettings({ ...tradeSettings, win_rate: v })} step={0.01} min={0} max={1} description="Profit percentage on win. 0.20 = +20%" />
              <NumberInput label="Loss Rate" value={tradeSettings.loss_rate} onChange={(v) => setTradeSettings({ ...tradeSettings, loss_rate: v })} step={0.01} min={0} max={1} description="Loss percentage on loss. 0.30 = -30%" />
              <DurationInput label="Cooldown" value={tradeSettings.cooldown} onChange={(v) => setTradeSettings({ ...tradeSettings, cooldown: v })} description="Time between trades" />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Insurance" description="Theft protection cost">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <NumberInput label="Theft Protection Cost" value={insurance.cost} onChange={(v) => setInsurance({ ...insurance, cost: v })} min={0} description="Lunari cost for lifetime theft protection" />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={hasChanges}
            saving={saving}
            onSave={saveConfig}
            projectName="Butler"
          />
        </>
      )}

      {/* Loans Tab */}
      {tab === 'loans' && (
        <>
          {loansLoading ? (
            <div className="admin-loading"><div className="admin-spinner" />Loading loans...</div>
          ) : loans.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">#</div>
              <p>No active or overdue loans</p>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Loan Amount</th>
                    <th>Repayment</th>
                    <th>Interest</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan, i) => {
                    const isOverdue = loan.isOverdue || loan.overdue;
                    const dueDate = new Date(loan.dueDate);
                    const daysLeft = Math.ceil((loan.dueDate - Date.now()) / 86_400_000);
                    return (
                      <tr key={`${loan.discordId}-${i}`}>
                        <td>
                          <Link href={`/admin/users/${loan.discordId}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
                            {loan.avatar && (
                              <img src={loan.avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              {loan.username && <span style={{ fontWeight: 600, fontSize: '13px' }}>{loan.username}</span>}
                              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>{loan.discordId}</span>
                            </div>
                          </Link>
                        </td>
                        <td style={{ fontWeight: 600 }}>{loan.amount?.toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-legendary)' }}>{loan.repaymentAmount?.toLocaleString()}</td>
                        <td>{Math.round((loan.interestRate ?? 0) * 100)}%</td>
                        <td style={{ fontSize: '13px', color: isOverdue ? '#f43f5e' : 'var(--text-secondary)' }}>
                          {dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          {isOverdue
                            ? <span style={{ color: '#f43f5e', fontWeight: 600 }}> (Overdue {Math.abs(daysLeft)}d)</span>
                            : <span style={{ color: 'var(--text-muted)' }}> ({daysLeft}d left)</span>
                          }
                        </td>
                        <td>
                          <span className={`admin-badge ${isOverdue ? 'admin-badge-warning' : 'admin-badge-success'}`}>
                            {isOverdue ? 'Overdue' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="admin-btn admin-btn-ghost"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              disabled={loanActionLoading === `absolve_${loan.discordId}`}
                              onClick={() => {
                                if (confirm(`Absolve ${loan.username || loan.discordId}'s loan of ${loan.repaymentAmount?.toLocaleString()} Lunari?`)) {
                                  handleLoanAction('absolve', loan.discordId, { reason: 'Admin absolved' });
                                }
                              }}
                            >
                              {loanActionLoading === `absolve_${loan.discordId}` ? '...' : 'Absolve'}
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              disabled={!!loanActionLoading}
                              onClick={() => {
                                const input = prompt(`Reduce repayment to (current: ${loan.repaymentAmount?.toLocaleString()}):`);
                                if (input) {
                                  const newAmt = parseInt(input, 10);
                                  if (!isNaN(newAmt) && newAmt >= 0) {
                                    handleLoanAction('reduce', loan.discordId, { newAmount: newAmt, reason: 'Admin reduced' });
                                  }
                                }
                              }}
                            >
                              Reduce
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              disabled={!!loanActionLoading}
                              onClick={() => {
                                const days = prompt('Extend by how many days?');
                                if (days) {
                                  const d = parseInt(days, 10);
                                  if (!isNaN(d) && d > 0) {
                                    handleLoanAction('extend', loan.discordId, {
                                      newDueDate: Date.now() + d * 86_400_000,
                                      reason: `Extended by ${d} days`,
                                    });
                                  }
                                }
                              }}
                            >
                              Extend
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Overview Tab */}
      {tab === 'overview' && (
        <>
          {overviewLoading ? (
            <div className="admin-loading"><div className="admin-spinner" />Loading banking data...</div>
          ) : overview ? (
            <>
              <div className="admin-stats-grid">
                <StatCard
                  label="Active Loans"
                  value={overview.activeLoans}
                  icon="#"
                  color="green"
                  trend={overview.activeLoans > 0 ? `${overview.activeLoans} loan${overview.activeLoans !== 1 ? 's' : ''} currently active` : undefined}
                />
                <StatCard
                  label="Total Loan Value"
                  value={overview.activeLoanValue}
                  icon="L"
                  color="gold"
                  trend={overview.activeLoanValue > 0 ? `${overview.activeLoanValue.toLocaleString()} Lunari lent out` : undefined}
                />
                <StatCard
                  label="Outstanding Debt"
                  value={overview.totalDebt}
                  icon="!"
                  color="purple"
                  trendType={overview.totalDebt > 0 ? 'negative' : 'neutral'}
                  trend={overview.totalDebt > 0 ? 'Users owe this amount' : 'No outstanding debt'}
                />
                <StatCard
                  label="Bank Reserve"
                  value={overview.bankReserve}
                  icon="B"
                  color="cyan"
                  trend={`${overview.bankReserve.toLocaleString()} Lunari in the bank`}
                />
              </div>
              <div style={{
                marginTop: '16px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                textAlign: 'right',
              }}>
                Last updated {secondsAgo} second{secondsAgo !== 1 ? 's' : ''} ago
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
              Failed to load banking overview. Try refreshing the page.
            </div>
          )}
        </>
      )}
    </>
  );
}
