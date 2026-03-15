'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import type { InvestmentRecord } from '@/types/bank';

interface InvestmentTrackerProps {
  investment: InvestmentRecord | null;
  balance: number;
  onDeposit: (amount: number) => Promise<void>;
  onWithdraw: () => Promise<void>;
  minAmount?: number;
  maturityMs?: number;
  earlyFee?: number;
  profitRate?: number;
  depositLockMs?: number;
}

export function InvestmentTracker({ investment, balance, onDeposit, onWithdraw, minAmount, maturityMs, earlyFee, profitRate, depositLockMs }: InvestmentTrackerProps) {
  const MIN_AMOUNT = minAmount ?? 20_000;
  const MATURITY_MS = maturityMs ?? 2_592_000_000;
  const EARLY_FEE = earlyFee ?? 5_000;
  const PROFIT_RATE = profitRate ?? 0.30;
  const DEPOSIT_LOCK_MS = depositLockMs ?? 604_800_000;
  const t = useTranslations('bankPage');
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [maturityProgress, setMaturityProgress] = useState(0);
  const [daysElapsed, setDaysElapsed] = useState(0);

  useEffect(() => {
    if (!investment) return;
    const update = () => {
      const startMs = new Date(investment.startDate).getTime();
      const elapsed = Date.now() - startMs;
      const progress = Math.min(1, elapsed / MATURITY_MS);
      setMaturityProgress(progress);
      setDaysElapsed(Math.floor(elapsed / 86_400_000));
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [investment]);

  const handleDeposit = async () => {
    const amount = parseInt(depositAmount, 10);
    if (isNaN(amount) || amount < MIN_AMOUNT || loading) return;
    setLoading(true);
    try {
      await onDeposit(amount);
      setDepositAmount('');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onWithdraw();
      setShowWithdrawConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const isMature = investment ? maturityProgress >= 1 : false;
  const canAddMore = investment
    ? (Date.now() - new Date(investment.startDate).getTime()) <= DEPOSIT_LOCK_MS
    : false;

  // Active investment view
  if (investment) {
    const projectedPayout = isMature
      ? Math.floor(investment.amount * (1 + PROFIT_RATE))
      : Math.max(0, investment.amount - EARLY_FEE);
    const projectedProfit = projectedPayout - investment.amount;

    return (
      <section id="investment" className="bank-section investment-section">
        <div className="bank-section-header">
          <div className="bank-section-icon services-icon"></div>
          <h2 className="bank-section-title">{t('investAction.title')}</h2>
        </div>

        <div className="investment-active-card">
          <div className="investment-ring-container">
            <svg className="investment-ring" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke={isMature ? '#fbbf24' : 'var(--accent-primary)'}
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - maturityProgress)}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                className={isMature ? 'ring-mature' : ''}
              />
              <text x="60" y="55" textAnchor="middle" fill="var(--text-primary)" fontSize="20" fontWeight="900">
                {daysElapsed}
              </text>
              <text x="60" y="75" textAnchor="middle" fill="var(--text-muted)" fontSize="11">
                / 30 {t('loans.days')}
              </text>
            </svg>
          </div>

          <div className="investment-details">
            <div className="investment-stat">
              <span className="investment-stat-label">{t('investAction.principal')}</span>
              <span className="investment-stat-value">{investment.amount.toLocaleString()} {t('currency')}</span>
            </div>
            <div className="investment-stat">
              <span className="investment-stat-label">{t('investAction.projectedPayout')}</span>
              <span className={`investment-stat-value ${isMature ? 'profit' : 'loss'}`}>
                {projectedPayout.toLocaleString()} {t('currency')}
                <span className="investment-profit-label">
                  ({projectedProfit >= 0 ? '+' : ''}{projectedProfit.toLocaleString()})
                </span>
              </span>
            </div>
            {!canAddMore && !isMature && (
              <div className="investment-locked-badge">
                {t('investAction.depositLocked')}
              </div>
            )}
          </div>

          {canAddMore && (
            <div className="investment-add-more">
              <input
                type="number"
                className="investment-input"
                placeholder={`${t('investAction.addMore')} (${t('investAction.min')} ${MIN_AMOUNT.toLocaleString()})`}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min={MIN_AMOUNT}
              />
              <button
                className="section-action-btn small"
                onClick={handleDeposit}
                disabled={loading || !depositAmount || parseInt(depositAmount, 10) < MIN_AMOUNT}
              >
                {loading ? t('dashboard.processing') : t('investAction.deposit')}
              </button>
            </div>
          )}

          {!showWithdrawConfirm ? (
            <button
              className={`section-action-btn withdraw-btn ${isMature ? 'mature' : 'early'}`}
              onClick={() => setShowWithdrawConfirm(true)}
            >
              {isMature
                ? `${t('investAction.withdraw')} (+${Math.floor(investment.amount * PROFIT_RATE).toLocaleString()} ${t('investAction.profit')})`
                : `${t('investAction.withdrawEarly')} (-${EARLY_FEE.toLocaleString()} ${t('investAction.fee')})`
              }
            </button>
          ) : (
            <div className="loan-confirm">
              <p className="loan-confirm-text">
                {isMature ? t('investAction.confirmWithdraw') : t('investAction.confirmEarly')}
              </p>
              <div className="loan-confirm-buttons">
                <button className="section-action-btn confirm" onClick={handleWithdraw} disabled={loading}>
                  {loading ? t('dashboard.processing') : t('loanAction.confirm')}
                </button>
                <button className="section-action-btn cancel" onClick={() => setShowWithdrawConfirm(false)}>
                  {t('loanAction.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // No investment — deposit form
  const parsedAmount = parseInt(depositAmount, 10);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= MIN_AMOUNT && parsedAmount <= balance;

  return (
    <section id="investment" className="bank-section investment-section">
      <div className="bank-section-header">
        <div className="bank-section-icon services-icon"></div>
        <h2 className="bank-section-title">{t('investAction.title')}</h2>
      </div>
      <p className="section-desc">{t('investAction.desc')}</p>

      <div className="investment-info-grid">
        <div className="loan-stat">
          <div className="loan-stat-label">{t('investAction.profitRate')}</div>
          <div className="loan-stat-value vip">30%</div>
        </div>
        <div className="loan-stat">
          <div className="loan-stat-label">{t('investAction.maturity')}</div>
          <div className="loan-stat-value deadline">30 {t('loans.days')}</div>
        </div>
        <div className="loan-stat">
          <div className="loan-stat-label">{t('investAction.earlyFee')}</div>
          <div className="loan-stat-value interest">5,000</div>
        </div>
      </div>

      <div className="investment-deposit-form">
        <input
          type="number"
          className="investment-input"
          placeholder={`${t('investAction.min')} ${MIN_AMOUNT.toLocaleString()} ${t('currency')}`}
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          min={MIN_AMOUNT}
        />
        {isValidAmount && (
          <div className="investment-preview">
            <span>{t('investAction.after30Days')}: </span>
            <span className="investment-preview-value">
              {Math.floor(parsedAmount * (1 + PROFIT_RATE)).toLocaleString()} {t('currency')}
              <span className="investment-profit-label"> (+{Math.floor(parsedAmount * PROFIT_RATE).toLocaleString()})</span>
            </span>
          </div>
        )}
        <button
          className="section-action-btn vip"
          onClick={handleDeposit}
          disabled={!isValidAmount || loading}
        >
          {loading ? t('dashboard.processing') : t('investAction.deposit')}
        </button>
      </div>
    </section>
  );
}
