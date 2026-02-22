'use client';

import { useTranslations } from 'next-intl';

interface BalanceSummaryProps {
  balance: number;
  debt: number;
  level: number;
}

export function BalanceSummary({ balance, debt, level }: BalanceSummaryProps) {
  const t = useTranslations('bankPage');

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
        <div className="bank-debt-indicator">
          <span className="bank-debt-icon">!</span>
          <span className="bank-debt-text">
            {t('dashboard.debt')}: {debt.toLocaleString()} {t('currency')}
          </span>
        </div>
      )}
    </div>
  );
}
