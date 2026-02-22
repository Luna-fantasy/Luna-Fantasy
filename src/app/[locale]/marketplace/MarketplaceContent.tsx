'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { onBalanceUpdate, dispatchBalanceUpdate } from '@/lib/balance-events';
import type { MarketplaceListing, ListingsResponse } from '@/types/marketplace';
import ListingCard from './ListingCard';
import CreateListingModal from './CreateListingModal';
import CreateAuctionModal from './CreateAuctionModal';
import AuctionBidModal from './AuctionBidModal';
import MyListings from './MyListings';
import SwapsTab from './SwapsTab';
import CardDetailModal from '@/components/CardDetailModal';
import type { CardDetailData } from '@/components/CardDetailModal';

type Tab = 'browse' | 'my-listings' | 'sell' | 'swaps';
type SellType = 'fixed' | 'auction';

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

export default function MarketplaceContent() {
  const { data: session } = useSession();
  const t = useTranslations('marketplacePage');
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [balance, setBalance] = useState<number | null>(null);
  const [hasDebt, setHasDebt] = useState(false);

  // Browse state
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [browsing, setBrowsing] = useState(true);

  // My listings state
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);

  // Sell modal
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellType, setSellType] = useState<SellType>('fixed');

  // Card detail modal
  const [selectedCard, setSelectedCard] = useState<{ card: CardDetailData; listing: MarketplaceListing } | null>(null);

  // Auction bid modal
  const [biddingListing, setBiddingListing] = useState<MarketplaceListing | null>(null);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isLoggedIn = !!session?.user;

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/bazaar/catalog');
      if (res.ok) {
        const data = await res.json();
        if (data.user?.balance != null) setBalance(data.user.balance);
        if (data.user?.hasDebt != null) setHasDebt(data.user.hasDebt);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchBalance();
  }, [isLoggedIn, fetchBalance]);

  useEffect(() => {
    return onBalanceUpdate((b) => setBalance(b));
  }, []);

  // Fetch listings
  const fetchListings = useCallback(async () => {
    setBrowsing(true);
    try {
      const params = new URLSearchParams({ page: String(page), sort: sortBy });
      if (search) params.set('search', search);
      if (rarityFilter) params.set('rarity', rarityFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/marketplace/listings?${params}`);
      if (res.ok) {
        const data: ListingsResponse = await res.json();
        setListings(data.listings);
        setTotalPages(data.totalPages);
      }
    } catch {}
    setBrowsing(false);
  }, [page, search, rarityFilter, typeFilter, sortBy]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Fetch my listings
  const fetchMyListings = useCallback(async () => {
    if (!isLoggedIn) return;
    setMyListingsLoading(true);
    try {
      const res = await fetch('/api/marketplace/my-listings');
      if (res.ok) {
        const data = await res.json();
        setMyListings(data.listings || []);
      }
    } catch {}
    setMyListingsLoading(false);
  }, [isLoggedIn]);

  useEffect(() => {
    if (activeTab === 'my-listings') fetchMyListings();
  }, [activeTab, fetchMyListings]);

  // Buy handler
  const handleBuy = async (listing: MarketplaceListing) => {
    setSelectedCard(null);
    try {
      const res = await fetch('/api/marketplace/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ listingId: listing.listingId }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: t('buySuccess', { card: listing.card.name }) });
        if (data.newBalance != null) {
          setBalance(data.newBalance);
          dispatchBalanceUpdate(data.newBalance);
        }
        fetchListings();
      } else {
        setStatusMsg({ type: 'error', text: data.error || t('buyError') });
      }
    } catch {
      setStatusMsg({ type: 'error', text: t('buyError') });
    }

    setTimeout(() => setStatusMsg(null), 5000);
  };

  // Bid placed handler
  const handleBidPlaced = (newBid: number, newCount: number) => {
    setBiddingListing(null);
    setStatusMsg({ type: 'success', text: t('auction.bidSuccess', { amount: newBid.toLocaleString() }) });
    fetchListings();
    setTimeout(() => setStatusMsg(null), 5000);
  };

  // Cancel handler
  const handleCancel = async (listingId: string) => {
    try {
      const res = await fetch('/api/marketplace/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ listingId }),
      });

      if (res.ok) {
        setStatusMsg({ type: 'success', text: t('cancelSuccess') });
        fetchMyListings();
      } else {
        const data = await res.json();
        setStatusMsg({ type: 'error', text: data.error || t('cancelError') });
      }
    } catch {
      setStatusMsg({ type: 'error', text: t('cancelError') });
    }

    setTimeout(() => setStatusMsg(null), 5000);
  };

  // Edit price handler
  const handleEditPrice = async (listingId: string, newPrice: number) => {
    try {
      const res = await fetch('/api/marketplace/edit-price', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ listingId, price: newPrice }),
      });

      if (res.ok) {
        setStatusMsg({ type: 'success', text: t('priceUpdated') });
        fetchMyListings();
      } else {
        const data = await res.json();
        setStatusMsg({ type: 'error', text: data.error || t('priceUpdateError') });
      }
    } catch {
      setStatusMsg({ type: 'error', text: t('priceUpdateError') });
    }

    setTimeout(() => setStatusMsg(null), 5000);
  };

  // Resolve auction handler
  const handleResolveAuction = async (listingId: string) => {
    try {
      const res = await fetch('/api/marketplace/auction/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ listingId }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: t('auction.resolveSuccess') });
        fetchMyListings();
      } else {
        setStatusMsg({ type: 'error', text: data.error || t('auction.resolveError') });
      }
    } catch {
      setStatusMsg({ type: 'error', text: t('auction.resolveError') });
    }

    setTimeout(() => setStatusMsg(null), 5000);
  };

  const onListingCreated = () => {
    setShowSellModal(false);
    setActiveTab('my-listings');
    setStatusMsg({ type: 'success', text: t('listingCreated') });
    fetchMyListings();
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const RARITY_OPTIONS = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret'];

  return (
    <div className="marketplace-page">
      {/* Hero */}
      <div className="marketplace-hero">
        <div className="marketplace-hero-bg" />
        <div className="marketplace-hero-content">
          <h1 className="marketplace-hero-title">{t('title')}</h1>
          <p className="marketplace-hero-desc">{t('subtitle')}</p>
        </div>
      </div>

      <div className="marketplace-wrap">
        {/* Status message */}
        {statusMsg && (
          <div className={`marketplace-status marketplace-status-${statusMsg.type}`}>
            <span>{statusMsg.text}</span>
            <button className="marketplace-status-close" onClick={() => setStatusMsg(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Balance bar */}
        {isLoggedIn && balance !== null && (
          <div className="marketplace-balance-bar">
            <div className="marketplace-balance-info">
              <span className="marketplace-balance-label">{t('balance')}</span>
              <span className="marketplace-balance-value">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {balance.toLocaleString()}
              </span>
            </div>
            {hasDebt && (
              <span className="marketplace-debt-badge">{t('inDebt')}</span>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="marketplace-tabs">
          <button
            className={`marketplace-tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            {t('tabs.browse')}
          </button>
          {isLoggedIn && (
            <>
              <button
                className={`marketplace-tab ${activeTab === 'my-listings' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-listings')}
              >
                {t('tabs.myListings')}
              </button>
              <button
                className={`marketplace-tab ${activeTab === 'sell' ? 'active' : ''}`}
                onClick={() => setActiveTab('sell')}
              >
                {t('tabs.sell')}
              </button>
              <button
                className={`marketplace-tab ${activeTab === 'swaps' ? 'active' : ''}`}
                onClick={() => setActiveTab('swaps')}
              >
                {t('tabs.swaps')}
              </button>
            </>
          )}
        </div>

        {/* Browse tab */}
        {activeTab === 'browse' && (
          <div className="marketplace-browse">
            {/* Filters */}
            <div className="marketplace-filters">
              <input
                type="text"
                className="marketplace-search"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              <select
                className="marketplace-select"
                value={rarityFilter}
                onChange={(e) => { setRarityFilter(e.target.value); setPage(1); }}
              >
                <option value="">{t('allRarities')}</option>
                {RARITY_OPTIONS.map(r => (
                  <option key={r} value={r}>{t(`rarity.${r}` as any)}</option>
                ))}
              </select>
              <select
                className="marketplace-select"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="">{t('allTypes')}</option>
                <option value="fixed_price">{t('typeFixed')}</option>
                <option value="auction">{t('typeAuction')}</option>
              </select>
              <select
                className="marketplace-select"
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              >
                <option value="newest">{t('sort.newest')}</option>
                <option value="oldest">{t('sort.oldest')}</option>
                <option value="price_asc">{t('sort.priceAsc')}</option>
                <option value="price_desc">{t('sort.priceDesc')}</option>
                <option value="ending_soon">{t('sort.endingSoon')}</option>
                <option value="most_bids">{t('sort.mostBids')}</option>
              </select>
            </div>

            {/* Listings grid */}
            {browsing ? (
              <div className="marketplace-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="listing-card listing-card-skeleton">
                    <div className="skeleton" style={{ width: '100%', aspectRatio: '2/3' }} />
                    <div className="skeleton" style={{ width: '70%', height: 14, marginTop: 8 }} />
                    <div className="skeleton" style={{ width: '50%', height: 12, marginTop: 4 }} />
                  </div>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="marketplace-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <path d="M8 7h8M8 12h8M8 17h4" />
                </svg>
                <p>{t('noListings')}</p>
              </div>
            ) : (
              <div className="marketplace-grid">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.listingId}
                    listing={listing}
                    onBuy={() => handleBuy(listing)}
                    onBid={() => setBiddingListing(listing)}
                    onViewDetail={() => {
                      setSelectedCard({
                        card: {
                          id: listing.card.id,
                          name: listing.card.name,
                          rarity: listing.card.rarity,
                          imageUrl: listing.card.imageUrl,
                          attack: listing.card.attack,
                          weight: listing.card.weight,
                          source: listing.card.source,
                          owned: false,
                        },
                        listing,
                      });
                    }}
                    isLoggedIn={isLoggedIn}
                    isOwnListing={listing.sellerId === session?.user?.discordId}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="marketplace-pagination">
                <button
                  className="marketplace-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="marketplace-page-info">{page} / {totalPages}</span>
                <button
                  className="marketplace-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* My Listings tab */}
        {activeTab === 'my-listings' && isLoggedIn && (
          <MyListings
            listings={myListings}
            isLoading={myListingsLoading}
            onCancel={handleCancel}
            onEditPrice={handleEditPrice}
            onResolveAuction={handleResolveAuction}
          />
        )}

        {/* Swaps tab */}
        {activeTab === 'swaps' && isLoggedIn && (
          <SwapsTab
            onStatusMsg={(msg) => {
              setStatusMsg(msg);
              setTimeout(() => setStatusMsg(null), 5000);
            }}
          />
        )}

        {/* Sell tab — type selection then modal */}
        {activeTab === 'sell' && isLoggedIn && !showSellModal && (
          <div className="marketplace-sell-type-picker">
            <h3 className="marketplace-sell-type-title">{t('sellTypeTitle')}</h3>
            <div className="marketplace-sell-type-options">
              <button
                className={`marketplace-sell-type-btn ${sellType === 'fixed' ? 'active' : ''}`}
                onClick={() => setSellType('fixed')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span className="sell-type-label">{t('sellTypeFixed')}</span>
                <span className="sell-type-desc">{t('sellTypeFixedDesc')}</span>
              </button>
              <button
                className={`marketplace-sell-type-btn ${sellType === 'auction' ? 'active' : ''}`}
                onClick={() => setSellType('auction')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span className="sell-type-label">{t('sellTypeAuction')}</span>
                <span className="sell-type-desc">{t('sellTypeAuctionDesc')}</span>
              </button>
            </div>
            <button
              className="marketplace-sell-continue-btn"
              onClick={() => setShowSellModal(true)}
            >
              {t('continue')}
            </button>
          </div>
        )}

        {/* Fixed price sell modal */}
        {showSellModal && isLoggedIn && sellType === 'fixed' && (
          <CreateListingModal
            onClose={() => { setShowSellModal(false); }}
            onCreated={onListingCreated}
          />
        )}

        {/* Auction sell modal */}
        {showSellModal && isLoggedIn && sellType === 'auction' && (
          <CreateAuctionModal
            onClose={() => { setShowSellModal(false); }}
            onCreated={onListingCreated}
          />
        )}

        {/* Auction bid modal */}
        {biddingListing && (
          <AuctionBidModal
            listing={biddingListing}
            onClose={() => setBiddingListing(null)}
            onBidPlaced={handleBidPlaced}
          />
        )}

        {/* Card Detail Modal for listing */}
        {selectedCard && (
          <CardDetailModal
            card={selectedCard.card}
            onClose={() => setSelectedCard(null)}
            actions={
              isLoggedIn && !selectedCard.listing.sellerId?.includes(session?.user?.discordId ?? '') ? (
                selectedCard.listing.type === 'auction' ? (
                  <button
                    className="card-detail-action-primary"
                    onClick={() => {
                      setSelectedCard(null);
                      setBiddingListing(selectedCard.listing);
                    }}
                  >
                    {t('auction.placeBid')}
                  </button>
                ) : (
                  <button
                    className="card-detail-action-primary"
                    onClick={() => handleBuy(selectedCard.listing)}
                  >
                    {t('buyFor', { price: selectedCard.listing.price.toLocaleString() })}
                  </button>
                )
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
