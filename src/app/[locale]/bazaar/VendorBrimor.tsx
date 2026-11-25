'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { dispatchBalanceUpdate } from '@/lib/balance-events';
import PassportPrice, { applyPassportDiscount } from '@/components/PassportPrice';
import { E } from '@/components/edit-mode/EditableText';
import { BrimorRoleShelf } from '@/components/cinematic/night-economy/BrimorRoleShelf';
import { displayRoleColors, sortRoleStock } from '@/lib/bazaar/brimor-showcase';

interface BrimorItem {
  id: string;
  name: string;
  price: number;
  roleId: string;
  description: string;
  owned: boolean;
  active: boolean;
  gradientColors?: string[];
}

interface VendorBrimorProps {
  night?: boolean;
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

export default function VendorBrimor({ balance, hasDebt, hasPassport, isLoggedIn, night }: VendorBrimorProps) {
  const t = useTranslations('bazaarPage');

  const [items, setItems] = useState<BrimorItem[]>([]);
  const [chosenId, setChosenId] = useState('');
  const [stockStatus, setStockStatus] = useState<'loading'|'ready'|'unavailable'>('loading');
  const [buying, setBuying] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(balance);

  useEffect(() => {
    setCurrentBalance(balance);
  }, [balance]);

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch('/api/bazaar/brimor');
      if (!res.ok) throw new Error('Failed to fetch shop');
      const data = await res.json();
      setItems(data.items ?? []);
      setStockStatus('ready');
      if (data.user) {
        setCurrentBalance(data.user.balance);
      }
    } catch {
      setStockStatus('unavailable');
      if (!night) setError('Failed to load shop data');
    }
  }, [night]);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  const handlePurchase = async (itemId: string) => {
    if (buying) return;
    setError(null);
    setSuccessMsg(null);
    setBuying(itemId);
    setConfirmItem(null);

    try {
      const res = await fetch('/api/bazaar/brimor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ action: 'buy', itemId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Purchase failed');

      setCurrentBalance(data.newBalance);
      dispatchBalanceUpdate(data.newBalance);

      if (data.grantError) {
        setSuccessMsg(t('brimor.roleGrantFailed'));
      } else {
        setSuccessMsg(t('brimor.purchaseSuccess', { item: data.item }));
      }

      fetchShop();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuying(null);
    }
  };

  const handleToggle = async (itemId: string) => {
    if (toggling) return;
    setError(null);
    setSuccessMsg(null);
    setToggling(itemId);

    try {
      const res = await fetch('/api/bazaar/brimor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ action: 'toggle', itemId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Toggle failed');

      setSuccessMsg(
        data.active
          ? t('brimor.roleShown', { item: data.item })
          : t('brimor.roleHidden', { item: data.item })
      );

      fetchShop();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setToggling(null);
    }
  };

  const getButtonState = (item: BrimorItem) => {
    if (!isLoggedIn) return { disabled: true, label: t('brimor.loginRequired') };
    if (hasDebt) return { disabled: true, label: t('brimor.inDebt') };
    if (currentBalance < applyPassportDiscount(item.price, hasPassport)) return { disabled: true, label: t('brimor.insufficient') };
    return { disabled: false, label: t('brimor.purchase') };
  };

  if (stockStatus === 'loading') {
    return (
      <div className="vendor-section brimor-section">
        <div className="bazaar-loading">
          <div className="bazaar-loading-spinner" />
        </div>
      </div>
    );
  }

  if (items.length === 0 && !night) return null;

  const stock = night ? sortRoleStock(items) : items;
  const selected = stock.find(item => item.id === chosenId) ?? stock[0];
  const offers = night ? (selected && stockStatus==='ready' ? [selected] : []) : stock;

  return (
    <div className="vendor-section brimor-section">
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

      {/* Role Grid */}
      {night && <BrimorRoleShelf items={stock} selectedId={selected?.id}
        unavailable={stockStatus==='unavailable'} onRetry={()=>{setStockStatus('loading');void fetchShop();}}
        showReference={stockStatus==='ready' && process.env.NODE_ENV === 'development'}
        onPick={id => { setChosenId(id); setConfirmItem(null); }} />}
      <div className="brimor-grid" data-brimor-offer={night ? selected?.id : undefined}>
        {offers.map((item) => {
          const colours = displayRoleColors(item.gradientColors);
          const btnState = getButtonState(item);
          const isConfirming = confirmItem === item.id;
          const isBuying = buying === item.id;
          const isToggling = toggling === item.id;

          return (
            <div key={item.id} className={`brimor-card ${item.owned ? 'brimor-card-owned' : ''}`}>
              <div className="brimor-card-header">
                <span className="brimor-card-icon">
                  {'\u2605'}
                </span>
                <div>
                  <h3
                  className="brimor-card-title"
                  style={colours.length > 1 ? {
                    backgroundImage: `linear-gradient(90deg, ${colours.join(',')})`,
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: 'transparent',
                  } : colours.length ? { color: colours[0] } : undefined}
                >{item.name}</h3>
                  <span className="brimor-type-badge">{t('brimor.roleLabel')}</span>
                </div>
              </div>

              <p className="brimor-card-desc">{item.description}</p>

              {/* Price */}
              <div className="brimor-card-price">
                <span className="brimor-price-label">{t('brimor.price')}</span>
                <span className="brimor-price-value">
                  <PassportPrice price={item.price} hasPassport={hasPassport} /> {t('lunariLabel')}
                </span>
              </div>

              {/* Owned Badge + Toggle */}
              {item.owned && (
                <>
                  <div className={`brimor-owned-badge ${item.active ? 'brimor-active' : 'brimor-inactive'}`}>
                    {item.active ? t('brimor.roleActive') : t('brimor.roleInactive')}
                  </div>
                  <button
                    className={`brimor-toggle-btn ${item.active ? 'toggle-hide' : 'toggle-show'}`}
                    onClick={() => handleToggle(item.id)}
                    disabled={isToggling}
                  >
                    {isToggling
                      ? t('brimor.processing')
                      : item.active
                        ? t('brimor.hideRole')
                        : t('brimor.showRole')}
                  </button>
                </>
              )}

              {/* Buy Button / Confirm */}
              {!item.owned && (
                <>
                  {!isConfirming ? (
                    <button
                      className="brimor-buy-btn"
                      onClick={() => setConfirmItem(item.id)}
                      disabled={btnState.disabled || isBuying}
                    >
                      {isBuying ? t('brimor.processing') : btnState.disabled ? btnState.label : t('brimor.purchase')}
                    </button>
                  ) : (
                    <div className="brimor-confirm">
                      <p className="brimor-confirm-text">
                        {t('brimor.confirmPurchase', {
                          item: item.name,
                          price: formatNumber(applyPassportDiscount(item.price, hasPassport)),
                        })}
                      </p>
                      <div className="brimor-confirm-buttons">
                        <button
                          className="brimor-buy-btn confirm"
                          onClick={() => handlePurchase(item.id)}
                          disabled={isBuying}
                        >
                          {isBuying ? t('brimor.processing') : t('brimor.confirmBtn')}
                        </button>
                        <button
                          className="brimor-buy-btn cancel"
                          onClick={() => setConfirmItem(null)}
                        >
                          {t('brimor.cancelBtn')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
