'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import type { RevealData } from '@/types/bazaar';

interface RevealModalProps {
  data: RevealData;
  onClose: () => void;
  onBuyAnother: () => void;
}

type RevealPhase = 'shake' | 'burst' | 'reveal' | 'details' | 'done';

export default function RevealModal({ data, onClose, onBuyAnother }: RevealModalProps) {
  const t = useTranslations('bazaarPage');
  const [phase, setPhase] = useState<RevealPhase>('shake');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('burst'), 800),
      setTimeout(() => setPhase('reveal'), 1500),
      setTimeout(() => setPhase('details'), 2500),
      setTimeout(() => setPhase('done'), 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const rarityClass = data.item.rarity ? `reveal-${data.item.rarity}` : 'reveal-common';
  const isCard = data.type === 'card';
  const canAffordAnother = data.price != null ? data.newBalance >= data.price : true;

  return (
    <div className="reveal-overlay" onClick={phase === 'done' ? onClose : undefined}>
      <div className="reveal-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`reveal-stage reveal-phase-${phase} ${rarityClass} ${isCard ? 'reveal-type-card' : 'reveal-type-stone'}`}>
          {/* Box phase */}
          <div className="reveal-box">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {isCard ? (
                <>
                  <path d="M21 8V21H3V8" />
                  <path d="M1 3h22v5H1z" />
                  <path d="M10 12h4" />
                </>
              ) : (
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              )}
            </svg>
          </div>

          {/* Particle burst */}
          <div className="reveal-particles">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="reveal-particle" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>

          {/* Item reveal — clickable to expand */}
          <div
            className={`reveal-item ${expanded ? 'reveal-item-expanded' : ''}`}
            onClick={() => phase === 'done' && data.item.imageUrl && setExpanded(!expanded)}
            style={{ cursor: phase === 'done' && data.item.imageUrl ? 'pointer' : 'default' }}
          >
            {data.item.imageUrl ? (
              <img src={data.item.imageUrl} alt={data.item.name} className="reveal-item-image" />
            ) : (
              <div className="reveal-item-placeholder">
                {isCard ? (
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="2" y="3" width="20" height="18" rx="2" />
                    <path d="M8 7h8M8 12h8" />
                  </svg>
                ) : (
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Details */}
          <div className={`reveal-details ${expanded ? 'reveal-details-hidden' : ''}`}>
            <h3 className="reveal-item-name">{data.item.name}</h3>
            {data.item.rarity && (
              <span className={`reveal-rarity-badge reveal-rarity-${data.item.rarity}`}>
                {data.item.rarity}
              </span>
            )}
            {data.item.attack !== undefined && data.item.attack > 0 && (
              <span className="reveal-attack">ATK {data.item.attack}</span>
            )}

            {/* Duplicate overlay */}
            {data.isDuplicate && (
              <div className="reveal-duplicate">
                <span className="reveal-duplicate-text">
                  {isCard ? t('reveal.alreadyOwned') : data.refundAmount
                    ? t('reveal.refund', { amount: data.refundAmount.toLocaleString() })
                    : t('reveal.noRefund')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {phase === 'done' && !expanded && (
          <div className="reveal-actions">
            <button className="reveal-close-btn" onClick={onClose}>
              {t('reveal.close')}
            </button>
            {canAffordAnother && (
              <button className="reveal-another-btn" onClick={onBuyAnother}>
                {t('reveal.buyAnother')}
              </button>
            )}
          </div>
        )}
        {phase === 'done' && !expanded && (
          <Link href="/profile" className="reveal-collection-link" onClick={onClose}>
            {t('reveal.viewCollection')}
          </Link>
        )}
      </div>
    </div>
  );
}
