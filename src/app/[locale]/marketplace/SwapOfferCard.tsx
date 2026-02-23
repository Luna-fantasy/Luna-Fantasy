'use client';

import { useTranslations } from 'next-intl';
import type { CardSwap } from '@/types/marketplace';

interface SwapOfferCardProps {
  swap: CardSwap;
  perspective: 'incoming' | 'outgoing' | 'history';
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onCounter?: () => void;
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

export default function SwapOfferCard({
  swap,
  perspective,
  onAccept,
  onDecline,
  onCancel,
  onCounter,
}: SwapOfferCardProps) {
  const t = useTranslations('swapsPage');
  const rKeyReq = swap.requesterCard.rarity.toLowerCase();
  const rKeyTarget = swap.targetCard.rarity.toLowerCase();

  const isResolved = swap.status !== 'pending';

  return (
    <div className={`swap-offer-card ${isResolved ? 'swap-offer-resolved' : ''}`}>
      {/* From user */}
      <div className="swap-offer-header">
        <span className="swap-offer-from">
          {perspective === 'incoming' ? swap.requesterName : perspective === 'outgoing' ? t('you') : swap.requesterName}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
          <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
        <span className="swap-offer-to">
          {perspective === 'incoming' ? t('you') : perspective === 'outgoing' ? swap.targetName : swap.targetName}
        </span>
        {!isResolved && (
          <span className="swap-offer-timer">{timeRemaining(swap.expiresAt)}</span>
        )}
        {isResolved && (
          <span className={`swap-offer-status swap-offer-status-${swap.status}`}>
            {t(`status.${swap.status}` as any)}
          </span>
        )}
      </div>

      {/* Card comparison */}
      <div className="swap-offer-cards">
        <div className="swap-offer-card-side">
          <div className={`swap-offer-card-img rarity-border-${rKeyReq}`}>
            {swap.requesterCard.imageUrl ? (
              <img src={swap.requesterCard.imageUrl} alt={swap.requesterCard.name} />
            ) : (
              <div className={`mini-card-placeholder rarity-bg-${rKeyReq}`} />
            )}
          </div>
          <span className="swap-offer-card-name">{swap.requesterCard.name}</span>
          <span className={`swap-offer-card-rarity rarity-${rKeyReq}`}>{swap.requesterCard.rarity}</span>
        </div>

        <div className="swap-offer-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>

        <div className="swap-offer-card-side">
          <div className={`swap-offer-card-img rarity-border-${rKeyTarget}`}>
            {swap.targetCard.imageUrl ? (
              <img src={swap.targetCard.imageUrl} alt={swap.targetCard.name} />
            ) : (
              <div className={`mini-card-placeholder rarity-bg-${rKeyTarget}`} />
            )}
          </div>
          <span className="swap-offer-card-name">{swap.targetCard.name}</span>
          <span className={`swap-offer-card-rarity rarity-${rKeyTarget}`}>{swap.targetCard.rarity}</span>
        </div>
      </div>

      {/* Actions */}
      {!isResolved && (
        <div className="swap-offer-actions">
          {perspective === 'incoming' && (
            <>
              <button className="swap-offer-accept-btn" onClick={onAccept}>{t('accept')}</button>
              <button className="swap-offer-decline-btn" onClick={onDecline}>{t('decline')}</button>
              <button className="swap-offer-counter-btn" onClick={onCounter}>{t('counter')}</button>
            </>
          )}
          {perspective === 'outgoing' && (
            <button className="swap-offer-cancel-btn" onClick={onCancel}>{t('cancelSwap')}</button>
          )}
        </div>
      )}
    </div>
  );
}
