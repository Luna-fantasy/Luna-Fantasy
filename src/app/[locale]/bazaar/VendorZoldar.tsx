'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TicketPackage, TicketPurchaseResponse } from '@/types/bazaar';
import LunariIcon from '@/components/LunariIcon';
import PassportPrice, { applyPassportDiscount } from '@/components/PassportPrice';
import { E } from '@/components/edit-mode/EditableText';

interface VendorZoldarProps {
  packages: TicketPackage[];
  balance: number;
  tickets: number;
  hasDebt: boolean;
  hasPassport: boolean;
  isLoggedIn: boolean;
  onPurchase: (result: TicketPurchaseResponse) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VendorZoldar({ packages, balance, tickets, hasDebt, hasPassport, isLoggedIn, onPurchase }: VendorZoldarProps) {
  const t = useTranslations('bazaarPage');
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBuy = async (packageId: string) => {
    if (buying) return;
    setError(null);
    setSuccessMsg(null);
    setBuying(packageId);

    try {
      const res = await fetch('/api/bazaar/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ packageId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Purchase failed');
        return;
      }

      setSuccessMsg(`+${data.ticketsAdded} ${t('zoldar.ticketsAdded')}`);
      onPurchase(data);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Network error');
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="vendor-section">
      <div className="vendor-header">
        <h2 className="vendor-name"><E ns="bazaarPage" k="zoldar.name">{t('zoldar.name')}</E></h2>
        <p className="vendor-title"><E ns="bazaarPage" k="zoldar.title">{t('zoldar.title')}</E></p>
        <p className="vendor-desc"><E ns="bazaarPage" k="zoldar.desc">{t('zoldar.desc')}</E></p>
      </div>

      {/* Current tickets */}
      <div className="zoldar-tickets-display">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
          <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9z" />
        </svg>
        <span><E ns="bazaarPage" k="zoldar.currentTickets">{t('zoldar.currentTickets')}</E>: <strong>{tickets}</strong></span>
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

      {successMsg && (
        <div className="vendor-success">
          <span>{successMsg}</span>
        </div>
      )}

      <div className="ticket-grid">
        {packages.map((pkg) => {
          const effectivePrice = applyPassportDiscount(pkg.price, hasPassport);
          const canAfford = balance >= effectivePrice;
          const disabled = !isLoggedIn || hasDebt || !canAfford || !!buying;

          return (
            <div key={pkg.id} className="ticket-card">
              <div className="ticket-card-header">
                <span className="ticket-name">{pkg.name}</span>
              </div>
              <div className="ticket-count">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
                  <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9z" />
                </svg>
                <span>{pkg.tickets}</span>
              </div>
              <div className="ticket-price">
                <PassportPrice price={pkg.price} hasPassport={hasPassport} />
              </div>
              <button
                className="ticket-buy-btn"
                disabled={disabled}
                onClick={() => handleBuy(pkg.id)}
              >
                {buying === pkg.id ? (
                  <span className="luckbox-spinner" />
                ) : hasDebt ? (
                  <E ns="bazaarPage" k="inDebt">{t('inDebt')}</E>
                ) : !canAfford ? (
                  <E ns="bazaarPage" k="insufficientBalance">{t('insufficientBalance')}</E>
                ) : (
                  <E ns="bazaarPage" k="zoldar.buyTickets">{t('zoldar.buyTickets')}</E>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
