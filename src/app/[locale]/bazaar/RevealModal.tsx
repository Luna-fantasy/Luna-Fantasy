'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import LunariIcon from '@/components/LunariIcon';
import type { RevealData } from '@/types/bazaar';

interface RevealModalProps {
  data: RevealData;
  onClose: () => void;
  onBuyAnother: () => void;
  onBalanceUpdate?: (newBalance: number) => void;
}

type RevealPhase = 'shake' | 'burst' | 'reveal' | 'details' | 'done';

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function RevealModal({ data, onClose, onBuyAnother, onBalanceUpdate }: RevealModalProps) {
  const t = useTranslations('bazaarPage');
  const [phase, setPhase] = useState<RevealPhase>('shake');
  const [expanded, setExpanded] = useState(false);
  const [selling, setSelling] = useState(false);
  const [sold, setSold] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  const isNoStone = data.type === 'stone' && data.gotStone === false;

  useEffect(() => {
    if (isNoStone) {
      // Shorter animation for no-stone result
      const timers = [
        setTimeout(() => setPhase('burst'), 800),
        setTimeout(() => setPhase('done'), 1600),
      ];
      return () => timers.forEach(clearTimeout);
    }
    const timers = [
      setTimeout(() => setPhase('burst'), 800),
      setTimeout(() => setPhase('reveal'), 1500),
      setTimeout(() => setPhase('details'), 2500),
      setTimeout(() => setPhase('done'), 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isNoStone]);

  const rarityClass = data.item.rarity ? `reveal-${data.item.rarity}` : 'reveal-common';
  const isCard = data.type === 'card';
  const canAffordAnother = data.price != null ? data.newBalance >= data.price : true;

  const handleSellDuplicate = async () => {
    if (selling || sold) return;
    setSelling(true);
    setSellError(null);

    try {
      const res = await fetch('/api/bazaar/sell-stone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ stoneName: data.item.name }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSellError(result.error || 'Sell failed');
        return;
      }
      setSold(true);
      if (onBalanceUpdate) {
        onBalanceUpdate(result.newBalance);
      }
    } catch {
      setSellError('Network error');
    } finally {
      setSelling(false);
    }
  };

  // No-stone result view
  if (isNoStone) {
    return (
      <div className="reveal-overlay" onClick={phase === 'done' ? onClose : undefined}>
        <div className="reveal-modal" onClick={(e) => e.stopPropagation()}>
          <div className={`reveal-stage reveal-phase-${phase} reveal-type-stone reveal-no-stone`}>
            {/* Box phase */}
            <div className="reveal-box">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>

            {/* Particle burst */}
            <div className="reveal-particles">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="reveal-particle" style={{ '--i': i } as React.CSSProperties} />
              ))}
            </div>

            {/* No stone message */}
            <div className="reveal-details">
              <h3 className="reveal-item-name reveal-no-stone-title">{t('reveal.noStone')}</h3>
              <p className="reveal-refund-text">
                {t('reveal.refundReceived', { amount: (data.refundAmount ?? 0).toLocaleString() })}<LunariIcon size={14} />
              </p>
            </div>
          </div>

          {phase === 'done' && (
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
        </div>
      </div>
    );
  }

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
            {!isCard && (
              <>
                <h3 className="reveal-item-name">{data.item.name}</h3>
                {data.item.rarity && (
                  <span className={`reveal-rarity-badge reveal-rarity-${data.item.rarity}`}>
                    {data.item.rarity}
                  </span>
                )}
                {data.item.attack !== undefined && data.item.attack > 0 && (
                  <span className="reveal-attack">ATK {data.item.attack}</span>
                )}
              </>
            )}

            {/* Duplicate — offer to sell */}
            {data.isDuplicate && !isCard && (
              <div className="reveal-duplicate">
                <span className="reveal-duplicate-text">{t('reveal.duplicateStone')}</span>
                {data.sellPrice != null && data.sellPrice > 0 && !sold && (
                  <button
                    className="reveal-sell-btn"
                    onClick={handleSellDuplicate}
                    disabled={selling}
                  >
                    {selling ? (
                      <span className="luckbox-spinner" />
                    ) : (
                      <>{t('reveal.sellDuplicate', { amount: data.sellPrice.toLocaleString() })}<LunariIcon size={14} /></>
                    )}
                  </button>
                )}
                {sold && (
                  <span className="reveal-sold-text">{t('reveal.sold')}</span>
                )}
                {sellError && (
                  <span className="reveal-sell-error">{sellError}</span>
                )}
              </div>
            )}

            {/* Card duplicate (existing behavior) */}
            {data.isDuplicate && isCard && (
              <div className="reveal-duplicate">
                <span className="reveal-duplicate-text">{t('reveal.alreadyOwned')}</span>
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
