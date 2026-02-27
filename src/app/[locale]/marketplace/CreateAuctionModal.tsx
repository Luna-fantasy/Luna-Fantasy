'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { UserCard } from '@/types/gameData';

interface CreateAuctionModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

const DURATION_OPTIONS = [
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
  { value: 72, label: '72h' },
] as const;

export default function CreateAuctionModal({ onClose, onCreated }: CreateAuctionModalProps) {
  const t = useTranslations('marketplacePage');
  const [cards, setCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
  const [startingPrice, setStartingPrice] = useState('');
  const [duration, setDuration] = useState<24 | 48 | 72>(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/game-data');
      if (res.ok) {
        const data = await res.json();
        const allCards: UserCard[] = [
          ...(data.cardsByGame?.lunaFantasy || []),
        ];
        setCards(allCards);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

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
    if (!selectedCard) return;
    const priceNum = parseInt(startingPrice, 10);
    if (!priceNum || priceNum < 50 || priceNum > 500000) {
      setError(t('priceRange'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/marketplace/auction/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          cardId: selectedCard.id,
          startingPrice: priceNum,
          duration,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onCreated();
      } else {
        setError(data.error || t('listError'));
      }
    } catch {
      setError(t('listError'));
    }

    setSubmitting(false);
  };

  const rKey = selectedCard?.rarity?.toLowerCase() || '';

  return (
    <div className="create-listing-overlay" onClick={onClose}>
      <div className="create-listing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="create-listing-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h3 className="create-listing-title">{t('auction.createAuction')}</h3>

        {!selectedCard ? (
          <div className="create-listing-picker">
            <p className="create-listing-label">{t('selectCard')}</p>
            {loading ? (
              <div className="create-listing-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ width: '100%', aspectRatio: '2/3', borderRadius: 8 }} />
                ))}
              </div>
            ) : cards.length === 0 ? (
              <p className="create-listing-empty">{t('noCards')}</p>
            ) : (
              <div className="create-listing-grid">
                {cards.map((card) => {
                  const r = card.rarity.toLowerCase();
                  return (
                    <div
                      key={card.id}
                      className="create-listing-card"
                      onClick={() => setSelectedCard(card)}
                    >
                      <div className={`create-listing-card-img rarity-border-${r}`}>
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.name} />
                        ) : (
                          <div className={`mini-card-placeholder rarity-bg-${r}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2" y="3" width="20" height="18" rx="2" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="create-listing-card-name">{card.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="create-listing-confirm">
            {/* Card preview */}
            <div className="create-listing-preview">
              <div className={`create-listing-preview-img rarity-border-${rKey}`}>
                {selectedCard.imageUrl ? (
                  <img src={selectedCard.imageUrl} alt={selectedCard.name} />
                ) : (
                  <div className={`mini-card-placeholder rarity-bg-${rKey}`} />
                )}
              </div>
              <div className="create-listing-preview-info">
                <span className="create-listing-preview-name">{selectedCard.name}</span>
                <span className={`create-listing-preview-rarity rarity-${rKey}`}>{selectedCard.rarity}</span>
                {selectedCard.attack != null && (
                  <span className="create-listing-preview-atk">ATK {selectedCard.attack}</span>
                )}
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

            {/* Starting price */}
            <div className="create-listing-price-input">
              <label className="create-listing-label">{t('auction.startingPrice')}</label>
              <div className="create-listing-input-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <input
                  type="number"
                  className="create-listing-input"
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  placeholder="50 - 500,000"
                  min={50}
                  max={500000}
                  autoFocus
                />
              </div>
            </div>

            {/* Duration selector */}
            <div className="auction-duration-section">
              <label className="create-listing-label">{t('auction.duration')}</label>
              <div className="auction-duration-options">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`auction-duration-btn ${duration === opt.value ? 'active' : ''}`}
                    onClick={() => setDuration(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="create-listing-error">{error}</p>}

            {/* Actions */}
            <div className="create-listing-actions">
              <button
                className="create-listing-back"
                onClick={() => { setSelectedCard(null); setStartingPrice(''); setError(''); }}
              >
                {t('back')}
              </button>
              <button
                className="create-listing-submit"
                onClick={handleSubmit}
                disabled={submitting || !startingPrice}
              >
                {submitting ? t('listing') : t('auction.startAuction')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
