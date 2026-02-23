'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { INSURANCE_COST } from '@/lib/bank/bank-config';

interface VendorSelunaProps {
  balance: number;
  hasDebt: boolean;
  isLoggedIn: boolean;
  hasInsurance: boolean;
  onPurchaseInsurance: () => Promise<{ newBalance: number }>;
}

export default function VendorSeluna({
  balance,
  hasDebt,
  isLoggedIn,
  hasInsurance,
  onPurchaseInsurance,
}: VendorSelunaProps) {
  const t = useTranslations('bazaarPage');
  const [error, setError] = useState<string | null>(null);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [showInsuranceConfirm, setShowInsuranceConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleInsurance = async () => {
    if (insuranceLoading) return;
    setInsuranceLoading(true);
    setError(null);
    try {
      await onPurchaseInsurance();
      setShowInsuranceConfirm(false);
      setSuccessMsg(t('seluna.insuranceSuccess'));
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInsuranceLoading(false);
    }
  };

  const canAffordInsurance = balance >= INSURANCE_COST;

  return (
    <div className="vendor-section seluna-section">
      {error && (
        <div className="vendor-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="vendor-error-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {successMsg && (
        <div className="vendor-success">
          <span>{successMsg}</span>
        </div>
      )}

      <div className="seluna-grid">
        {/* Theft Protection Insurance */}
        <div className="seluna-card insurance-card">
          <div className="seluna-card-header">
            <span className="seluna-card-icon protection-icon"></span>
            <div>
              <h3 className="seluna-card-title">{t('seluna.insuranceTitle')}</h3>
              <p className="seluna-card-subtitle">{t('seluna.insuranceSubtitle')}</p>
            </div>
          </div>
          <p className="seluna-card-desc">{t('seluna.insuranceDesc')}</p>
          <div className="seluna-card-price">
            <span className="seluna-price-label">{t('seluna.price')}</span>
            <span className="seluna-price-value">{INSURANCE_COST.toLocaleString()} {t('lunariLabel')}</span>
          </div>
          <div className="seluna-card-detail">
            <span>{t('seluna.duration')}</span>
            <span className="seluna-detail-value">{t('seluna.lifetime')}</span>
          </div>

          {hasInsurance ? (
            <div className="seluna-owned-badge">{t('seluna.alreadyOwned')}</div>
          ) : !showInsuranceConfirm ? (
            <button
              className="seluna-buy-btn"
              onClick={() => setShowInsuranceConfirm(true)}
              disabled={!isLoggedIn || hasDebt || !canAffordInsurance}
            >
              {!isLoggedIn ? t('seluna.loginRequired')
                : hasDebt ? t('seluna.inDebt')
                : !canAffordInsurance ? t('seluna.insufficient')
                : t('seluna.purchase')}
            </button>
          ) : (
            <div className="seluna-confirm">
              <p className="seluna-confirm-text">{t('seluna.confirmInsurance')}</p>
              <div className="seluna-confirm-buttons">
                <button className="seluna-buy-btn confirm" onClick={handleInsurance} disabled={insuranceLoading}>
                  {insuranceLoading ? t('seluna.processing') : t('seluna.confirmBtn')}
                </button>
                <button className="seluna-buy-btn cancel" onClick={() => setShowInsuranceConfirm(false)}>
                  {t('seluna.cancelBtn')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
