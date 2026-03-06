'use client';

import { useTranslations } from 'next-intl';
import type { MarketplaceListing } from '@/types/marketplace';
import LunariIcon from '@/components/LunariIcon';

interface ListingCardProps {
  listing: MarketplaceListing;
  onBuy: () => void;
  onBid?: () => void;
  onViewDetail: () => void;
  isLoggedIn: boolean;
  isOwnListing: boolean;
}

function timeRemaining(expiresAt: Date | string): string {
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = expires - now;
  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) return `${days}d ${remainingHours}h`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m`;
}

export default function ListingCard({
  listing,
  onBuy,
  onBid,
  onViewDetail,
  isLoggedIn,
  isOwnListing,
}: ListingCardProps) {
  const t = useTranslations('marketplacePage');
  const rKey = listing.card.rarity.toLowerCase();
  const isAuction = listing.type === 'auction';

  return (
    <div className={`listing-card ${isAuction ? 'listing-card-auction' : ''}`} onClick={onViewDetail}>
      {/* Auction badge */}
      {isAuction && (
        <span className="listing-card-auction-badge">{t('auction.badge')}</span>
      )}

      {/* Card image */}
      <div className={`listing-card-image rarity-border-${rKey}`}>
        {listing.card.imageUrl ? (
          <img src={listing.card.imageUrl} alt={listing.card.name} />
        ) : (
          <div className={`mini-card-placeholder rarity-bg-${rKey}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <path d="M8 7h8M8 12h8M8 17h4" />
            </svg>
          </div>
        )}
        <span className={`listing-card-rarity rarity-${rKey}`}>{listing.card.rarity}</span>
      </div>

      {/* Card info */}
      <div className="listing-card-info">
        <div className="listing-card-name">{listing.card.name}</div>

        {listing.card.attack != null && (
          <span className="listing-card-atk">ATK {listing.card.attack}</span>
        )}

        {/* Price / Bid info */}
        {isAuction ? (
          <div className="listing-card-auction-info">
            <div className="listing-card-price">
              <LunariIcon size={12} />
              <span>
                {(listing.currentBid || listing.auctionConfig?.startingPrice || listing.price).toLocaleString()}
              </span>
            </div>
            <div className="listing-card-bid-count">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
              </svg>
              <span>{listing.bidCount || 0} {t('auction.bids')}</span>
            </div>
          </div>
        ) : (
          <div className="listing-card-price">
            <LunariIcon size={12} />
            <span>{listing.price.toLocaleString()}</span>
          </div>
        )}

        {/* Seller + time */}
        <div className="listing-card-meta">
          <span className="listing-card-seller">{listing.sellerName}</span>
          <span className={`listing-card-time ${isAuction ? 'listing-card-time-auction' : ''}`}>
            {timeRemaining(listing.expiresAt)}
          </span>
        </div>
      </div>

      {/* Action button */}
      {isLoggedIn && !isOwnListing && (
        isAuction ? (
          <button
            className="listing-card-buy-btn listing-card-bid-btn"
            onClick={(e) => {
              e.stopPropagation();
              onBid?.();
            }}
          >
            {t('auction.bid')}
          </button>
        ) : (
          <button
            className="listing-card-buy-btn"
            onClick={(e) => {
              e.stopPropagation();
              onBuy();
            }}
          >
            {t('buy')}
          </button>
        )
      )}
    </div>
  );
}
