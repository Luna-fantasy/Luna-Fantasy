'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import type { RevealData } from '@/types/bazaar';
import LunariIcon from '@/components/LunariIcon';
import PassportPrice, { applyPassportDiscount } from '@/components/PassportPrice';
import { E } from '@/components/edit-mode/EditableText';

interface DuplicateStone {
  name: string;
  imageUrl: string;
  count: number;
  sellPrice: number;
}

interface VendorMelunaProps {
  stoneBox: {
    price: number;
    stones: { name: string; weight: number; dropPercent: number }[];
  };
  balance: number;
  hasDebt: boolean;
  hasPassport: boolean;
  isLoggedIn: boolean;
  onPurchase: (data: RevealData) => void;
  onRegisterBuyAgain?: (fn: () => void) => void;
  onBalanceUpdate?: (newBalance: number) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VendorMeluna({ stoneBox, balance, hasDebt, hasPassport, isLoggedIn, onPurchase, onRegisterBuyAgain, onBalanceUpdate }: VendorMelunaProps) {
  const t = useTranslations('bazaarPage');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropRates, setShowDropRates] = useState(false);

  // Sell duplicates state
  const [duplicates, setDuplicates] = useState<DuplicateStone[]>([]);
  const [dupsLoading, setDupsLoading] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [sellingStone, setSellingStone] = useState<string | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});

  const effectivePrice = applyPassportDiscount(stoneBox.price, hasPassport);
  const canAfford = balance >= effectivePrice;
  const disabled = !isLoggedIn || hasDebt || !canAfford || buying;

  const fetchDuplicates = useCallback(async () => {
    if (!isLoggedIn) return;
    setDupsLoading(true);
    try {
      const res = await fetch('/api/bazaar/my-stones');
      if (res.ok) {
        const data = await res.json();
        setDuplicates(data.duplicates || []);
      }
    } catch {} finally {
      setDupsLoading(false);
    }
  }, [isLoggedIn]);

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

      if (data.gotStone) {
        onPurchase({
          type: 'stone',
          gotStone: true,
          item: {
            name: data.stone.name,
            imageUrl: data.stone.imageUrl,
          },
          isDuplicate: data.isDuplicate ?? false,
          sellPrice: data.sellPrice,
          refundAmount: 0,
          newBalance: data.newBalance,
          price: stoneBox.price,
        });
        // Refresh duplicates list after purchase
        if (showDuplicates) fetchDuplicates();
      } else {
        onPurchase({
          type: 'stone',
          gotStone: false,
          item: { name: '', imageUrl: '' },
          isDuplicate: false,
          refundAmount: data.refundAmount,
          newBalance: data.newBalance,
          price: stoneBox.price,
        });
      }
    } catch {
      setError('Network error');
    } finally {
      setBuying(false);
    }
  };

  const getSellQty = (stoneName: string, maxSellable: number) => {
    const qty = sellQuantities[stoneName];
    if (qty == null) return maxSellable; // default to all duplicates
    return Math.min(qty, maxSellable);
  };

  const setSellQty = (stoneName: string, qty: number, maxSellable: number) => {
    setSellQuantities((prev) => ({ ...prev, [stoneName]: Math.max(1, Math.min(qty, maxSellable)) }));
  };

  const handleSellDuplicate = async (stoneName: string, quantity: number) => {
    if (sellingStone) return;
    setSellingStone(stoneName);
    setSellError(null);

    try {
      const res = await fetch('/api/bazaar/sell-stone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ stoneName, quantity }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSellError(data.error || 'Sell failed');
        return;
      }

      const sold = data.sold || quantity;
      onBalanceUpdate?.(data.newBalance);

      // Update local duplicates list
      setDuplicates((prev) =>
        prev
          .map((d) => d.name === stoneName ? { ...d, count: d.count - sold } : d)
          .filter((d) => d.count > 1)
      );
      // Reset quantity for this stone
      setSellQuantities((prev) => {
        const next = { ...prev };
        delete next[stoneName];
        return next;
      });
    } catch {
      setSellError('Network error');
    } finally {
      setSellingStone(null);
    }
  };

  const handleToggleDuplicates = () => {
    const next = !showDuplicates;
    setShowDuplicates(next);
    if (next && duplicates.length === 0) {
      fetchDuplicates();
    }
  };

  useEffect(() => {
    onRegisterBuyAgain?.(() => handleBuy());
  });

  const eligibleStones = stoneBox.stones.filter((s) => s.weight > 0);

  return (
    <div className="vendor-section">
      <div className="vendor-header">
        <h2 className="vendor-name"><E ns="bazaarPage" k="meluna.name">{t('meluna.name')}</E></h2>
        <p className="vendor-title"><E ns="bazaarPage" k="meluna.title">{t('meluna.title')}</E></p>
        <p className="vendor-desc"><E ns="bazaarPage" k="meluna.desc">{t('meluna.desc')}</E></p>
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
          <h3 className="stonebox-title"><E ns="bazaarPage" k="meluna.boxTitle">{t('meluna.boxTitle')}</E></h3>
          <div className="stonebox-price">
            <PassportPrice price={stoneBox.price} hasPassport={hasPassport} iconSize={16} showLabel />
          </div>
          <p className="stonebox-duplicate-info"><E ns="bazaarPage" k="meluna.duplicateInfo">{t('meluna.duplicateInfo')}</E></p>
          <button
            className="stonebox-buy-btn"
            disabled={disabled}
            onClick={handleBuy}
          >
            {buying ? (
              <span className="luckbox-spinner" />
            ) : hasDebt ? (
              <E ns="bazaarPage" k="inDebt">{t('inDebt')}</E>
            ) : !canAfford ? (
              <E ns="bazaarPage" k="insufficientBalance">{t('insufficientBalance')}</E>
            ) : (
              <E ns="bazaarPage" k="meluna.openBox">{t('meluna.openBox')}</E>
            )}
          </button>
        </div>

        {/* Drop Rates */}
        <div className="stonebox-droprates">
          <button
            className="stonebox-droprates-toggle"
            onClick={() => setShowDropRates(!showDropRates)}
          >
            <span><E ns="bazaarPage" k="meluna.dropRates">{t('meluna.dropRates')}</E></span>
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

        {/* Sell Duplicates */}
        {isLoggedIn && (
          <div className="stonebox-sell-section">
            <button
              className="stonebox-droprates-toggle"
              onClick={handleToggleDuplicates}
            >
              <span><E ns="bazaarPage" k="meluna.sellDuplicates">{t('meluna.sellDuplicates')}</E></span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`stonebox-chevron ${showDuplicates ? 'open' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showDuplicates && (
              <div className="stonebox-sell-list">
                {dupsLoading && (
                  <div className="stonebox-sell-loading">
                    <span className="luckbox-spinner" />
                  </div>
                )}
                {!dupsLoading && duplicates.length === 0 && (
                  <p className="stonebox-sell-empty"><E ns="bazaarPage" k="meluna.noDuplicates">{t('meluna.noDuplicates')}</E></p>
                )}
                {sellError && (
                  <div className="vendor-error" style={{ marginBottom: 8 }}>
                    <span>{sellError}</span>
                    <button onClick={() => setSellError(null)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
                {duplicates.map((stone) => {
                  const maxSellable = stone.count - 1;
                  const qty = getSellQty(stone.name, maxSellable);
                  const totalPrice = qty * stone.sellPrice;
                  return (
                    <div key={stone.name} className="stonebox-sell-row">
                      <img
                        src={stone.imageUrl}
                        alt={stone.name}
                        className="stonebox-sell-img"
                      />
                      <div className="stonebox-sell-info">
                        <span className="stonebox-sell-name">{stone.name}</span>
                        <span className="stonebox-sell-count">x{stone.count}</span>
                      </div>
                      <div className="stonebox-qty-selector">
                      <button
                        className="stonebox-qty-btn"
                        onClick={() => setSellQty(stone.name, qty - 1, maxSellable)}
                        disabled={qty <= 1 || sellingStone === stone.name}
                      >
                        -
                      </button>
                      <span className="stonebox-qty-value">{qty}</span>
                      <button
                        className="stonebox-qty-btn"
                        onClick={() => setSellQty(stone.name, qty + 1, maxSellable)}
                        disabled={qty >= maxSellable || sellingStone === stone.name}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="stonebox-sell-btn"
                      disabled={sellingStone === stone.name}
                      onClick={() => handleSellDuplicate(stone.name, qty)}
                    >
                      {sellingStone === stone.name ? (
                        <span className="luckbox-spinner" />
                      ) : (
                        <>{t('meluna.sellFor', { amount: formatNumber(totalPrice) })}<LunariIcon size={14} /></>
                      )}
                    </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
