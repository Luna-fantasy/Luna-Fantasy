'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Lightbox } from '@/components/Lightbox';
import { useBankData } from '@/hooks/useBankData';
import { dispatchBalanceUpdate } from '@/lib/balance-events';
import { BalanceSummary } from './BalanceSummary';
import { DailyClaimCard } from './DailyClaimCard';
import { MonthlySalaryCard } from './MonthlySalaryCard';
import { LoanManager } from './LoanManager';
import { InvestmentTracker } from './InvestmentTracker';
import type { BankDashboardData } from '@/types/bank';

// ── Static types for logged-out view ──

interface LocalizedString {
  en: string;
  ar: string;
}

interface SpecialRole {
  role: LocalizedString;
  command: string | null;
  description: LocalizedString | null;
}

interface VipBenefit {
  icon: string;
  text: LocalizedString;
}

interface BankStaticData {
  salary: {
    daily: { basePay: number; vipBonus: number; resetTimer: string };
    monthly: {
      amount: number;
      eligibleRoles: { staff: LocalizedString[]; special: SpecialRole[] };
    };
  };
  loans: {
    interestRate: number;
    vipInterestRate: number;
    deadline: number;
    tiers: number[];
  };
  trading: {
    maxLimit: number;
    winChance: number;
    lossPenalty: number;
    levelRequired: number;
    cooldown: string;
  };
  insurance: { theftProtection: { cost: number; effect: LocalizedString } };
  vip: { depositRequirement: number; benefits: VipBenefit[] };
}

interface BankContentProps {
  data: BankStaticData;
  locale: 'en' | 'ar';
}

// ── Helpers ──

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

