'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MarketplaceListing } from '@/types/marketplace';

interface MyListingsProps {
  listings: MarketplaceListing[];
  isLoading: boolean;
  onCancel: (listingId: string) => void;
  onEditPrice: (listingId: string, newPrice: number) => void;
  onResolveAuction?: (listingId: string) => void;
}

export default function MyListings({ listings, isLoading, onCancel, onEditPrice, onResolveAuction }: MyListingsProps) {
  const t = useTranslations('marketplacePage');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const activeListings = listings.filter(l => l.status === 'active');
  const pastListings = listings.filter(l => l.status !== 'active');

  const handleSavePrice = (listingId: string) => {
    const num = parseInt(editPrice, 10);
    if (num >= 50 && num <= 500000) {
      onEditPrice(listingId, num);
      setEditingId(null);
      setEditPrice('');
    }
  };

  if (isLoading) {
    return (
      <div className="my-listings">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: '100%', height: 80, borderRadius: 12, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="my-listings">
      {/* Active listings */}
      {activeListings.length > 0 && (
        <div className="my-listings-section">
          <h3 className="my-listings-heading">{t('activeListings')}</h3>
          <div className="my-listings-list">
            {activeListings.map((listing) => {
              const rKey = listing.card.rarity.toLowerCase();
              const isAuction = listing.type === 'auction';
              const hasBids = isAuction && listing.bidCount && listing.bidCount > 0;

              return (
                <div key={listing.listingId} className={`my-listing-item ${isAuction ? 'my-listing-auction' : ''}`}>
                  <div className={`my-listing-img rarity-border-${rKey}`}>
                    {listing.card.imageUrl ? (
                      <img src={listing.card.imageUrl} alt={listing.card.name} />
                    ) : (
                      <div className={`mini-card-placeholder rarity-bg-${rKey}`} />
                    )}
                  </div>
                  <div className="my-listing-info">
                    <span className="my-listing-name">{listing.card.name}</span>
                    <span className={`my-listing-rarity rarity-${rKey}`}>{listing.card.rarity}</span>
                    {isAuction && (
                      <span className="my-listing-auction-tag">{t('auction.badge')}</span>
                    )}
                  </div>
                  <div className="my-listing-price-section">
                    {isAuction ? (
                      <div className="my-listing-auction-stats">
                        <span className="my-listing-price">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {(listing.currentBid || listing.auctionConfig?.startingPrice || listing.price).toLocaleString()}
                        </span>
                        <span className="my-listing-bid-count">
                          {listing.bidCount || 0} {t('auction.bids')}
                        </span>
                      </div>
                    ) : editingId === listing.listingId ? (
                      <div className="my-listing-edit-price">
                        <input
                          type="number"
                          className="my-listing-price-input"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          min={50}
                          max={500000}
                          autoFocus
                        />
                        <button
                          className="my-listing-save-btn"
                          onClick={() => handleSavePrice(listing.listingId)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          className="my-listing-cancel-edit-btn"
                          onClick={() => { setEditingId(null); setEditPrice(''); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <span className="my-listing-price" onClick={() => { setEditingId(listing.listingId); setEditPrice(String(listing.price)); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        {listing.price.toLocaleString()}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="my-listing-actions">
                    {isAuction && hasBids && onResolveAuction && (
                      <button
                        className="my-listing-resolve-btn"
                        onClick={() => onResolveAuction(listing.listingId)}
                      >
                        {t('auction.acceptBid')}
                      </button>
                    )}
                    {/* Can only cancel auctions with no bids, or any fixed price listing */}
                    {(!isAuction || !hasBids) && (
                      <button
                        className="my-listing-cancel-btn"
                        onClick={() => onCancel(listing.listingId)}
                      >
                        {t('cancelListing')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past listings */}
      {pastListings.length > 0 && (
        <div className="my-listings-section">
          <h3 className="my-listings-heading">{t('pastListings')}</h3>
          <div className="my-listings-list">
            {pastListings.map((listing) => {
              const rKey = listing.card.rarity.toLowerCase();
              return (
                <div key={listing.listingId} className="my-listing-item my-listing-past">
                  <div className={`my-listing-img rarity-border-${rKey}`}>
                    {listing.card.imageUrl ? (
                      <img src={listing.card.imageUrl} alt={listing.card.name} />
                    ) : (
                      <div className={`mini-card-placeholder rarity-bg-${rKey}`} />
                    )}
                  </div>
                  <div className="my-listing-info">
                    <span className="my-listing-name">{listing.card.name}</span>
                    <span className={`my-listing-status my-listing-status-${listing.status}`}>
                      {t(`status.${listing.status}` as any)}
                    </span>
                    {listing.type === 'auction' && (
                      <span className="my-listing-auction-tag">{t('auction.badge')}</span>
                    )}
                  </div>
                  <div className="my-listing-price-section">
                    <span className="my-listing-price">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      {listing.price.toLocaleString()}
                    </span>
                  </div>
                  {listing.buyerName && (
                    <span className="my-listing-buyer">
                      {t('soldTo', { buyer: listing.buyerName })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {listings.length === 0 && (
        <div className="marketplace-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <path d="M8 7h8M8 12h8M8 17h4" />
          </svg>
          <p>{t('noMyListings')}</p>
        </div>
      )}
    </div>
  );
}
