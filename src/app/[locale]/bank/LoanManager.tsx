'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { LOAN_TIERS } from '@/lib/bank/bank-config';
import type { LoanRecord } from '@/types/bank';

interface LoanManagerProps {
  activeLoan: LoanRecord | null;
  level: number;
  debt: number;
  isVip: boolean;
  balance: number;
  onTakeLoan: (tier: number) => Promise<void>;
  onRepayLoan: () => Promise<void>;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toLocaleString();
}

function formatCountdownDays(dueDate: string): { text: string; overdue: boolean } {
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const diff = due - now;

  if (diff <= 0) {
    const overdueDays = Math.ceil(Math.abs(diff) / 86_400_000);
    return { text: `${overdueDays}d overdue`, overdue: true };
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return { text: `${days}d ${hours}h`, overdue: false };
  return { text: `${hours}h`, overdue: false };
}

export function LoanManager({ activeLoan, level, debt, isVip, balance, onTakeLoan, onRepayLoan }: LoanManagerProps) {
  const t = useTranslations('bankPage');
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dueCountdown, setDueCountdown] = useState({ text: '', overdue: false });

  useEffect(() => {
    if (!activeLoan) return;
    const update = () => setDueCountdown(formatCountdownDays(activeLoan.dueDate));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [activeLoan]);

  const interestRate = isVip ? 15 : 20;

  const handleTakeLoan = async () => {
    if (!selectedTier || loading) return;
    setLoading(true);
    try {
      await onTakeLoan(selectedTier);
      setShowConfirm(false);
      setSelectedTier(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRepay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onRepayLoan();
    } finally {
      setLoading(false);
    }
  };

  // Active loan view
  if (activeLoan) {
    return (
      <section className="bank-section loan-section">
        <div className="bank-section-header">
          <div className="bank-section-icon loan-icon"></div>
          <h2 className="bank-section-title">{t('loans.title')}</h2>
        </div>

        <div className={`active-loan-card ${dueCountdown.overdue ? 'overdue' : ''}`}>
          <div className="active-loan-header">
            <span className="active-loan-label">{t('loanAction.activeLoan')}</span>
            <span className={`active-loan-due ${dueCountdown.overdue ? 'overdue' : ''}`}>
              {dueCountdown.text}
            </span>
          </div>

          <div className="active-loan-details">
            <div className="active-loan-stat">
              <span className="active-loan-stat-label">{t('loanAction.borrowed')}</span>
              <span className="active-loan-stat-value">{activeLoan.amount.toLocaleString()}</span>
            </div>
            <div className="active-loan-stat">
              <span className="active-loan-stat-label">{t('loanAction.interest')}</span>
              <span className="active-loan-stat-value interest">{activeLoan.interest.toLocaleString()}</span>
            </div>
            <div className="active-loan-stat">
              <span className="active-loan-stat-label">{t('loanAction.totalDue')}</span>
              <span className="active-loan-stat-value total">{activeLoan.repaymentAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Loan progress bar */}
          <div className="loan-progress">
            <div
              className="loan-progress-fill"
              style={{
                width: `${Math.min(100, Math.max(0,
                  ((Date.now() - new Date(activeLoan.takenAt).getTime()) /
                    (new Date(activeLoan.dueDate).getTime() - new Date(activeLoan.takenAt).getTime())) * 100
                ))}%`
              }}
            />
          </div>

          <button
            className={`section-action-btn repay-btn ${dueCountdown.overdue ? 'urgent' : ''}`}
            onClick={handleRepay}
            disabled={loading || balance < activeLoan.repaymentAmount}
          >
            {loading ? t('dashboard.processing') : `${t('loanAction.repay')} (${activeLoan.repaymentAmount.toLocaleString()} ${t('currency')})`}
          </button>
          {balance < activeLoan.repaymentAmount && (
            <p className="loan-insufficient">{t('loanAction.insufficientBalance')}</p>
          )}
        </div>
      </section>
    );
  }

  // No active loan — tier selector
  const canTakeLoan = level >= 1 && debt === 0;

  return (
    <section className="bank-section loan-section">
      <div className="bank-section-header">
        <div className="bank-section-icon loan-icon"></div>
        <h2 className="bank-section-title">{t('loans.title')}</h2>
      </div>
      <p className="section-desc">{t('loans.desc')}</p>

      <div className="loan-overview">
        <div className="loan-stat">
          <div className="loan-stat-label">{t('loans.interest')}</div>
          <div className="loan-stat-value interest">20%</div>
        </div>
        <div className="loan-stat">
          <div className="loan-stat-label">{t('loans.vipInterest')}</div>
          <div className="loan-stat-value vip">15%</div>
        </div>
        <div className="loan-stat">
          <div className="loan-stat-label">{t('loans.deadline')}</div>
          <div className="loan-stat-value deadline">7 {t('loans.days')}</div>
        </div>
      </div>

      {!canTakeLoan && debt > 0 && (
        <div className="loan-warning">
          <span className="loan-warning-icon">!</span>
          <span>{t('loanAction.hasDebt')}</span>
        </div>
      )}
      {!canTakeLoan && debt === 0 && level < 1 && (
        <div className="loan-warning">
          <span className="loan-warning-icon">!</span>
          <span>{t('loanAction.levelTooLow')}</span>
          <a
            href="https://discord.com/channels/1243327880478462032"
            target="_blank"
            rel="noopener noreferrer"
            className="loan-warning-discord-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            {t('loanAction.joinDiscord')}
          </a>
        </div>
      )}

      <div className="loan-tiers-title">{t('loans.tiers')}</div>
      <div className="loan-tiers-grid interactive">
        {LOAN_TIERS.map((tier) => (
          <button
            key={tier}
            className={`loan-tier selectable ${selectedTier === tier ? 'selected' : ''}`}
            onClick={() => canTakeLoan && setSelectedTier(tier === selectedTier ? null : tier)}
            disabled={!canTakeLoan}
          >
            {formatNumber(tier)}
          </button>
        ))}
      </div>

      {selectedTier && (
        <div className="loan-preview">
          <div className="loan-preview-row">
            <span>{t('loanAction.youReceive')}</span>
            <span className="loan-preview-value">{selectedTier.toLocaleString()} {t('currency')}</span>
          </div>
          <div className="loan-preview-row">
            <span>{t('loanAction.interest')} ({interestRate}%)</span>
            <span className="loan-preview-value interest">+{Math.floor(selectedTier * interestRate / 100).toLocaleString()}</span>
          </div>
          <div className="loan-preview-row total">
            <span>{t('loanAction.youRepay')}</span>
            <span className="loan-preview-value">{Math.floor(selectedTier * (1 + interestRate / 100)).toLocaleString()} {t('currency')}</span>
          </div>
        </div>
      )}

      {!showConfirm ? (
        <button
          className="section-action-btn"
          onClick={() => selectedTier && setShowConfirm(true)}
          disabled={!selectedTier || !canTakeLoan}
        >
          {t('loans.actionBtn')}
        </button>
      ) : (
        <div className="loan-confirm">
          <p className="loan-confirm-text">{t('loanAction.confirmText')}</p>
          <div className="loan-confirm-buttons">
            <button className="section-action-btn confirm" onClick={handleTakeLoan} disabled={loading}>
              {loading ? t('dashboard.processing') : t('loanAction.confirm')}
            </button>
            <button className="section-action-btn cancel" onClick={() => setShowConfirm(false)}>
              {t('loanAction.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
