'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';
import type { LunariPackage } from '@/types/bazaar';

interface LunariStoreProps {
  packages: LunariPackage[];
  isLoggedIn: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function LunariStore({ packages, isLoggedIn }: LunariStoreProps) {
  const t = useTranslations('bazaarPage');
  const locale = useLocale();
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async (packageId: string) => {
    if (buying || !isLoggedIn) return;
    setError(null);
    setBuying(packageId);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ packageId, locale }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start checkout');
        return;
      }

      window.location.href = data.url;
    } catch {
      setError('Network error');
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="support-section">
      {/* Heart icon header */}
      <div className="support-header">
        <div className="support-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <h3 className="support-title">{t('store.title')}</h3>
        <p className="support-desc">{t('store.desc')}</p>
      </div>

      {error && (
        <div className="vendor-error" style={{ maxWidth: 480, margin: '0 auto 16px' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="support-tiers">
        {packages.map((pkg, i) => {
          const isPopular = i === 2;
          return (
            <div key={pkg.id} className={`support-tier ${isPopular ? 'support-tier-popular' : ''}`}>
              {isPopular && (
                <div className="support-popular-tag">{t('store.popular')}</div>
              )}
              <div className="support-tier-amount">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span>{formatNumber(pkg.lunari)}</span>
              </div>
              <span className="support-tier-name">{pkg.name}</span>
              <button
                className="support-tier-btn"
                disabled={!isLoggedIn || !!buying}
                onClick={() => handleBuy(pkg.id)}
              >
                {buying === pkg.id ? (
                  <span className="luckbox-spinner" />
                ) : (
                  <>{t('store.support')} &middot; ${pkg.usd.toFixed(2)}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="support-footer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>{t('store.securePayment')}</span>
      </div>
    </div>
  );
}
