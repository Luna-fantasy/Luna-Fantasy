'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { SwapCard, PublicUserCards } from '@/types/marketplace';

interface SwapProposalModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

type Step = 'search' | 'pickMyCard' | 'pickTheirCard' | 'confirm';

export default function SwapProposalModal({ onClose, onCreated }: SwapProposalModalProps) {
  const t = useTranslations('swapsPage');

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserCards | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [myCards, setMyCards] = useState<SwapCard[]>([]);
  const [myCardsLoading, setMyCardsLoading] = useState(false);
  const [selectedMyCard, setSelectedMyCard] = useState<SwapCard | null>(null);
  const [selectedTheirCard, setSelectedTheirCard] = useState<SwapCard | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  // Fetch my cards
  const fetchMyCards = useCallback(async () => {
    setMyCardsLoading(true);
    try {
      const res = await fetch('/api/profile/game-data');
      if (res.ok) {
        const data = await res.json();
        const allCards = [
          ...(data.cardsByGame?.lunaFantasy || []),
        ];
        setMyCards(allCards);
      }
    } catch {}
    setMyCardsLoading(false);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResults(null);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(searchQuery.trim())}/cards`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        const data = await res.json();
        setSearchError(data.error || t('userNotFound'));
      }
    } catch {
      setSearchError(t('searchError'));
    }
    setSearching(false);
  };

  const handleSelectUser = () => {
    fetchMyCards();
    setStep('pickMyCard');
  };

  const handleSubmit = async () => {
    if (!selectedMyCard || !selectedTheirCard || !searchResults) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/swaps/propose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          targetId: searchResults.discordId,
          requesterCardId: selectedMyCard.id,
          targetCardId: selectedTheirCard.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onCreated();
      } else {
        setError(data.error || t('proposeError'));
      }
    } catch {
      setError(t('proposeError'));
    }

    setSubmitting(false);
  };

  return (
    <div className="create-listing-overlay" onClick={onClose}>
      <div className="create-listing-modal swap-proposal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="create-listing-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h3 className="create-listing-title">{t('proposeSwap')}</h3>

        {/* Step 1: Search user */}
        {step === 'search' && (
          <div className="swap-search-step">
            <p className="create-listing-label">{t('searchUser')}</p>
            <div className="swap-search-bar">
              <input
                type="text"
                className="create-listing-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('discordIdPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              <button
                className="swap-search-btn"
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? '...' : t('search')}
              </button>
            </div>

            {searchError && <p className="create-listing-error">{searchError}</p>}

            {searchResults && (
              <div className="swap-search-result">
                <div className="swap-search-user">
                  <span className="swap-search-username">{searchResults.username}</span>
                  <span className="swap-search-card-count">
                    {searchResults.cards.length} {t('cards')}
                  </span>
                </div>
                <button className="swap-search-select-btn" onClick={handleSelectUser}>
                  {t('selectUser')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pick my card */}
        {step === 'pickMyCard' && (
          <div className="create-listing-picker">
            <p className="create-listing-label">{t('pickYourCard')}</p>
            {myCardsLoading ? (
              <div className="create-listing-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ width: '100%', aspectRatio: '2/3', borderRadius: 8 }} />
                ))}
              </div>
            ) : myCards.length === 0 ? (
              <p className="create-listing-empty">{t('noCards')}</p>
            ) : (
              <div className="create-listing-grid">
                {myCards.map((card) => {
                  const r = card.rarity.toLowerCase();
                  return (
                    <div
                      key={card.id}
                      className={`create-listing-card ${selectedMyCard?.id === card.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedMyCard(card); setStep('pickTheirCard'); }}
                    >
                      <div className={`create-listing-card-img rarity-border-${r}`}>
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.name} />
                        ) : (
                          <div className={`mini-card-placeholder rarity-bg-${r}`} />
                        )}
                      </div>
                      <span className="create-listing-card-name">{card.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="create-listing-back" onClick={() => setStep('search')} style={{ marginTop: 12 }}>
              {t('back')}
            </button>
          </div>
        )}

        {/* Step 3: Pick their card */}
        {step === 'pickTheirCard' && searchResults && (
          <div className="create-listing-picker">
            <p className="create-listing-label">{t('pickTheirCard', { user: searchResults.username })}</p>
            {searchResults.cards.length === 0 ? (
              <p className="create-listing-empty">{t('theyHaveNoCards')}</p>
            ) : (
              <div className="create-listing-grid">
                {searchResults.cards.map((card) => {
                  const r = card.rarity.toLowerCase();
                  return (
                    <div
                      key={card.id}
                      className={`create-listing-card ${selectedTheirCard?.id === card.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedTheirCard(card); setStep('confirm'); }}
                    >
                      <div className={`create-listing-card-img rarity-border-${r}`}>
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.name} />
                        ) : (
                          <div className={`mini-card-placeholder rarity-bg-${r}`} />
                        )}
                      </div>
                      <span className="create-listing-card-name">{card.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="create-listing-back" onClick={() => setStep('pickMyCard')} style={{ marginTop: 12 }}>
              {t('back')}
            </button>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && selectedMyCard && selectedTheirCard && searchResults && (
          <div className="swap-confirm-step">
            <div className="swap-confirm-comparison">
              <div className="swap-confirm-card">
                <span className="swap-confirm-label">{t('yourCard')}</span>
                <div className={`swap-confirm-card-img rarity-border-${selectedMyCard.rarity.toLowerCase()}`}>
                  {selectedMyCard.imageUrl ? (
                    <img src={selectedMyCard.imageUrl} alt={selectedMyCard.name} />
                  ) : (
                    <div className={`mini-card-placeholder rarity-bg-${selectedMyCard.rarity.toLowerCase()}`} />
                  )}
                </div>
                <span className="swap-confirm-card-name">{selectedMyCard.name}</span>
              </div>

              <div className="swap-confirm-arrow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>

              <div className="swap-confirm-card">
                <span className="swap-confirm-label">{t('theirCard')}</span>
                <div className={`swap-confirm-card-img rarity-border-${selectedTheirCard.rarity.toLowerCase()}`}>
                  {selectedTheirCard.imageUrl ? (
                    <img src={selectedTheirCard.imageUrl} alt={selectedTheirCard.name} />
                  ) : (
                    <div className={`mini-card-placeholder rarity-bg-${selectedTheirCard.rarity.toLowerCase()}`} />
                  )}
                </div>
                <span className="swap-confirm-card-name">{selectedTheirCard.name}</span>
              </div>
            </div>

            {/* Escrow warning */}
            <div className="create-listing-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{t('escrowWarning')}</span>
            </div>

            {error && <p className="create-listing-error">{error}</p>}

            <div className="create-listing-actions">
              <button className="create-listing-back" onClick={() => setStep('pickTheirCard')}>
                {t('back')}
              </button>
              <button
                className="create-listing-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? t('proposing') : t('proposeSwap')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