async function bankFetch(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

const formatNumber = (num: number): string => {
  if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
  return num.toLocaleString();
};

const formatFullNumber = (num: number): string => num.toLocaleString();

// ── Result Banner ──

interface ResultBannerProps {
  result: { type: 'success' | 'error'; message: string } | null;
  onDismiss: () => void;
}

function ResultBanner({ result, onDismiss }: ResultBannerProps) {
  if (!result) return null;
  return (
    <div className={`bank-result-banner ${result.type}`} onClick={onDismiss}>
      <span>{result.message}</span>
      <button className="bank-result-close" onClick={onDismiss}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ── Dashboard (logged-in) ──

function BankDashboard({ bankData, locale, refetch, session }: { bankData: BankDashboardData; locale: 'en' | 'ar'; refetch: () => Promise<void>; session: any }) {
  const t = useTranslations('bankPage');
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showResult = useCallback((type: 'success' | 'error', message: string) => {
    setResult({ type, message });
    setTimeout(() => setResult(null), 5000);
  }, []);

  const handleDaily = async () => {
    try {
      const data = await bankFetch('/api/bank/daily', 'POST');
      dispatchBalanceUpdate(data.newBalance);
      showResult('success', `+${data.amount.toLocaleString()}${data.vipBonus ? ` (+${data.vipBonus.toLocaleString()} VIP)` : ''} ${t('currency')}`);
      await refetch();
    } catch (err: any) {
      showResult('error', err.message);
    }
  };

  const handleTakeLoan = async (tier: number) => {
    try {
      const data = await bankFetch('/api/bank/loan', 'POST', { tier, isVip });
      dispatchBalanceUpdate(data.newBalance);
      showResult('success', `${t('loanAction.loanGranted')} +${tier.toLocaleString()} ${t('currency')}`);
      await refetch();
    } catch (err: any) {
      showResult('error', err.message);
    }
  };

  const handleRepayLoan = async () => {
    try {
      const data = await bankFetch('/api/bank/loan', 'PATCH', {});
      dispatchBalanceUpdate(data.newBalance);
      showResult('success', t('loanAction.loanRepaid'));
      await refetch();
    } catch (err: any) {
      showResult('error', err.message);
    }
  };

  const handleDeposit = async (amount: number) => {
    try {
      const data = await bankFetch('/api/bank/investment', 'POST', { amount });
      dispatchBalanceUpdate(data.newBalance);
      showResult('success', `${t('investAction.deposited')} ${amount.toLocaleString()} ${t('currency')}`);
      await refetch();
    } catch (err: any) {
      showResult('error', err.message);
    }
  };

  const handleWithdraw = async () => {
    try {
      const data = await bankFetch('/api/bank/investment', 'DELETE', {});
      dispatchBalanceUpdate(data.newBalance);
      const msg = data.early
        ? `${t('investAction.withdrawnEarly')} ${data.payout.toLocaleString()} ${t('currency')}`
        : `${t('investAction.withdrawnMature')} ${data.payout.toLocaleString()} ${t('currency')} (+${data.profit.toLocaleString()})`;
      showResult('success', msg);
      await refetch();
    } catch (err: any) {
      showResult('error', err.message);
    }
  };

  // Determine VIP status: has active investment with >= 20K
  const isVip = bankData.roles.isVip || (!!bankData.investment && bankData.investment.amount >= 20_000);

  return (
    <div className="bank-dashboard">
      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <BalanceSummary
        balance={bankData.balance}
        debt={bankData.debt}
        level={bankData.level}
      />

      {/* Salary Section */}
      <section className="bank-section">
        <div className="bank-section-header">
          <div className="bank-section-icon salary-icon"></div>
          <h2 className="bank-section-title">{t('salary.title')}</h2>
        </div>
        <div className="salary-grid">
          <DailyClaimCard
            lastClaimed={bankData.cooldowns.daily}
            isVip={isVip}
            onClaim={handleDaily}
            disabled={bankData.debt > 0}
          />
          <MonthlySalaryCard
            roles={bankData.roles}
            locale={locale}
          />
        </div>
      </section>

      {/* Loan Section */}
      <LoanManager
        activeLoan={bankData.activeLoan}
        level={bankData.level}
        debt={bankData.debt}
        isVip={isVip}
        balance={bankData.balance}
        userName={session?.user?.globalName || session?.user?.name || session?.user?.username}
        userAvatar={session?.user?.image}
        onTakeLoan={handleTakeLoan}
        onRepayLoan={handleRepayLoan}
      />

      {/* Investment Section */}
      <InvestmentTracker
        investment={bankData.investment}
        balance={bankData.balance}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
      />

    </div>
  );
}

// ── Static Info (logged-out) ──

function BankInfoSections({ data, locale }: { data: BankStaticData; locale: 'en' | 'ar' }) {
  const t = useTranslations('bankPage');
  const [isLoanImageOpen, setIsLoanImageOpen] = useState(false);

  return (
    <>
      <div className="bank-sections">
        {/* Salary Section */}
        <section className="bank-section">
          <div className="bank-section-header">
            <div className="bank-section-icon salary-icon"></div>
            <h2 className="bank-section-title">{t('salary.title')}</h2>
          </div>
          <div className="salary-grid">
            <div className="salary-card">
              <div className="salary-card-header">
                <span className="salary-card-title">{t('salary.daily.title')}</span>
                <div className="salary-timer">
                  <span className="timer-icon"></span>
                  <span>{t('salary.daily.resetTimer')}</span>
                </div>
              </div>
              <p className="salary-desc">{t('salary.daily.desc')}</p>
              <div className="salary-amount">
                <span className="salary-value">{formatFullNumber(data.salary.daily.basePay)}</span>
                <span className="salary-currency">{t('currency')}</span>
              </div>
              <div className="salary-bonus">
                <span className="bonus-icon">+</span>
                <span>{t('salary.daily.vipBonus')}: +{formatFullNumber(data.salary.daily.vipBonus)} {t('currency')}</span>
              </div>
              <p className="vip-note">
                {t('salary.daily.vipNote')}{' '}
                <a href="#vip-section" className="vip-note-link">{t('vip.actionBtn')}</a>
              </p>
              <a href="https://discord.com/channels/1243327880478462032/1450597284600615062" target="_blank" rel="noopener noreferrer" className="section-action-btn">
                {t('salary.daily.claimBtn')}
              </a>
            </div>
            <div className="salary-card">
              <div className="salary-card-header">
                <span className="salary-card-title">{t('salary.monthly.title')}</span>
              </div>
              <p className="salary-desc">{t('salary.monthly.desc')}</p>
              <div className="salary-amount">
                <span className="salary-value">{formatFullNumber(data.salary.monthly.amount)}</span>
                <span className="salary-currency">{t('currency')}</span>
              </div>
              <div className="eligible-roles">
                <div className="roles-category">
                  <div className="roles-category-title">{t('salary.monthly.staffRoles')}</div>
                  <div className="roles-list">
                    {data.salary.monthly.eligibleRoles.staff.map((role, i) => (
                      <span key={i} className="role-badge">{role[locale]}</span>
                    ))}
                  </div>
                </div>
                <div className="roles-category">
                  <div className="roles-category-title">{t('salary.monthly.specialRoles')}</div>
                  <div className="roles-list special-roles-list">
                    {data.salary.monthly.eligibleRoles.special.map((item, i) => (
                      <div key={i} className="role-badge-wrapper">
                        <span className="role-badge special">
                          {item.role[locale]}
                          {item.command && <span className="role-command">{item.command}</span>}
                        </span>
                        {item.description && <span className="role-description">{item.description[locale]}</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="roles-tip">{t('salary.monthly.tip')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Loan Section */}
        <section className="bank-section loan-section-with-image">
          <div className="loan-section-content">
            <div className="bank-section-header">
              <div className="bank-section-icon loan-icon"></div>
              <h2 className="bank-section-title">{t('loans.title')}</h2>
            </div>
            <p className="section-desc">{t('loans.desc')}</p>
            <div className="loan-overview">
              <div className="loan-stat">
                <div className="loan-stat-label">{t('loans.interest')}</div>
                <div className="loan-stat-value interest">{data.loans.interestRate}%</div>
              </div>
              <div className="loan-stat">
                <div className="loan-stat-label">{t('loans.vipInterest')}</div>
                <div className="loan-stat-value vip">{data.loans.vipInterestRate}%</div>
              </div>
              <div className="loan-stat">
                <div className="loan-stat-label">{t('loans.deadline')}</div>
                <div className="loan-stat-value deadline">{data.loans.deadline} {t('loans.days')}</div>
              </div>
            </div>
            <div className="loan-tiers-title">{t('loans.tiers')}</div>
            <div className="loan-tiers-grid">
              {data.loans.tiers.map((tier, i) => (
                <div key={i} className="loan-tier">{formatNumber(tier)}</div>
              ))}
            </div>
            <a href="https://discord.com/channels/1243327880478462032/1450597284600615062" target="_blank" rel="noopener noreferrer" className="section-action-btn">
              {t('loans.actionBtn')}
            </a>
          </div>
          <div className="loan-image-container" onClick={() => setIsLoanImageOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setIsLoanImageOpen(true)}>
            <Image src="/images/loan_contract.png" alt="Loan Contract" width={300} height={400} className="loan-contract-image" />
          </div>
        </section>

        {/* Insurance & VIP Section */}
        <section id="vip-section" className="bank-section">
          <div className="bank-section-header">
            <div className="bank-section-icon services-icon"></div>
            <h2 className="bank-section-title">{t('insurance.title')}</h2>
          </div>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-card-header">
                <span className="service-card-icon protection-icon"></span>
                <span className="service-card-title">{t('insurance.theftProtection')}</span>
              </div>
              <p className="service-desc">{t('insurance.theftDesc')}</p>
              <div className="service-detail">
                <span className="service-detail-label">{t('insurance.cost')}</span>
                <span className="service-detail-value cost">{formatFullNumber(data.insurance.theftProtection.cost)} {t('currency')}</span>
              </div>
              <div className="service-detail">
                <span className="service-detail-label">{t('insurance.effect')}</span>
                <span className="service-detail-value effect">{data.insurance.theftProtection.effect[locale]}</span>
              </div>
              <a href="https://discord.com/channels/1243327880478462032/1450597284600615062" target="_blank" rel="noopener noreferrer" className="section-action-btn small">
                {t('insurance.actionBtn')}
              </a>
            </div>
            <div className="service-card vip-card">
              <div className="service-card-header">
                <span className="service-card-icon vip-icon"></span>
                <span className="service-card-title">{t('vip.title')}</span>
              </div>
              <p className="service-desc">{t('vip.desc')}</p>
              <div className="vip-how-to">
                <div className="vip-how-to-label">{t('vip.howToJoin')}</div>
                <div className="vip-how-to-value">{formatFullNumber(data.vip.depositRequirement)}+ {t('currency')}</div>
              </div>
              <div className="vip-benefits-title">{t('vip.benefits')}</div>
              <div className="vip-benefits-list">
                {data.vip.benefits.map((benefit, i) => (
                  <div key={i} className="vip-benefit">
                    <span className="vip-benefit-icon benefit-icon"></span>
                    <span className="vip-benefit-text">{benefit.text[locale]}</span>
                  </div>
                ))}
              </div>
              <a href="https://discord.com/channels/1243327880478462032/1450597284600615062" target="_blank" rel="noopener noreferrer" className="section-action-btn small vip">
                {t('vip.actionBtn')}
              </a>
            </div>
          </div>
        </section>
      </div>

      <Lightbox isOpen={isLoanImageOpen} imageSrc="/images/loan_contract.png" alt="Loan Contract" onClose={() => setIsLoanImageOpen(false)} />
    </>
  );
}

// ── Main Component ──

export function BankContent({ data, locale }: BankContentProps) {
  const t = useTranslations('bankPage');
  const { data: session } = useSession();
  const { data: bankData, isLoading, error, refetch } = useBankData();
  const isLoggedIn = !!session?.user;

  return (
    <main>
      {/* Hero Section */}
      <section className="bank-hero">
        <div className="bank-hero-bg">
          <Image src="/images/hero-bank.jpeg" alt="Luna Bank" fill priority className="bank-hero-bg-image" />
        </div>
        <div className="bank-hero-content">
          <h1 className="bank-hero-title">{t('title')}</h1>
          <p className="bank-hero-desc">{t('subtitle')}</p>
          {!isLoggedIn && (
            <div className="bank-hero-cta">
              <a href="https://discord.com/channels/1243327880478462032/1450597284600615062" target="_blank" rel="noopener noreferrer" className="cta-discord">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                {t('cta')}
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="wrap">
        {isLoggedIn && isLoading && (
          <div className="bank-loading">
            <div className="bank-loading-spinner" />
            <span>{t('dashboard.loading')}</span>
          </div>
        )}

        {isLoggedIn && error && !isLoading && (
          <div className="bank-error">
            <p>{error}</p>
            <button className="section-action-btn" onClick={refetch}>
              {t('dashboard.retry')}
            </button>
          </div>
        )}

        {isLoggedIn && bankData && (
          <BankDashboard bankData={bankData} locale={locale} refetch={refetch} session={session} />
        )}

        {!isLoggedIn && (
          <BankInfoSections data={data} locale={locale} />
        )}
      </div>
    </main>
  );
}
