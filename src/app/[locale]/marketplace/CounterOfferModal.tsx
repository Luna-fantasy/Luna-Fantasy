'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { CardSwap, SwapCard } from '@/types/marketplace';

interface CounterOfferModalProps {
  originalSwap: CardSwap;
  onClose: () => void;
  onCreated: () => void;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

export default function CounterOfferModal({ originalSwap, onClose, onCreated }: CounterOfferModalProps) {
  const t = useTranslations('swapsPage');

  const [step, setStep] = useState<'pickMyCard' | 'pickTheirCard' | 'confirm'>('pickMyCard');
  const [myCards, setMyCards] = useState<SwapCard[]>([]);
  const [theirCards, setTheirCards] = useState<SwapCard[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Fetch both sets of cards
  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, theirRes] = await Promise.all([
        fetch('/api/profile/game-data'),
        fetch(`/api/users/${encodeURIComponent(originalSwap.requesterId)}/cards`),
      ]);

      if (myRes.ok) {
        const data = await myRes.json();
        const allCards = [
          ...(data.cardsByGame?.lunaFantasy || []),
        ];
        setMyCards(allCards);
      }

      if (theirRes.ok) {
        const data = await theirRes.json();
        setTheirCards(data.cards || []);
      }
    } catch {}
    setLoading(false);
  }, [originalSwap.requesterId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSubmit = async () => {
    if (!selectedMyCard || !selectedTheirCard) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/swaps/counter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          swapId: originalSwap.swapId,
          myCardId: selectedMyCard.id,
          theirCardId: selectedTheirCard.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onCreated();
      } else {
        setError(data.error || t('counterError'));
      }
    } catch {
      setError(t('counterError'));
    }

    setSubmitting(false);
  };

  return (
    <div className="create-listing-overlay" onClick={onClose}>
      <div className="create-listing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="create-listing-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h3 className="create-listing-title">{t('counterOffer')}</h3>

        {loading ? (
          <div className="create-listing-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ width: '100%', aspectRatio: '2/3', borderRadius: 8 }} />
            ))}
          </div>
        ) : (
          <>
            {step === 'pickMyCard' && (
              <div className="create-listing-picker">
                <p className="create-listing-label">{t('pickYourCard')}</p>
                <div className="create-listing-grid">
                  {myCards.map((card) => {
                    const r = card.rarity.toLowerCase();
                    return (
                      <div
                        key={card.id}
                        className="create-listing-card"
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
              </div>
            )}

            {step === 'pickTheirCard' && (
              <div className="create-listing-picker">
                <p className="create-listing-label">{t('pickTheirCard', { user: originalSwap.requesterName })}</p>
                <div className="create-listing-grid">
                  {theirCards.map((card) => {
                    const r = card.rarity.toLowerCase();
                    return (
                      <div
                        key={card.id}
                        className="create-listing-card"
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
                <button className="create-listing-back" onClick={() => setStep('pickMyCard')} style={{ marginTop: 12 }}>
                  {t('back')}
                </button>
              </div>
            )}

            {step === 'confirm' && selectedMyCard && selectedTheirCard && (
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
                    {submitting ? t('proposing') : t('sendCounter')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
