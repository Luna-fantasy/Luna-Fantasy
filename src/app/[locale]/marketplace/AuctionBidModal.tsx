'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { MarketplaceListing } from '@/types/marketplace';
import LunariIcon from '@/components/LunariIcon';

interface AuctionBidModalProps {
  listing: MarketplaceListing;
  onClose: () => void;
  onBidPlaced: (newBid: number, newCount: number) => void;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

function getMinBidIncrement(currentBid: number): number {
  return Math.max(100, Math.floor(currentBid * 0.05));
}

function timeRemaining(expiresAt: Date | string): string {
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = expires - now;
  if (diff <= 0) return 'Ended';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${remainingHours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AuctionBidModal({ listing, onClose, onBidPlaced }: AuctionBidModalProps) {
  const t = useTranslations('marketplacePage');
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentBid = listing.currentBid || 0;
  const startingPrice = listing.auctionConfig?.startingPrice || 0;
  const minBid = currentBid > 0
    ? currentBid + getMinBidIncrement(currentBid)
    : startingPrice;

  useEffect(() => {
    setBidAmount(String(minBid));
  }, [minBid]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSubmit = async () => {
    const num = parseInt(bidAmount, 10);
    if (!num || num < minBid) {
      setError(t('auction.minBidError', { min: minBid.toLocaleString() }));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/marketplace/auction/bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ listingId: listing.listingId, bidAmount: num }),
      });

      const data = await res.json();
      if (res.ok) {
        onBidPlaced(data.currentBid, data.bidCount);
      } else {
        setError(data.error || t('auction.bidError'));
      }
    } catch {
      setError(t('auction.bidError'));
    }

    setSubmitting(false);
  };

  const rKey = listing.card.rarity.toLowerCase();

  return (
    <div className="create-listing-overlay" onClick={onClose}>
      <div className="create-listing-modal auction-bid-modal" onClick={(e) => e.stopPropagation()}>
        <button className="create-listing-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h3 className="create-listing-title">{t('auction.placeBid')}</h3>

        {/* Card preview */}
        <div className="create-listing-preview">
          <div className={`create-listing-preview-img rarity-border-${rKey}`}>
            {listing.card.imageUrl ? (
              <img src={listing.card.imageUrl} alt={listing.card.name} />
            ) : (
              <div className={`mini-card-placeholder rarity-bg-${rKey}`} />
            )}
          </div>
          <div className="create-listing-preview-info">
            <span className="create-listing-preview-name">{listing.card.name}</span>
            <span className={`create-listing-preview-rarity rarity-${rKey}`}>{listing.card.rarity}</span>
          </div>
        </div>

        {/* Auction info */}
        <div className="auction-bid-info">
          <div className="auction-bid-stat">
            <span className="auction-bid-stat-label">{t('auction.currentBid')}</span>
            <span className="auction-bid-stat-value">
              <LunariIcon size={12} />
              {currentBid > 0 ? currentBid.toLocaleString() : t('auction.noBids')}
            </span>
          </div>
          <div className="auction-bid-stat">
            <span className="auction-bid-stat-label">{t('auction.bids')}</span>
            <span className="auction-bid-stat-value">{listing.bidCount || 0}</span>
          </div>
          <div className="auction-bid-stat">
            <span className="auction-bid-stat-label">{t('auction.timeLeft')}</span>
            <span className="auction-bid-stat-value auction-bid-countdown">{timeRemaining(listing.expiresAt)}</span>
          </div>
        </div>

        {/* Bid input */}
        <div className="create-listing-price-input">
          <label className="create-listing-label">
            {t('auction.yourBid')} ({t('auction.minimum')}: {minBid.toLocaleString()})
          </label>
          <div className="create-listing-input-wrap">
            <LunariIcon size={14} />
            <input
              type="number"
              className="create-listing-input"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              min={minBid}
              autoFocus
            />
          </div>
        </div>

        {/* Warning */}
        <div className="create-listing-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{t('auction.bidWarning')}</span>
        </div>

        {error && <p className="create-listing-error">{error}</p>}

        {/* Actions */}
        <div className="create-listing-actions">
          <button className="create-listing-back" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="create-listing-submit auction-bid-submit"
            onClick={handleSubmit}
            disabled={submitting || !bidAmount}
          >
            {submitting ? t('auction.bidding') : t('auction.placeBid')}
          </button>
        </div>
      </div>
    </div>
  );
}
