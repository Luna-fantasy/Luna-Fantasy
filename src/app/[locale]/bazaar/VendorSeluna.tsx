'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef, useCallback } from 'react';
import { dispatchBalanceUpdate } from '@/lib/balance-events';
import PassportPrice, { applyPassportDiscount } from '@/components/PassportPrice';
import { E } from '@/components/edit-mode/EditableText';

interface SelunaItem {
  id: string;
  type: 'card' | 'role' | 'tickets' | 'stone';
  name: string;
  price: number;
  stock: number;
  remaining: number;
  imageUrl: string;
  owned: boolean;
  rarity?: string;
  attack?: number;
  ticketCount?: number;
}

interface ShopState {
  active: boolean;
  endsAt: number | null;
  nextOpenAt: number | null;
  items: SelunaItem[];
  user: { balance: number; hasDebt: boolean } | null;
}

interface VendorSelunaProps {
  balance: number;
  hasDebt: boolean;
  hasPassport: boolean;
  isLoggedIn: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDaysRemaining(ms: number): number {
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

const TYPE_ICONS: Record<string, string> = {
  card: '\u2660',    // spade
  role: '\u2605',    // star
  tickets: '\u2728', // sparkles
  stone: '\u25C6',   // diamond
};

export default function VendorSeluna({ balance, hasDebt, hasPassport, isLoggedIn }: VendorSelunaProps) {
  const t = useTranslations('bazaarPage');

  const [shop, setShop] = useState<ShopState | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdownText, setCountdownText] = useState('');
  const [currentBalance, setCurrentBalance] = useState(balance);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCurrentBalance(balance);
  }, [balance]);

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch('/api/bazaar/seluna');
      if (!res.ok) throw new Error('Failed to fetch shop');
      const data: ShopState = await res.json();
      setShop(data);
      if (data.user) {
        setCurrentBalance(data.user.balance);
      }
    } catch {
      setError('Failed to load shop data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  // Countdown timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!shop?.active || !shop.endsAt) {
      setCountdownText('');
      return;
    }

    const tick = () => {
      const remaining = (shop.endsAt ?? 0) - Date.now();
      if (remaining <= 0) {
        setCountdownText('');
        fetchShop(); // Refresh state when timer expires
      } else {
        setCountdownText(formatCountdown(remaining));
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [shop?.active, shop?.endsAt, fetchShop]);

  const handlePurchase = async (itemId: string) => {
    if (buying) return;
    setError(null);
    setSuccessMsg(null);
    setBuying(itemId);
    setConfirmItem(null);

    try {
      const res = await fetch('/api/bazaar/seluna', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ itemId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Purchase failed');

      // Update balance
      setCurrentBalance(data.newBalance);
      dispatchBalanceUpdate(data.newBalance);

      // Show appropriate success message
      if (data.isDuplicate && data.refunded) {
        setSuccessMsg(t('seluna.duplicateStone'));
      } else if (data.isDuplicate) {
        setSuccessMsg(t('seluna.duplicateCard'));
      } else if (data.grantError) {
        setSuccessMsg(t('seluna.roleGrantFailed'));
      } else if (data.itemType === 'role') {
        setSuccessMsg(t('seluna.roleGranted'));
      } else if (data.itemType === 'tickets') {
        setSuccessMsg(t('seluna.ticketsGranted'));
      } else {
        setSuccessMsg(t('seluna.purchaseSuccess', { item: data.item }));
      }

      // Refresh shop data to update stock and ownership
      fetchShop();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuying(null);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'card': return 'seluna-type-badge card-type';
      case 'role': return 'seluna-type-badge role-type';
      case 'tickets': return 'seluna-type-badge tickets-type';
      case 'stone': return 'seluna-type-badge stone-type';
      default: return 'seluna-type-badge';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'card': return t('seluna.itemCard');
      case 'role': return t('seluna.itemRole');
      case 'tickets': return t('seluna.itemTickets');
      case 'stone': return t('seluna.itemStone');
      default: return type;
    }
  };

  const getButtonState = (item: SelunaItem) => {
    if (!isLoggedIn) return { disabled: true, label: t('seluna.loginRequired') };
    if (hasDebt) return { disabled: true, label: t('seluna.inDebt') };
    if (item.remaining === 0) return { disabled: true, label: t('seluna.soldOut') };
    if (currentBalance < applyPassportDiscount(item.price, hasPassport)) return { disabled: true, label: t('seluna.insufficient') };
    return { disabled: false, label: t('seluna.purchase') };
  };

  if (loading) {
    return (
      <div className="vendor-section seluna-section">
        <div className="bazaar-loading">
          <div className="bazaar-loading-spinner" />
        </div>
      </div>
    );
  }

  if (!shop) return null;

  return (
    <div className="vendor-section seluna-section">
      {/* Shop Status Banner */}
      <div className={`seluna-status-banner ${shop.active ? 'status-open' : 'status-closed'}`}>
        {shop.active ? (
          <>
            <span className="seluna-status-dot open" />
            <span className="seluna-status-label"><E ns="bazaarPage" k="seluna.shopOpen">{t('seluna.shopOpen')}</E></span>
            {countdownText && (
              <span className="seluna-countdown">
                {t('seluna.closesIn', { time: countdownText })}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="seluna-status-dot closed" />
            <span className="seluna-status-label"><E ns="bazaarPage" k="seluna.shopClosed">{t('seluna.shopClosed')}</E></span>
            {shop.nextOpenAt && (
              <span className="seluna-next-open">
                {t('seluna.returnsIn', {
                  days: formatDaysRemaining(shop.nextOpenAt - Date.now()),
                })}
              </span>
            )}
          </>
        )}
      </div>

      {/* Closed state atmospheric message */}
      {!shop.active && (
        <div className="seluna-closed-message">
          <p><E ns="bazaarPage" k="seluna.returnsMessage">{t('seluna.returnsMessage')}</E></p>
        </div>
      )}

      {/* Error/Success Banners */}
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

      {/* Item Grid — only shown when shop is open */}
      {shop.active && (
        <div className="seluna-grid">
          {shop.items.map((item) => {
            const btnState = getButtonState(item);
            const isConfirming = confirmItem === item.id;
            const isBuying = buying === item.id;

            return (
              <div key={item.id} className="seluna-card">
                {/* Item Image (for cards and stones) */}
                {item.imageUrl && (
                  <div className="seluna-card-image">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="seluna-card-header">
                  <span className={`seluna-card-icon ${item.type}-icon`}>
                    {TYPE_ICONS[item.type] || ''}
                  </span>
                  <div>
                    <h3 className="seluna-card-title">{item.name}</h3>
                    <span className={getTypeBadgeClass(item.type)}>
                      {getTypeLabel(item.type)}
                    </span>
                  </div>
                </div>

                {/* Card stats */}
                {item.type === 'card' && item.rarity && (
                  <div className="seluna-card-detail">
                    <span>Rarity</span>
                    <span className="seluna-detail-value">{item.rarity}</span>
                  </div>
                )}
                {item.type === 'card' && item.attack && (
                  <div className="seluna-card-detail">
                    <span>Attack</span>
                    <span className="seluna-detail-value">{item.attack}</span>
                  </div>
                )}

                {/* Ticket count */}
                {item.type === 'tickets' && item.ticketCount && (
                  <div className="seluna-card-detail">
                    <span>Tickets</span>
                    <span className="seluna-detail-value">{item.ticketCount}</span>
                  </div>
                )}

                {/* Price */}
                <div className="seluna-card-price">
                  <span className="seluna-price-label">{t('seluna.price')}</span>
                  <span className="seluna-price-value">
                    <PassportPrice price={item.price} hasPassport={hasPassport} /> {t('lunariLabel')}
                  </span>
                </div>

                {/* Stock */}
                <div className="seluna-card-detail">
                  <span>{t('seluna.stock')}</span>
                  <span className={`seluna-detail-value ${item.remaining === 0 ? 'sold-out' : ''}`}>
                    {item.stock === -1
                      ? t('seluna.unlimited')
                      : item.remaining > 0
                        ? t('seluna.stockLeft', { count: item.remaining })
                        : t('seluna.soldOut')}
                  </span>
                </div>

                {/* Ownership indicator */}
                {item.owned && (item.type === 'card' || item.type === 'stone' || item.type === 'role') && (
                  <div className="seluna-owned-badge">{t('seluna.alreadyOwned')}</div>
                )}

                {/* Buy button / Confirm */}
                {!isConfirming ? (
                  <button
                    className="seluna-buy-btn"
                    onClick={() => setConfirmItem(item.id)}
                    disabled={btnState.disabled || isBuying}
                  >
                    {isBuying ? t('seluna.processing') : btnState.disabled ? btnState.label : t('seluna.purchase')}
                  </button>
                ) : (
                  <div className="seluna-confirm">
                    <p className="seluna-confirm-text">
                      {t('seluna.confirmPurchase', {
                        item: item.name,
                        price: formatNumber(item.price),
                      })}
                    </p>
                    <div className="seluna-confirm-buttons">
                      <button
                        className="seluna-buy-btn confirm"
                        onClick={() => handlePurchase(item.id)}
                        disabled={isBuying}
                      >
                        {isBuying ? t('seluna.processing') : t('seluna.confirmBtn')}
                      </button>
                      <button
                        className="seluna-buy-btn cancel"
                        onClick={() => setConfirmItem(null)}
                      >
                        {t('seluna.cancelBtn')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
