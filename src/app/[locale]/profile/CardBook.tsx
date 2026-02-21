'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { UserCard, CatalogCard } from '@/types/gameData';

const RARITY_ORDER = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret', 'forbidden', 'mythical'] as const;

const CARDS_PER_PAGE = 9;
const CARDS_PER_SPREAD = 18;

interface MergedCard {
  id: string;
  name: string;
  rarity: string;
  imageUrl: string;
  attack?: number;
  owned: boolean;
}

interface CardBookProps {
  ownedCards: UserCard[];
  catalogCards: CatalogCard[];
  isLoading: boolean;
  onCardClick: (src: string, caption: string) => void;
  brokenImages: Set<string>;
  onImageError: (id: string) => void;
}

function getRarityIndex(rarity: string): number {
  const idx = RARITY_ORDER.indexOf(rarity.toLowerCase() as any);
  return idx === -1 ? RARITY_ORDER.length : idx;
}

export default function CardBook({
  ownedCards,
  catalogCards,
  isLoading,
  onCardClick,
  brokenImages,
  onImageError,
}: CardBookProps) {
  const t = useTranslations('profilePage');
  const [currentPage, setCurrentPage] = useState(0);
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [showOwnedOnly, setShowOwnedOnly] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Merge catalog with owned cards (fallback: if catalog is empty, show owned cards directly)
  const mergedCards = useMemo(() => {
    if (catalogCards.length === 0) {
      // No catalog yet — just display owned cards as all-owned entries
      const merged: MergedCard[] = ownedCards.map((c, idx) => ({
        id: c.id || `owned-${idx}`,
        name: c.name,
        rarity: c.rarity,
        imageUrl: c.imageUrl,
        attack: c.attack,
        owned: true,
      }));
      merged.sort((a, b) => {
        const ri = getRarityIndex(a.rarity) - getRarityIndex(b.rarity);
        if (ri !== 0) return ri;
        return (b.attack ?? 0) - (a.attack ?? 0);
      });
      return merged;
    }

    const ownedNames = new Set(ownedCards.map(c => c.name));
    const ownedMap = new Map<string, UserCard>();
    for (const c of ownedCards) {
      if (!ownedMap.has(c.name)) ownedMap.set(c.name, c);
    }

    const merged: MergedCard[] = catalogCards.map((cat) => {
      const owned = ownedNames.has(cat.name);
      const ownedCard = ownedMap.get(cat.name);
      return {
        id: cat.id,
        name: cat.name,
        rarity: cat.rarity,
        imageUrl: owned && ownedCard?.imageUrl ? ownedCard.imageUrl : cat.imageUrl,
        attack: owned && ownedCard ? ownedCard.attack : cat.attack,
        owned,
      };
    });

    // Sort: rarity order, then attack descending
    merged.sort((a, b) => {
      const ri = getRarityIndex(a.rarity) - getRarityIndex(b.rarity);
      if (ri !== 0) return ri;
      return (b.attack ?? 0) - (a.attack ?? 0);
    });

    return merged;
  }, [ownedCards, catalogCards]);

  // Filter
  const filteredCards = useMemo(() => {
    let cards = mergedCards;
    if (rarityFilter) {
      cards = cards.filter(c => c.rarity.toLowerCase() === rarityFilter);
    }
    if (showOwnedOnly) {
      cards = cards.filter(c => c.owned);
    }
    return cards;
  }, [mergedCards, rarityFilter, showOwnedOnly]);

  // Rarity stats for filter pills
  const rarityStats = useMemo(() => {
    const stats: Record<string, { total: number; owned: number }> = {};
    for (const card of mergedCards) {
      const r = card.rarity.toLowerCase();
      if (!stats[r]) stats[r] = { total: 0, owned: 0 };
      stats[r].total++;
      if (card.owned) stats[r].owned++;
    }
    return stats;
  }, [mergedCards]);

  // Detect mobile (SSR-safe)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  const cardsPerView = isMobile ? CARDS_PER_PAGE : CARDS_PER_SPREAD;
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / cardsPerView));

  // Clamp page
  const safePage = Math.min(currentPage, totalPages - 1);
  if (safePage !== currentPage) setCurrentPage(safePage);

  const startIdx = safePage * cardsPerView;
  const pageCards = filteredCards.slice(startIdx, startIdx + cardsPerView);
  const leftPageCards = pageCards.slice(0, CARDS_PER_PAGE);
  const rightPageCards = pageCards.slice(CARDS_PER_PAGE, CARDS_PER_SPREAD);

  // Overall progress
  const totalCatalog = mergedCards.length;
  const totalOwned = mergedCards.filter(c => c.owned).length;
  const progressPercent = totalCatalog > 0 ? Math.round((totalOwned / totalCatalog) * 100) : 0;

  const goToPage = useCallback((dir: 'left' | 'right', page: number) => {
    setFlipDirection(dir);
    setTimeout(() => {
      setCurrentPage(page);
      setFlipDirection(null);
    }, 300);
  }, []);

  const prevPage = () => {
    if (safePage > 0) goToPage('right', safePage - 1);
  };

  const nextPage = () => {
    if (safePage < totalPages - 1) goToPage('left', safePage + 1);
  };

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const isRtl = document.documentElement.dir === 'rtl';
    if (Math.abs(delta) > 50) {
      const swipeLeft = isRtl ? delta > 0 : delta < 0;
      if (swipeLeft) nextPage();
      else prevPage();
    }
  };

  if (isLoading) {
    return (
      <div className="book-wrapper">
        <div className="book-page book-page-left">
          {Array.from({ length: CARDS_PER_PAGE }).map((_, i) => (
            <div key={i} className="book-card book-card-skeleton">
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            </div>
          ))}
        </div>
        <div className="book-spine" />
        <div className="book-page book-page-right">
          {Array.from({ length: CARDS_PER_PAGE }).map((_, i) => (
            <div key={i} className="book-card book-card-skeleton">
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasCatalog = catalogCards.length > 0;

  return (
    <div className="book-container">
      {/* Collection progress — only show when catalog exists (owned vs unowned is meaningful) */}
      {hasCatalog && (
        <div className="book-progress">
          <div className="book-progress-text">
            {t('collection.bookCollected', { owned: totalOwned, total: totalCatalog })}
          </div>
          <div className="book-progress-bar">
            <div className="book-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Rarity filter pills */}
      <div className="book-filters">
        <button
          className={`book-rarity-btn ${!rarityFilter && !showOwnedOnly ? 'active' : ''}`}
          onClick={() => { setRarityFilter(null); setShowOwnedOnly(false); setCurrentPage(0); }}
        >
          {t('collection.bookAll')}
        </button>
        {RARITY_ORDER.map(r => {
          const stat = rarityStats[r];
          if (!stat) return null;
          return (
            <button
              key={r}
              className={`book-rarity-btn rarity-pill-${r} ${rarityFilter === r ? 'active' : ''}`}
              onClick={() => { setRarityFilter(rarityFilter === r ? null : r); setCurrentPage(0); }}
            >
              {t(`rarity.${r}`)}
              <span className="book-rarity-count">{stat.owned}/{stat.total}</span>
            </button>
          );
        })}
        {hasCatalog && (
          <button
            className={`book-rarity-btn book-owned-btn ${showOwnedOnly ? 'active' : ''}`}
            onClick={() => { setShowOwnedOnly(!showOwnedOnly); setCurrentPage(0); }}
          >
            {t('collection.bookOwned')}
          </button>
        )}
      </div>

      {/* Book spread */}
      {filteredCards.length === 0 ? (
        <div className="collection-empty">
          <div className="collection-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <path d="M8 7h8M8 12h8M8 17h4" />
            </svg>
          </div>
          <p>{t('collection.empty')}</p>
        </div>
      ) : (
        <div
          className={`book-wrapper ${flipDirection === 'left' ? 'flip-left' : flipDirection === 'right' ? 'flip-right' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Left page */}
          <div className="book-page book-page-left">
            {leftPageCards.map((card) => (
              <BookCard
                key={card.id}
                card={card}
                isBroken={brokenImages.has(card.id)}
                onImageError={onImageError}
                onCardClick={onCardClick}
              />
            ))}
          </div>

          {/* Spine */}
          <div className="book-spine" />

          {/* Right page */}
          <div className="book-page book-page-right">
            {rightPageCards.map((card) => (
              <BookCard
                key={card.id}
                card={card}
                isBroken={brokenImages.has(card.id)}
                onImageError={onImageError}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      {filteredCards.length > 0 && (
        <div className="book-nav">
          <button
            className="book-nav-btn"
            onClick={prevPage}
            disabled={safePage === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('collection.bookPrev')}
          </button>

          <span className="book-page-indicator">
            {safePage + 1} {t('collection.bookOf')} {totalPages}
          </span>

          <button
            className="book-nav-btn"
            onClick={nextPage}
            disabled={safePage >= totalPages - 1}
          >
            {t('collection.bookNext')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function BookCard({
  card,
  isBroken,
  onImageError,
  onCardClick,
}: {
  card: MergedCard;
  isBroken: boolean;
  onImageError: (id: string) => void;
  onCardClick: (src: string, caption: string) => void;
}) {
  const rKey = card.rarity.toLowerCase();

  return (
    <div
      className={`book-card ${card.owned ? 'book-card-owned' : 'book-card-unowned'}`}
      onClick={() => {
        if (card.owned && !isBroken && card.imageUrl) {
          onCardClick(card.imageUrl, card.name);
        }
      }}
    >
      <div className={`book-card-image rarity-border-${rKey}`}>
        {isBroken || !card.imageUrl ? (
          <div className={`mini-card-placeholder rarity-bg-${rKey}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <path d="M8 7h8M8 12h8M8 17h4" />
            </svg>
          </div>
        ) : (
          <img
            src={card.imageUrl}
            alt={card.name}
            onError={() => onImageError(card.id)}
          />
        )}
        {!card.owned && (
          <div className="book-card-lock">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        )}
        <span className={`book-card-rarity rarity-${rKey}`}>{card.rarity}</span>
      </div>
      <div className="book-card-name">{card.name}</div>
      {card.attack != null && (
        <div className="book-card-attack">ATK {card.attack}</div>
      )}
    </div>
  );
}
