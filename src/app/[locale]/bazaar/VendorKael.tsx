'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import type { LuckboxTierConfig, RevealData } from '@/types/bazaar';
import LunariIcon from '@/components/LunariIcon';

interface VendorKaelProps {
  tiers: (LuckboxTierConfig & { cardCount: number })[];
  balance: number;
  hasDebt: boolean;
  isLoggedIn: boolean;
  onPurchase: (data: RevealData) => void;
  onRegisterBuyAgain?: (fn: () => void) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VendorKael({ tiers, balance, hasDebt, isLoggedIn, onPurchase, onRegisterBuyAgain }: VendorKaelProps) {
  const t = useTranslations('bazaarPage');
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTierRef = useRef<{ tier: string; price: number } | null>(null);

  const handleBuy = async (tier: string, price: number) => {
    lastTierRef.current = { tier, price };
    if (buying) return;
    setError(null);
    setBuying(tier);

    try {
      const res = await fetch('/api/bazaar/luckbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Purchase failed');
        return;
      }

      onPurchase({
        type: 'card',
        item: {
          name: data.card.name,
          imageUrl: data.card.imageUrl,
          rarity: data.card.rarity,
          attack: data.card.attack,
        },
        isDuplicate: data.isDuplicate,
        newBalance: data.newBalance,
        price,
      });
    } catch {
      setError('Network error');
    } finally {
      setBuying(null);
    }
  };

  useEffect(() => {
    onRegisterBuyAgain?.(() => {
      if (lastTierRef.current) {
        handleBuy(lastTierRef.current.tier, lastTierRef.current.price);
      }
    });
  });

  return (
    <div className="vendor-section">
      <div className="vendor-header">
        <h2 className="vendor-name">{t('kael.name')}</h2>
        <p className="vendor-title">{t('kael.title')}</p>
        <p className="vendor-desc">{t('kael.desc')}</p>
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

      <div className="luckbox-grid">
        {(tiers || []).map((tier) => {
          const canAfford = balance >= tier.price;
          const disabled = !isLoggedIn || hasDebt || !canAfford || !!buying;

          return (
            <div key={tier.tier} className={`luckbox-card luckbox-${tier.tier}`}>
              <div className="luckbox-card-glow" />
              <div className="luckbox-rarity-badge">{tier.label}</div>
              <div className="luckbox-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 8V21H3V8" />
                  <path d="M1 3h22v5H1z" />
                  <path d="M10 12h4" />
                </svg>
              </div>
              <div className="luckbox-card-count">
                {t('kael.poolSize', { count: tier.cardCount })}
              </div>
              <div className="luckbox-price">
                <LunariIcon size={14} />
                {formatNumber(tier.price)}
              </div>
              <button
                className="luckbox-buy-btn"
                disabled={disabled}
                onClick={() => handleBuy(tier.tier, tier.price)}
              >
                {buying === tier.tier ? (
                  <span className="luckbox-spinner" />
                ) : hasDebt ? (
                  t('inDebt')
                ) : !canAfford ? (
                  t('insufficientBalance')
                ) : (
                  t('kael.openBox')
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
