'use client';

import { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import '@/styles/card-detail.css';

interface CardDetailData {
  id: string;
  name: string;
  rarity: string;
  imageUrl: string;
  attack?: number;
  weight?: number;
  source?: string;
  obtainedDate?: string;
  owned: boolean;
  duplicateCount?: number;
  game?: string;
}

interface CardDetailModalProps {
  card: CardDetailData;
  onClose: () => void;
  actions?: React.ReactNode;
}

export default function CardDetailModal({ card, onClose, actions }: CardDetailModalProps) {
  const t = useTranslations('profilePage');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const rKey = card.rarity.toLowerCase();

  return (
    <div className="card-detail-overlay" onClick={onClose}>
      <div className="card-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="card-detail-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Card image */}
        <div className={`card-detail-image-wrap ${!card.owned ? 'card-detail-unowned' : ''}`}>
          <div className={`card-detail-image-border rarity-glow-${rKey}`}>
            {card.imageUrl ? (
              <img src={card.imageUrl} alt={card.name} className="card-detail-image" />
            ) : (
              <div className={`card-detail-placeholder rarity-bg-${rKey}`}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <path d="M8 7h8M8 12h8M8 17h4" />
                </svg>
              </div>
            )}
            {!card.owned && (
              <div className="card-detail-lock-overlay">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            )}
          </div>

          {(card.duplicateCount ?? 0) > 1 && (
            <span className="card-detail-dupe-badge">x{card.duplicateCount}</span>
          )}
        </div>

        {/* Card info */}
        <div className="card-detail-info">
          <h3 className="card-detail-name">{card.name}</h3>

          <div className="card-detail-badges">
            <span className={`card-detail-rarity rarity-pill-${rKey}`}>
              {t(`rarity.${rKey}` as any)}
            </span>
            {card.attack != null && (
              <span className="card-detail-atk">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                ATK {card.attack}
              </span>
            )}
          </div>

          {/* Stats grid */}
          <div className="card-detail-stats">
            {card.weight != null && (
              <div className="card-detail-stat">
                <span className="card-detail-stat-label">{t('cardDetail.weight')}</span>
                <span className="card-detail-stat-value">{card.weight}</span>
              </div>
            )}
            {card.source && (
              <div className="card-detail-stat">
                <span className="card-detail-stat-label">{t('cardDetail.source')}</span>
                <span className="card-detail-stat-value">{card.source}</span>
              </div>
            )}
            {card.game && (
              <div className="card-detail-stat">
                <span className="card-detail-stat-label">{t('cardDetail.game')}</span>
                <span className="card-detail-stat-value">{card.game}</span>
              </div>
            )}
            {card.obtainedDate && (
              <div className="card-detail-stat">
                <span className="card-detail-stat-label">{t('cardDetail.obtained')}</span>
                <span className="card-detail-stat-value">
                  {new Date(card.obtainedDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons slot */}
        {actions && <div className="card-detail-actions">{actions}</div>}
      </div>
    </div>
  );
}

export type { CardDetailData };
