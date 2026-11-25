'use client';

import { ArchiveName } from '@/components/ArchiveName';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
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
  index: number;
  total: number;
  onNavigate: (index: number) => void;
  opener: HTMLElement | null;
  showOwnershipLock?: boolean;
  onClose: () => void;
  actions?: React.ReactNode;
}

export default function CardDetailModal({ card, index, total, onNavigate, opener, showOwnershipLock = true, onClose, actions }: CardDetailModalProps) {
  const t = useTranslations('profilePage');
  const locale = useLocale();
  const rtl = locale === 'ar';
  const heading = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [artDirection, setArtDirection] = useState<'next' | 'previous'>();
  useLayoutEffect(() => {
    const prior = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const gallery = prior?.closest<HTMLElement>('[data-card-preview-scope]');
    const overflow = document.body.style.overflow;
    const position = { left: window.scrollX, top: window.scrollY, href: location.href };
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (location.href === position.href) {
        const returnTarget = prior?.isConnected ? prior : gallery;
        if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
        if (window.scrollX !== position.left || window.scrollY !== position.top) {
          window.scrollTo({ left: position.left, top: position.top, behavior: 'instant' });
        }
      }
    };
  }, [opener]);
  useLayoutEffect(() => { if (dialog.current) dialog.current.scrollTop = 0; }, [index]);

  function move(direction: number) {
    const next = index + direction;
    if (next < 0 || next >= total) return;
    setArtDirection(direction > 0 ? 'next' : 'previous');
    onNavigate(next);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      move((event.key === 'ArrowRight') !== rtl ? 1 : -1);
    } else if (event.key === 'Tab' && dialog.current) {
      const buttons = dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  const rKey = card.rarity.toLowerCase();
  const locked = showOwnershipLock && !card.owned;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="card-detail-overlay" data-luna-type="rose" lang={locale} dir={rtl ? 'rtl' : 'ltr'} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} className="card-detail-modal" role="dialog" aria-modal="true" aria-labelledby={heading} onKeyDown={handleKeyDown}>
        <div className="card-detail-controls">
          <nav className="card-detail-navigation" aria-label={rtl ? 'تصفح البطاقات' : 'Browse cards'}>
          <button type="button" aria-disabled={index === 0} data-card-step="previous" onClick={() => move(-1)}>
            <span aria-hidden="true">{rtl ? '→' : '←'}</span>{rtl ? 'السابق' : 'Previous'}
          </button>
          <span className="card-detail-position" role="status" aria-live="polite" aria-atomic="true">
            <bdi dir="ltr">{index + 1} / {total}</bdi><span className="card-detail-sr"> · {card.name}</span>
          </span>
          <button type="button" aria-disabled={index === total - 1} data-card-step="next" onClick={() => move(1)}>
            {rtl ? 'التالي' : 'Next'}<span aria-hidden="true">{rtl ? '←' : '→'}</span>
          </button>
          </nav>
          <button ref={closeButton} type="button" className="card-detail-close" aria-label={rtl ? 'إغلاق المعاينة' : 'Close preview'} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Card image */}
        <div key={`${card.id}-${index}`} className={`card-detail-image-wrap ${locked ? 'card-detail-unowned' : ''}`} data-art-direction={artDirection}>
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
            {locked && (
              <div className="card-detail-lock-overlay">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            )}
            {artDirection && <span className="card-detail-art-glint" aria-hidden="true" />}
          </div>

          {(card.duplicateCount ?? 0) > 1 && (
            <span className="card-detail-dupe-badge">x{card.duplicateCount}</span>
          )}
        </div>

        {/* Card info */}
        <div className="card-detail-info">
          <h3 className="card-detail-name" id={heading}><ArchiveName>{card.name}</ArchiveName></h3>

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
    </div>, document.body
  );
}

export type { CardDetailData };
