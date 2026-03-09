'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface BalanceSummaryProps {
  balance: number;
  debt: number;
  level: number;
  onPayDebt?: (amount?: number) => Promise<void>;
}

export function BalanceSummary({ balance, debt, level, onPayDebt }: BalanceSummaryProps) {
  const t = useTranslations('bankPage');
  const [showPartial, setShowPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFullPay = async () => {
    if (loading || !onPayDebt) return;
    setLoading(true);
    try {
      await onPayDebt();
      setShowPartial(false);
      setPartialAmount('');
    } finally {
      setLoading(false);
    }
  };

  const handlePartialPay = async () => {
    const amount = parseInt(partialAmount);
    if (loading || !onPayDebt || isNaN(amount) || amount <= 0) return;
    setLoading(true);
    try {
      await onPayDebt(amount);
      setShowPartial(false);
      setPartialAmount('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bank-balance-bar">
      <div className="bank-balance-main">
        <div className="bank-balance-amount">
          <span className="bank-balance-value">{balance.toLocaleString()}</span>
          <span className="bank-balance-currency">{t('currency')}</span>
        </div>
        <div className="bank-balance-level">
          <span className="bank-level-badge">{t('dashboard.level')} {level}</span>
        </div>
      </div>
      {debt > 0 && (
        <div className="bank-debt-section">
          <div className="bank-debt-indicator">
            <span className="bank-debt-icon">!</span>
            <span className="bank-debt-text">
              {t('dashboard.debt')}: {debt.toLocaleString()} {t('currency')}
            </span>
          </div>
          {onPayDebt && (
            <div className="bank-debt-actions">
              {!showPartial ? (
                <div className="bank-debt-buttons">
                  <button
                    className="debt-pay-btn full"
                    onClick={handleFullPay}
                    disabled={loading || balance < debt}
                  >
                    {loading ? t('dashboard.processing') : `${t('dashboard.payDebtFull')} (${debt.toLocaleString()})`}
                  </button>
                  <button
                    className="debt-pay-btn partial"
                    onClick={() => setShowPartial(true)}
                    disabled={loading || balance <= 0}
                  >
                    {t('dashboard.payDebtPartial')}
                  </button>
                </div>
              ) : (
                <div className="bank-debt-partial-form">
                  <input
                    type="number"
                    className="debt-partial-input"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={t('dashboard.enterAmount')}
                    min={1}
                    max={Math.min(debt, balance)}
                  />
                  <div className="bank-debt-buttons">
                    <button
                      className="debt-pay-btn full"
                      onClick={handlePartialPay}
                      disabled={loading || !partialAmount || parseInt(partialAmount) <= 0 || parseInt(partialAmount) > debt || parseInt(partialAmount) > balance}
                    >
                      {loading ? t('dashboard.processing') : t('dashboard.payDebtConfirm')}
                    </button>
                    <button
                      className="debt-pay-btn cancel"
                      onClick={() => { setShowPartial(false); setPartialAmount(''); }}
                      disabled={loading}
                    >
                      {t('dashboard.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
