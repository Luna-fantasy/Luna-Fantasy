'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { RevealData } from '@/types/bazaar';

interface VendorMelunaProps {
  stoneBox: {
    price: number;
    stones: { name: string; weight: number; dropPercent: number }[];
  };
  balance: number;
  hasDebt: boolean;
  isLoggedIn: boolean;
  onPurchase: (data: RevealData) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VendorMeluna({ stoneBox, balance, hasDebt, isLoggedIn, onPurchase }: VendorMelunaProps) {
  const t = useTranslations('bazaarPage');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropRates, setShowDropRates] = useState(false);

  const canAfford = balance >= stoneBox.price;
  const disabled = !isLoggedIn || hasDebt || !canAfford || buying;

  const handleBuy = async () => {
    if (buying) return;
    setError(null);
    setBuying(true);

    try {
      const res = await fetch('/api/bazaar/stonebox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Purchase failed');
        return;
      }

      onPurchase({
        type: 'stone',
        item: {
          name: data.stone.name,
          imageUrl: data.stone.imageUrl,
        },
        isDuplicate: data.isDuplicate,
        refundAmount: data.refundAmount,
        newBalance: data.newBalance,
        price: stoneBox.price,
      });
    } catch {
      setError('Network error');
    } finally {
      setBuying(false);
    }
  };

  const eligibleStones = stoneBox.stones.filter((s) => s.weight > 0);

  return (
    <div className="vendor-section">
      <div className="vendor-header">
        <h2 className="vendor-name">{t('meluna.name')}</h2>
        <p className="vendor-title">{t('meluna.title')}</p>
        <p className="vendor-desc">{t('meluna.desc')}</p>
      </div>

      {error && (
        <div className="vendor-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="stonebox-container">
        <div className="stonebox-card">
          <div className="stonebox-card-glow" />
          <div className="stonebox-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
          <h3 className="stonebox-title">{t('meluna.boxTitle')}</h3>
          <div className="stonebox-price">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {formatNumber(stoneBox.price)}
          </div>
          <p className="stonebox-duplicate-info">{t('meluna.duplicateInfo')}</p>
          <button
            className="stonebox-buy-btn"
            disabled={disabled}
            onClick={handleBuy}
          >
            {buying ? (
              <span className="luckbox-spinner" />
            ) : hasDebt ? (
              t('inDebt')
            ) : !canAfford ? (
              t('insufficientBalance')
            ) : (
              t('meluna.openBox')
            )}
          </button>
        </div>

        {/* Drop Rates */}
        <div className="stonebox-droprates">
          <button
            className="stonebox-droprates-toggle"
            onClick={() => setShowDropRates(!showDropRates)}
          >
            <span>{t('meluna.dropRates')}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`stonebox-chevron ${showDropRates ? 'open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showDropRates && (
            <div className="stonebox-droprates-table">
              {eligibleStones.map((stone) => (
                <div key={stone.name} className="stonebox-droprate-row">
                  <span className="stonebox-droprate-name">{stone.name}</span>
                  <span className="stonebox-droprate-percent">{stone.dropPercent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
