'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Image from 'next/image';
import { Lightbox } from '@/components/Lightbox';

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

interface BankData {
  salary: {
    daily: {
      basePay: number;
      vipBonus: number;
      resetTimer: string;
    };
    monthly: {
      amount: number;
      eligibleRoles: {
        staff: LocalizedString[];
        special: SpecialRole[];
      };
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
  insurance: {
    theftProtection: {
      cost: number;
      effect: LocalizedString;
    };
  };
  vip: {
    depositRequirement: number;
    benefits: VipBenefit[];
  };
}

interface BankContentProps {
  data: BankData;
  locale: 'en' | 'ar';
}

const formatNumber = (num: number): string => {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return num.toLocaleString();
};

const formatFullNumber = (num: number): string => {
  return num.toLocaleString();
};

export function BankContent({ data, locale }: BankContentProps) {
  const t = useTranslations('bankPage');
  const [isLoanImageOpen, setIsLoanImageOpen] = useState(false);

  return (
    <main>
      {/* Hero Section */}
      <section className="bank-hero">
        <div className="bank-hero-bg">
          <Image
            src="/images/hero-bank.jpeg"
            alt="Luna Bank"
            fill
            priority
            className="bank-hero-bg-image"
          />
        </div>
        <div className="bank-hero-content">
          <div className="bank-hero-badge">
            <span>{t('title')}</span>
          </div>
          <h1 className="bank-hero-title">{t('title')}</h1>
          <p className="bank-hero-desc">{t('subtitle')}</p>
          <div className="bank-hero-cta">
            <a
              href="https://discord.gg/lunarian"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-discord"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              {t('cta')}
            </a>
          </div>
        </div>
      </section>

      {/* Bank Sections */}
      <div className="wrap">
        <div className="bank-sections">
          {/* Salary Section */}
          <section className="bank-section">
            <div className="bank-section-header">
              <div className="bank-section-icon salary-icon"></div>
              <h2 className="bank-section-title">{t('salary.title')}</h2>
            </div>

            <div className="salary-grid">
              {/* Daily Salary Card */}
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
                <p className="vip-note">{t('salary.daily.vipNote')}</p>
                <a
                  href="https://discord.gg/lunarian"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="section-action-btn"
                >
                  {t('salary.daily.claimBtn')}
                </a>
              </div>

              {/* Monthly Salary Card */}
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
                  {/* Staff Roles */}
                  <div className="roles-category">
                    <div className="roles-category-title">{t('salary.monthly.staffRoles')}</div>
                    <div className="roles-list">
                      {data.salary.monthly.eligibleRoles.staff.map((role, index) => (
                        <span key={index} className="role-badge">
                          {role[locale]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Special Roles */}
                  <div className="roles-category">
                    <div className="roles-category-title">{t('salary.monthly.specialRoles')}</div>
                    <div className="roles-list special-roles-list">
                      {data.salary.monthly.eligibleRoles.special.map((item, index) => (
                        <div key={index} className="role-badge-wrapper">
                          <span className="role-badge special">
                            {item.role[locale]}
                            {item.command && (
                              <span className="role-command">{item.command}</span>
                            )}
                          </span>
                          {item.description && (
                            <span className="role-description">{item.description[locale]}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="roles-tip">
                    {t('salary.monthly.tip')}
                  </div>
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
                {data.loans.tiers.map((tier, index) => (
                  <div key={index} className="loan-tier">
                    {formatNumber(tier)}
                  </div>
                ))}
              </div>

              <a
                href="https://discord.gg/lunarian"
                target="_blank"
                rel="noopener noreferrer"
                className="section-action-btn"
              >
                {t('loans.actionBtn')}
              </a>
            </div>
            <div
              className="loan-image-container"
              onClick={() => setIsLoanImageOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setIsLoanImageOpen(true)}
            >
              <Image
                src="/images/loan_contract.png"
                alt="Loan Contract"
                width={300}
                height={400}
                className="loan-contract-image"
              />
            </div>
          </section>

          {/* Trading Section */}
          <section className="bank-section trading-section">
            <div className="bank-section-header">
              <div className="bank-section-icon trading-icon"></div>
              <h2 className="bank-section-title">{t('trading.title')}</h2>
            </div>
            <p className="section-desc">{t('trading.desc')}</p>

            <div className="trading-warning">
              <span className="trading-warning-icon">!</span>
              <span className="trading-warning-text">{t('trading.warning')}</span>
            </div>

            <div className="trading-stats">
              <div className="trading-stat">
                <div className="trading-stat-label">{t('trading.limit')}</div>
                <div className="trading-stat-value limit">{formatFullNumber(data.trading.maxLimit)}</div>
              </div>
              <div className="trading-stat">
                <div className="trading-stat-label">{t('trading.winChance')}</div>
                <div className="trading-stat-value win">{data.trading.winChance}%</div>
              </div>
              <div className="trading-stat">
                <div className="trading-stat-label">{t('trading.lossPenalty')}</div>
                <div className="trading-stat-value loss">{data.trading.lossPenalty}%</div>
              </div>
            </div>

            <div className="trading-requirements">
              <div className="trading-requirements-title">{t('trading.requirements')}</div>
              <div className="trading-requirements-list">
                <div className="trading-requirement">
                  {t('trading.level')}: <span>{data.trading.levelRequired}</span>
                </div>
                <div className="trading-requirement">
                  {t('trading.cooldown')}: <span>{data.trading.cooldown}</span>
                </div>
              </div>
            </div>

            <a
              href="https://discord.gg/lunarian"
              target="_blank"
              rel="noopener noreferrer"
              className="section-action-btn"
            >
              {t('trading.actionBtn')}
            </a>
          </section>

          {/* Insurance & VIP Section */}
          <section className="bank-section">
            <div className="bank-section-header">
              <div className="bank-section-icon services-icon"></div>
              <h2 className="bank-section-title">{t('insurance.title')}</h2>
            </div>

            <div className="services-grid">
              {/* Theft Protection Card */}
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
                <a
                  href="https://discord.gg/lunarian"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="section-action-btn small"
                >
                  {t('insurance.actionBtn')}
                </a>
              </div>

              {/* VIP Card */}
              <div className="service-card vip-card">
                <div className="service-card-header">
                  <span className="service-card-icon vip-icon"></span>
                  <span className="service-card-title">{t('vip.title')}</span>
                </div>
                <p className="service-desc">{t('vip.desc')}</p>

                <div className="vip-how-to">
                  <div className="vip-how-to-label">{t('vip.howToJoin')}</div>
                  <div className="vip-how-to-value">
                    {formatFullNumber(data.vip.depositRequirement)}+ {t('currency')}
                  </div>
                </div>

                <div className="vip-benefits-title">{t('vip.benefits')}</div>
                <div className="vip-benefits-list">
                  {data.vip.benefits.map((benefit, index) => (
                    <div key={index} className="vip-benefit">
                      <span className="vip-benefit-icon benefit-icon"></span>
                      <span className="vip-benefit-text">{benefit.text[locale]}</span>
                    </div>
                  ))}
                </div>
                <a
                  href="https://discord.gg/lunarian"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="section-action-btn small vip"
                >
                  {t('vip.actionBtn')}
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Lightbox
        isOpen={isLoanImageOpen}
        imageSrc="/images/loan_contract.png"
        alt="Loan Contract"
        onClose={() => setIsLoanImageOpen(false)}
      />
    </main>
  );
}
