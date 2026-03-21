'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ConfigSection from '../components/ConfigSection';
import ConfirmModal from '../components/ConfirmModal';
import NumberInput from '../components/NumberInput';
import PercentInput from '../components/PercentInput';
import ConfigTable from '../components/ConfigTable';
import SaveDeployBar from '../components/SaveDeployBar';
import StatCard from '../components/StatCard';
import BotBadge from '../components/BotBadge';
import ToggleSwitch from '../components/ToggleSwitch';
import DurationInput from '../components/DurationInput';
import RolePicker from '../components/RolePicker';
import ImagePicker from '../components/ImagePicker';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import { timeAgo } from '../utils/timeAgo';
import { computeConfigDiff } from '../utils/computeConfigDiff';
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

type Tab = 'settings' | 'loans' | 'overview' | 'reserve';

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
  const [configMetadata, setConfigMetadata] = useState<{ updatedAt: string | null; updatedBy: string | null }>({ updatedAt: null, updatedBy: null });

  // Loans tab state
  const [loans, setLoans] = useState<any[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loansFetched, setLoansFetched] = useState(false);
  const [loanActionLoading, setLoanActionLoading] = useState('');
  const [inlineEdit, setInlineEdit] = useState<{ type: 'reduce' | 'extend'; discordId: string; value: string } | null>(null);
  const [pendingAbsolve, setPendingAbsolve] = useState<{ discordId: string; name: string; amount: number } | null>(null);

  // Overview state
  const [overview, setOverview] = useState<EconomyOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  // Reserve state
  const [reserveBalance, setReserveBalance] = useState<number>(0);
  const [reserveWithdrawals, setReserveWithdrawals] = useState<any[]>([]);
  const [reserveLoading, setReserveLoading] = useState(true);
  const [reserveFormId, setReserveFormId] = useState('');
  const [reserveFormAmount, setReserveFormAmount] = useState('');
  const [reserveFormReason, setReserveFormReason] = useState('');
  const [reserveLookup, setReserveLookup] = useState<{ username?: string; loading: boolean }>({ loading: false });
  const [reserveSubmitting, setReserveSubmitting] = useState(false);
  const [reserveResult, setReserveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { toast } = useToast();

  // Fetch Butler config for settings tab
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/butler');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sections = data.sections || {};
      if (data.metadata) setConfigMetadata(data.metadata);

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
      toast('Failed to load loans', 'error');
    } finally {
      setLoansLoading(false);
      setLoansFetched(true);
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
      toast('Failed to load banking overview', 'error');
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

  // Fetch reserve data
  const fetchReserve = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/banking/reserve');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setReserveBalance(data.balance ?? 0);
      setReserveWithdrawals(data.recentWithdrawals ?? []);
    } catch {
      toast('Failed to load reserve data', 'error');
    } finally {
      setReserveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'reserve') {
      setReserveLoading(true);
      fetchReserve();
    }
  }, [tab, fetchReserve]);

  // User lookup for reserve form
  useEffect(() => {
    if (!/^\d{17,20}$/.test(reserveFormId)) {
      setReserveLookup({ loading: false });
      return;
    }
    setReserveLookup({ loading: true });
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/${reserveFormId}`);
        if (res.ok) {
          const data = await res.json();
          setReserveLookup({ username: data.globalName || data.username, loading: false });
        } else {
          setReserveLookup({ username: undefined, loading: false });
        }
      } catch {
        setReserveLookup({ loading: false });
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [reserveFormId]);

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
  const hasValidationErrors =
    dailyReward.min > dailyReward.max ||
    dailyReward.cooldown <= 0 ||
    salary.cooldown <= 0 ||
    vipReward.cooldown <= 0 ||
    stealSystem.max_percentage < stealSystem.min_percentage;

  const configDiff = hasChanges ? [
    ...computeConfigDiff(
      { daily_reward: dailyRewardOriginal, salary: salaryOriginal, vip_reward: vipRewardOriginal, investment: investmentOriginal, steal_system: stealSystemOriginal, trade_settings: tradeSettingsOriginal, insurance: insuranceOriginal },
      { daily_reward: dailyReward, salary, vip_reward: vipReward, investment, steal_system: stealSystem, trade_settings: tradeSettings, insurance },
    ),
  ] : [];

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

  function handleDiscard() {
    setDailyReward(dailyRewardOriginal);
    setSalary(salaryOriginal);
    setVipReward(vipRewardOriginal);
    setLoanTiers(loanTiersOriginal);
    setInvestment(investmentOriginal);
    setStealSystem(stealSystemOriginal);
    setTradeSettings(tradeSettingsOriginal);
    setInsurance(insuranceOriginal);
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
          <h1 className="admin-page-title"><span className="emoji-float">🏦</span> Banking</h1>
          <p className="admin-page-subtitle">Rewards, loans, investments, theft, and banking overview</p>
        </div>
        <SkeletonCard count={3} />
        <SkeletonTable rows={5} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🏦</span> Banking</h1>
        <p className="admin-page-subtitle">Rewards, loans, investments, theft, and banking overview</p>
      </div>

      {configMetadata.updatedAt && (
        <div className="admin-last-updated">
          Last updated {timeAgo(configMetadata.updatedAt)} by {configMetadata.updatedBy || 'Unknown'}
        </div>
      )}

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
        <button
          className={`admin-tab ${tab === 'reserve' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('reserve')}
        >
          Luna Reserve
        </button>
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && (
        <>
          <ConfigSection title="Daily Reward" description="Lunari earned from the daily command">
            <div className="admin-config-grid">
              <NumberInput label="💰 Minimum" value={dailyReward.min} onChange={(v) => setDailyReward({ ...dailyReward, min: v })} min={0} description="Smallest amount of Lunari per claim" />
              <NumberInput label="💰 Maximum" value={dailyReward.max} onChange={(v) => setDailyReward({ ...dailyReward, max: v })} min={0} description="Largest amount of Lunari per claim" />
              <DurationInput label="⏱️ Cooldown" value={dailyReward.cooldown} onChange={(v) => setDailyReward({ ...dailyReward, cooldown: v })} description="Time between claims" />
            </div>
            {dailyReward.min > dailyReward.max && (
              <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '8px' }}>
                Minimum must be less than or equal to Maximum
              </div>
            )}
            {dailyReward.cooldown <= 0 && (
              <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '8px' }}>
                Cooldown must be greater than 0
              </div>
            )}
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Salary" description="Monthly payment for active staff members">
            <div className="admin-config-grid">
              <NumberInput label="💰 Amount" value={salary.amount} onChange={(v) => setSalary({ ...salary, amount: v })} min={0} description="Lunari paid per salary claim" />
              <DurationInput label="⏱️ Cooldown" value={salary.cooldown} onChange={(v) => setSalary({ ...salary, cooldown: v })} description="Time between salary payments" />
            </div>
            {salary.cooldown <= 0 && (
              <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '8px' }}>
                Cooldown must be greater than 0
              </div>
            )}
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', color: 'var(--text-muted)' }}>
              Salary-eligible roles are configured in <a href="/admin/settings" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Settings → Butler Roles → Economy Roles</a> (Staff, Special, and Booster roles).
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="VIP Reward" description="Extra daily reward for VIP members">
            <div className="admin-config-grid">
              <NumberInput label="💰 Amount" value={vipReward.amount} onChange={(v) => setVipReward({ ...vipReward, amount: v })} min={0} description="Lunari per VIP claim" />
              <DurationInput label="⏱️ Cooldown" value={vipReward.cooldown} onChange={(v) => setVipReward({ ...vipReward, cooldown: v })} description="Time between VIP claims" />
            </div>
            {vipReward.cooldown <= 0 && (
              <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '8px' }}>
                Cooldown must be greater than 0
              </div>
            )}
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection
            title="Loan Tiers"
            description="Loan options available to users. Higher levels unlock larger loans."
          >
            <ConfigTable
              columns={[
                { key: 'level', label: '🔢 Required Level', type: 'number', width: '120px' },
                { key: 'amount', label: '💰 Loan Amount (Lunari)', type: 'number' },
                { key: 'interest', label: '📊 Interest Rate', type: 'number' },
                { key: 'duration', label: '⏱️ Repayment Time', type: 'duration' },
              ]}
              rows={loanTiers}
              onChange={(rows) => setLoanTiers(rows as LoanTier[])}
              addLabel="Add Loan Tier"
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Interest Rate: 0.20 = 20%
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection
            title="Investment"
            description="Users can invest Lunari and earn profit after a maturity period"
          >
            <PercentInput
              label="📊 Profit Rate"
              value={investment.profit_rate}
              onChange={(v) => setInvestment({ ...investment, profit_rate: v })}
              description="Percentage profit on matured investments (30% = invest 10k, get 13k)"
            />
            <NumberInput
              label="💰 Minimum Investment"
              value={investment.min_amount}
              onChange={(v) => setInvestment({ ...investment, min_amount: v })}
              min={0}
              description="Minimum Lunari required to start an investment"
            />
            <DurationInput
              label="⏱️ Maturity Period"
              value={investment.maturity_period}
              onChange={(v) => setInvestment({ ...investment, maturity_period: v })}
              description="How long until investment matures and can be collected"
            />
            <NumberInput
              label="💰 Early Withdrawal Fee"
              value={investment.early_withdrawal_fee}
              onChange={(v) => setInvestment({ ...investment, early_withdrawal_fee: v })}
              min={0}
              description="Lunari penalty for withdrawing before maturity"
            />
            <DurationInput
              label="⏱️ Check Interval"
              value={investment.check_interval}
              onChange={(v) => setInvestment({ ...investment, check_interval: v })}
              description="How often the bot checks for matured investments"
            />
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection
            title="Steal System"
            description="Players can attempt to steal a percentage of another player's Lunari"
          >
            <ToggleSwitch
              label="⚡ Enabled"
              checked={stealSystem.enabled}
              onChange={(v) => setStealSystem({ ...stealSystem, enabled: v })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
              <NumberInput
                label="📊 Min Steal %"
                value={stealSystem.min_percentage}
                onChange={(v) => setStealSystem({ ...stealSystem, min_percentage: v })}
                min={0}
                max={100}
                description="Minimum percentage of target's balance that can be stolen"
              />
              <NumberInput
                label="📊 Max Steal %"
                value={stealSystem.max_percentage}
                onChange={(v) => setStealSystem({ ...stealSystem, max_percentage: v })}
                min={0}
                max={100}
                description="Maximum percentage of target's balance that can be stolen"
              />
              <DurationInput
                label="⏱️ Cooldown"
                value={stealSystem.cooldown}
                onChange={(v) => setStealSystem({ ...stealSystem, cooldown: v })}
                description="Time between steal attempts"
              />
            </div>
            {stealSystem.max_percentage < stealSystem.min_percentage && (
              <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '8px' }}>
                Max must be greater than min
              </div>
            )}
            <RolePicker
              label="🛡️ Required Roles"
              description="Only users with at least one of these roles can use the steal command. Leave empty to allow everyone."
              value={stealSystem.required_roles ?? []}
              onChange={(v) => setStealSystem({ ...stealSystem, required_roles: v })}
              multi
            />

            {/* Embed Images */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Embed Images</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                <ImagePicker
                  label="🖼️ Success Image"
                  description="Image shown on successful steal"
                  value={stealSystem.success_image ?? ''}
                  onChange={(url) => setStealSystem({ ...stealSystem, success_image: url })}
                  uploadPrefix="butler/misc/"
                  defaultUrl="https://assets.lunarian.app/butler/misc/steal-image.png"
                />
                <ImagePicker
                  label="🖼️ Fail Image"
                  description="Image shown when steal is blocked by insurance"
                  value={stealSystem.fail_image ?? ''}
                  onChange={(url) => setStealSystem({ ...stealSystem, fail_image: url })}
                  uploadPrefix="butler/misc/"
                  defaultUrl="https://assets.lunarian.app/butler/misc/steal-failed.png"
                />
              </div>
            </div>

            {/* Embed Text */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Embed Text (Arabic)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">✏️ Success Title</label>
                  <input
                    className="admin-form-input"
                    dir="auto"
                    value={stealSystem.success_title ?? ''}
                    onChange={(e) => setStealSystem({ ...stealSystem, success_title: e.target.value })}
                    placeholder="عملية سرقة ناجحة!"
                    maxLength={256}
                  />
                  <span className="admin-form-description">Title of the success embed</span>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">✏️ Fail Title</label>
                  <input
                    className="admin-form-input"
                    dir="auto"
                    value={stealSystem.fail_title ?? ''}
                    onChange={(e) => setStealSystem({ ...stealSystem, fail_title: e.target.value })}
                    placeholder="محاولة سرقة فاشلة!"
                    maxLength={256}
                  />
                  <span className="admin-form-description">Title of the insurance-blocked embed</span>
                </div>
              </div>
              <div className="admin-form-group" style={{ marginTop: '12px' }}>
                <label className="admin-form-label">✏️ Success Footer</label>
                <input
                  className="admin-form-input"
                  dir="auto"
                  value={stealSystem.success_footer ?? ''}
                  onChange={(e) => setStealSystem({ ...stealSystem, success_footer: e.target.value })}
                  placeholder="يمكنك السرقة مرة أخرى بعد 24 ساعة"
                  maxLength={256}
                />
                <span className="admin-form-description">Footer text on success embed</span>
              </div>
              <div className="admin-form-group" style={{ marginTop: '12px' }}>
                <label className="admin-form-label">📝 Fail Description</label>
                <textarea
                  className="admin-form-input"
                  dir="auto"
                  rows={3}
                  value={stealSystem.fail_description ?? ''}
                  onChange={(e) => setStealSystem({ ...stealSystem, fail_description: e.target.value })}
                  placeholder="{thief} حاول سرقة {target} لكنه يملك تأمين ضد السرقة!"
                  maxLength={1000}
                  style={{ resize: 'vertical' }}
                />
                <span className="admin-form-description">Use {'{thief}'} and {'{target}'} as placeholders for mentions</span>
              </div>
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Trade Settings" description="Lunari trading game parameters">
            <div className="admin-config-grid">
              <NumberInput label="💰 Max Trade Amount" value={tradeSettings.max_amount} onChange={(v) => setTradeSettings({ ...tradeSettings, max_amount: v })} min={0} description="Maximum Lunari that can be traded at once" />
              <PercentInput label="📊 Win Chance" value={tradeSettings.win_chance} onChange={(v) => setTradeSettings({ ...tradeSettings, win_chance: v })} description="Probability of winning a trade (50% = coin flip)" />
              <PercentInput label="📊 Win Multiplier" value={tradeSettings.win_rate} onChange={(v) => setTradeSettings({ ...tradeSettings, win_rate: v })} description="Profit percentage on win (20% = trade 10k, win 12k)" />
              <PercentInput label="📊 Loss Multiplier" value={tradeSettings.loss_rate} onChange={(v) => setTradeSettings({ ...tradeSettings, loss_rate: v })} description="Loss percentage on loss (30% = trade 10k, lose 3k)" />
              <DurationInput label="⏱️ Cooldown" value={tradeSettings.cooldown} onChange={(v) => setTradeSettings({ ...tradeSettings, cooldown: v })} description="Time between trades" />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Insurance" description="Theft protection cost">
            <div className="admin-config-grid">
              <NumberInput label="💰 Theft Protection Cost" value={insurance.cost} onChange={(v) => setInsurance({ ...insurance, cost: v })} min={0} description="Lunari cost for lifetime theft protection" />
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={hasChanges}
            saving={saving}
            onSave={saveConfig}
            onDiscard={handleDiscard}
            projectName="Butler"
            validationErrors={hasValidationErrors}
            diff={configDiff}
          />
        </>
      )}

      {/* Loans Tab */}
      {tab === 'loans' && (
        <>
          {loansLoading || !loansFetched ? (
            <SkeletonTable rows={5} />
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
                            : <span style={{ color: daysLeft <= 1 ? '#facc15' : 'var(--text-muted)' }}> {daysLeft <= 0 ? '(Due today)' : daysLeft === 1 ? '(< 1d left)' : `(${daysLeft}d left)`}</span>
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
                              onClick={() => setPendingAbsolve({ discordId: loan.discordId, name: loan.username || loan.discordId, amount: loan.repaymentAmount ?? 0 })}
                            >
                              {loanActionLoading === `absolve_${loan.discordId}` ? '...' : 'Absolve'}
                            </button>
                            {inlineEdit?.discordId === loan.discordId ? (() => {
                              const edit = inlineEdit!;
                              return (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  className="admin-input"
                                  style={{ width: 100, padding: '2px 6px', fontSize: 11 }}
                                  type="number"
                                  min={edit.type === 'extend' ? 1 : 0}
                                  value={edit.value}
                                  onChange={(e) => setInlineEdit({ ...edit, value: e.target.value })}
                                  placeholder={edit.type === 'reduce' ? 'Amount' : 'Days'}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setInlineEdit(null);
                                    if (e.key === 'Enter') {
                                      const v = parseInt(edit.value, 10);
                                      if (isNaN(v) || v < 0) return;
                                      if (edit.type === 'reduce' && v > (loan.repaymentAmount ?? loan.amount)) return;
                                      if (edit.type === 'extend' && v > 365) return;
                                      if (edit.type === 'reduce') {
                                        handleLoanAction('reduce', loan.discordId, { newAmount: v, reason: 'Admin reduced' });
                                      } else {
                                        handleLoanAction('extend', loan.discordId, { newDueDate: Date.now() + v * 86_400_000, reason: `Extended by ${v} days` });
                                      }
                                      setInlineEdit(null);
                                    }
                                  }}
                                />
                                <button className="admin-btn admin-btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => {
                                  const v = parseInt(edit.value, 10);
                                  if (isNaN(v) || v < 0) return;
                                  if (edit.type === 'reduce' && v > (loan.repaymentAmount ?? loan.amount)) return;
                                  if (edit.type === 'extend' && v > 365) return;
                                  if (edit.type === 'reduce') {
                                    handleLoanAction('reduce', loan.discordId, { newAmount: v, reason: 'Admin reduced' });
                                  } else {
                                    handleLoanAction('extend', loan.discordId, { newDueDate: Date.now() + v * 86_400_000, reason: `Extended by ${v} days` });
                                  }
                                  setInlineEdit(null);
                                }}>OK</button>
                                <button className="admin-btn admin-btn-ghost" style={{ padding: '2px 6px', fontSize: 10, color: '#f43f5e' }} onClick={() => setInlineEdit(null)}>Cancel</button>
                              </div>
                              );
                            })() : (
                              <>
                                <button className="admin-btn admin-btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} disabled={!!loanActionLoading} onClick={() => setInlineEdit({ type: 'reduce', discordId: loan.discordId, value: '' })}>Reduce</button>
                                <button className="admin-btn admin-btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} disabled={!!loanActionLoading} onClick={() => setInlineEdit({ type: 'extend', discordId: loan.discordId, value: '' })}>Extend</button>
                              </>
                            )}
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
            <SkeletonCard count={4} />
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

      {/* Luna Reserve Tab */}
      {tab === 'reserve' && (
        <>
          {reserveLoading ? (
            <SkeletonCard count={1} />
          ) : (
            <>
              {/* Reserve balance card */}
              <div className="admin-stats-grid" style={{ gridTemplateColumns: '1fr' }}>
                <StatCard
                  label="Luna Reserve"
                  value={reserveBalance}
                  icon="B"
                  color="gold"
                  tooltip="Central bank reserve — used to fund user rewards, events, and manual distributions"
                  trend={`${reserveBalance.toLocaleString()} Lunari available for withdrawal`}
                />
              </div>

              {/* Withdrawal form */}
              <div className="admin-stat-card" style={{ marginTop: '16px' }}>
                <h3 className="admin-section-title">Withdraw from Reserve</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Transfer Lunari from the bank reserve to a user account.
                </p>

                <div style={{ display: 'grid', gap: '12px', maxWidth: '480px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Discord ID</label>
                    <input
                      className="admin-form-input"
                      type="text"
                      placeholder="e.g. 123456789012345678"
                      value={reserveFormId}
                      onChange={(e) => {
                        setReserveFormId(e.target.value.replace(/\D/g, ''));
                        setReserveResult(null);
                      }}
                      maxLength={20}
                    />
                    {reserveLookup.loading && (
                      <span className="admin-form-description">Looking up user...</span>
                    )}
                    {!reserveLookup.loading && reserveLookup.username && (
                      <span className="admin-form-description" style={{ color: 'var(--common)' }}>
                        Found: {reserveLookup.username}
                      </span>
                    )}
                    {!reserveLookup.loading && /^\d{17,20}$/.test(reserveFormId) && !reserveLookup.username && (
                      <span className="admin-form-description" style={{ color: 'var(--accent-legendary)' }}>
                        User not found (will create new balance)
                      </span>
                    )}
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Amount</label>
                    <input
                      className="admin-form-input"
                      type="number"
                      placeholder="Amount of Lunari"
                      value={reserveFormAmount}
                      onChange={(e) => {
                        setReserveFormAmount(e.target.value);
                        setReserveResult(null);
                      }}
                      min={1}
                      max={10_000_000}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Reason</label>
                    <input
                      className="admin-form-input"
                      type="text"
                      placeholder="Why is this withdrawal being made?"
                      value={reserveFormReason}
                      onChange={(e) => {
                        setReserveFormReason(e.target.value);
                        setReserveResult(null);
                      }}
                      maxLength={500}
                    />
                  </div>

                  {/* Preview */}
                  {(() => {
                    const amt = parseInt(reserveFormAmount, 10);
                    if (amt > 0 && amt <= reserveBalance) {
                      return (
                        <div style={{
                          padding: '10px 14px',
                          background: 'rgba(255, 213, 79, 0.05)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 213, 79, 0.15)',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                        }}>
                          Reserve: {reserveBalance.toLocaleString()} &rarr; {(reserveBalance - amt).toLocaleString()}
                          <span style={{ color: '#f43f5e', marginLeft: '6px' }}>(-{amt.toLocaleString()})</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {reserveResult && (
                    <p className={`admin-inline-result ${reserveResult.type === 'error' ? 'error' : 'success'}`}>
                      {reserveResult.message}
                    </p>
                  )}

                  <button
                    className={`admin-btn admin-btn-primary ${reserveSubmitting ? 'admin-btn-loading' : ''}`}
                    disabled={
                      reserveSubmitting ||
                      !/^\d{17,20}$/.test(reserveFormId) ||
                      !reserveFormAmount ||
                      parseInt(reserveFormAmount, 10) <= 0 ||
                      !reserveFormReason ||
                      reserveFormReason.trim().length < 3
                    }
                    onClick={async () => {
                      setReserveSubmitting(true);
                      setReserveResult(null);
                      try {
                        const res = await fetch('/api/admin/banking/reserve', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
                          body: JSON.stringify({
                            discordId: reserveFormId,
                            amount: parseInt(reserveFormAmount, 10),
                            reason: reserveFormReason.trim(),
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setReserveResult({ type: 'error', message: data.error || 'Withdrawal failed' });
                        } else {
                          setReserveResult({
                            type: 'success',
                            message: `Withdrew ${parseInt(reserveFormAmount, 10).toLocaleString()} Lunari. Reserve: ${data.reserveAfter.toLocaleString()}`,
                          });
                          setReserveBalance(data.reserveAfter);
                          setReserveFormId('');
                          setReserveFormAmount('');
                          setReserveFormReason('');
                          fetchReserve();
                        }
                      } catch {
                        setReserveResult({ type: 'error', message: 'Network error' });
                      } finally {
                        setReserveSubmitting(false);
                      }
                    }}
                  >
                    {reserveSubmitting ? 'Withdrawing...' : 'Withdraw from Reserve'}
                  </button>
                </div>
              </div>

              {/* Recent withdrawals table */}
              {reserveWithdrawals.length > 0 && (
                <div className="admin-stat-card" style={{ marginTop: '16px' }}>
                  <h3 className="admin-section-title">Recent Withdrawals</h3>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Recipient</th>
                          <th>Amount</th>
                          <th>Reason</th>
                          <th>Admin</th>
                          <th>Reserve After</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reserveWithdrawals.map((w: any) => (
                          <tr key={w._id}>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                {w.recipientName && <span style={{ fontWeight: 600, fontSize: '13px' }}>{w.recipientName}</span>}
                                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>{w.discordId}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--common)' }}>+{w.amount?.toLocaleString()}</td>
                            <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.reason || '\u2014'}</td>
                            <td style={{ fontSize: '13px' }}>{w.adminName || '\u2014'}</td>
                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{w.reserveAfter?.toLocaleString() ?? '\u2014'}</td>
                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {w.timestamp ? new Date(w.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '\u2014'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {pendingAbsolve && (
        <ConfirmModal
          title="Absolve Loan"
          message={`Absolve ${pendingAbsolve.name}'s loan of ${pendingAbsolve.amount.toLocaleString()} Lunari? This cannot be undone.`}
          confirmLabel="Absolve"
          variant="danger"
          onConfirm={() => {
            handleLoanAction('absolve', pendingAbsolve.discordId, { reason: 'Admin absolved' });
            setPendingAbsolve(null);
          }}
          onCancel={() => setPendingAbsolve(null)}
        />
      )}
    </>
  );
}
