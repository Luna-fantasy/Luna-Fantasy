'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { dispatchBalanceUpdate } from '@/lib/balance-events';

interface MellsItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  type: string;
  owned: boolean;
  active: boolean;
}

interface VendorMellsProps {
  balance: number;
  hasDebt: boolean;
  isLoggedIn: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VendorMells({ balance, hasDebt, isLoggedIn }: VendorMellsProps) {
  const t = useTranslations('bazaarPage');

  const [items, setItems] = useState<MellsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'rank'>('profile');
  const [buying, setBuying] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(balance);

  useEffect(() => {
    setCurrentBalance(balance);
  }, [balance]);

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch('/api/bazaar/mells');
      if (!res.ok) throw new Error('Failed to fetch shop');
      const data = await res.json();
      setItems(data.items ?? []);
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

  const handlePurchase = async (itemId: string) => {
    if (buying) return;
    setError(null);
    setSuccessMsg(null);
    setBuying(itemId);
    setConfirmItem(null);

    try {
      const res = await fetch('/api/bazaar/mells', {
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
      setSuccessMsg(t('mells.purchaseSuccess', { item: data.item }));

      fetchShop();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuying(null);
    }
  };

  const handleEquip = async (itemId: string) => {
    if (equipping) return;
    setError(null);
    setSuccessMsg(null);
    setEquipping(itemId);

    try {
      const res = await fetch('/api/bazaar/mells', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ action: 'equip', itemId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Equip failed');

      setSuccessMsg(
        data.active
          ? t('mells.equipped', { item: data.item })
          : t('mells.unequipped', { item: data.item })
      );

      fetchShop();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEquipping(null);
    }
  };

  const getButtonState = (item: MellsItem) => {
    if (!isLoggedIn) return { disabled: true, label: t('mells.loginRequired') };
    if (hasDebt) return { disabled: true, label: t('mells.inDebt') };
    if (currentBalance < item.price) return { disabled: true, label: t('mells.insufficient') };
    return { disabled: false, label: t('mells.purchase') };
  };

  const filtered = items.filter((i) => i.type === activeTab);
  const profileCount = items.filter((i) => i.type === 'profile').length;
  const rankCount = items.filter((i) => i.type === 'rank').length;

  if (loading) {
    return (
      <div className="vendor-section mells-section">
        <div className="bazaar-loading">
          <div className="bazaar-loading-spinner" />
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="vendor-section mells-section">
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

      {/* Tabs */}
      <div className="mells-tabs">
        <button
          className={`mells-tab ${activeTab === 'profile' ? 'mells-tab-active' : ''}`}
          onClick={() => { setActiveTab('profile'); setConfirmItem(null); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 21v-1a5 5 0 0 1 10 0v1" />
          </svg>
          {t('mells.profileTab')}
          <span className="mells-tab-count">{profileCount}</span>
        </button>
        <button
          className={`mells-tab ${activeTab === 'rank' ? 'mells-tab-active' : ''}`}
          onClick={() => { setActiveTab('rank'); setConfirmItem(null); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="5" rx="1" />
            <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
          </svg>
          {t('mells.rankTab')}
          <span className="mells-tab-count">{rankCount}</span>
        </button>
      </div>

      {/* Background Grid */}
      <div className="mells-grid">
        {filtered.map((item) => {
          const btnState = getButtonState(item);
          const isConfirming = confirmItem === item.id;
          const isBuying = buying === item.id;
          const isEquipping = equipping === item.id;

          return (
            <div key={item.id} className={`mells-card ${item.owned ? 'mells-card-owned' : ''} ${item.active ? 'mells-card-active' : ''}`}>
              {/* Image Preview */}
              <div className="mells-card-preview">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="mells-card-img"
                  loading="lazy"
                />
                {item.owned && (
                  <span className={`mells-badge ${item.active ? 'mells-badge-active' : 'mells-badge-owned'}`}>
                    {item.active ? t('mells.active') : t('mells.owned')}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="mells-card-body">
                <h3 className="mells-card-title">{item.name}</h3>
                <div className="mells-card-price">
                  <span className="mells-price-value">
                    {formatNumber(item.price)}
                  </span>
                  <span className="mells-price-currency">{t('lunariLabel')}</span>
                </div>

                {/* Owned: Equip/Unequip button */}
                {item.owned && (
                  <button
                    className={`mells-equip-btn ${item.active ? 'mells-unequip' : ''}`}
                    onClick={() => handleEquip(item.id)}
                    disabled={isEquipping}
                  >
                    {isEquipping
                      ? t('mells.processing')
                      : item.active
                        ? t('mells.unequip')
                        : t('mells.equip')}
                  </button>
                )}

                {/* Not owned: Buy flow */}
                {!item.owned && (
                  <>
                    {!isConfirming ? (
                      <button
                        className="mells-buy-btn"
                        onClick={() => setConfirmItem(item.id)}
                        disabled={btnState.disabled || isBuying}
                      >
                        {isBuying ? t('mells.processing') : btnState.disabled ? btnState.label : t('mells.purchase')}
                      </button>
                    ) : (
                      <div className="mells-confirm">
                        <p className="mells-confirm-text">
                          {t('mells.confirmPurchase', {
                            item: item.name,
                            price: formatNumber(item.price),
                          })}
                        </p>
                        <div className="mells-confirm-buttons">
                          <button
                            className="mells-buy-btn confirm"
                            onClick={() => handlePurchase(item.id)}
                            disabled={isBuying}
                          >
                            {isBuying ? t('mells.processing') : t('mells.confirmBtn')}
                          </button>
                          <button
                            className="mells-buy-btn cancel"
                            onClick={() => setConfirmItem(null)}
                          >
                            {t('mells.cancelBtn')}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
