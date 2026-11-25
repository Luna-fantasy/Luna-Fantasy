'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArchiveCardInspector, type ArchiveInspection } from './archive-card-carousel/ArchiveCardInspector';

import type { ArchiveCardEntry } from './archive-card-carousel/ArchiveCardCarousel';
import type { LunaSecretCodexSelection } from '@/lib/cinematic/luna-secret-codex';

interface LightboxProps {
  isOpen: boolean;
  inspection?: ArchiveInspection;
  archiveEntries?: readonly ArchiveCardEntry[];
  readSecret?: (id: string) => LunaSecretCodexSelection | undefined;
  imageSrc: string;
  preferredImageSrc?: string;
  visualFixImageSrc?: string;
  alt: string;
  onClose: () => void;
  openerElement?: HTMLElement;
  locale?: string;
  /** Optional caption shown below the image — card name / description */
  title?: string;
  description?: string;
}

export function Lightbox(props: LightboxProps) {
  if (props.inspection) return props.isOpen ? <ArchiveCardInspector key={props.inspection.id} {...props} inspection={props.inspection} /> : null;
  return <BasicLightbox {...props} />;
}

function BasicLightbox({ isOpen, imageSrc, preferredImageSrc, visualFixImageSrc, alt, onClose, title, description, openerElement, locale }: LightboxProps) {
  const [failedNative, setFailedNative] = useState<string>();
  const [failedVisualFix, setFailedVisualFix] = useState<string>();
  const localFix = visualFixImageSrc && visualFixImageSrc !== failedVisualFix ? visualFixImageSrc : undefined;
  const usePreferred = !!preferredImageSrc && preferredImageSrc !== failedNative;

  const closeButton = useRef<HTMLButtonElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const requestedOpener = useRef(openerElement);
  requestedOpener.current = openerElement;

  useEffect(() => {
    if (!isOpen) {
      setFailedNative(undefined);
      setFailedVisualFix(undefined);
      return;
    }
    const opener = requestedOpener.current?.isConnected ? requestedOpener.current : document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const scroll = { left: window.scrollX, top: window.scrollY };
    let leavingPage = false;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        closeHandler.current();
      } else if (e.key === 'Tab' && closeButton.current) {
        // The close button is the only interactive element inside this viewer.
        e.preventDefault();
        closeButton.current.focus({ preventScroll: true });
      }
    };
    const handlePageHide = () => {
      leavingPage = true;
      document.body.style.overflow = previousOverflow;
      closeHandler.current();
    };
    document.addEventListener('keydown', handleKey);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('pagehide', handlePageHide);
      document.body.style.overflow = previousOverflow;
      if (!leavingPage) {
        if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
        window.scrollTo({ ...scroll, behavior: 'instant' });
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasCaption = !!(title || description);
  const arabic = locale ? locale.toLowerCase().split('-')[0] === 'ar' : /^[\u0600-\u06ff]/.test(title || alt);
  const closeLabel = arabic ? 'إغلاق المعاينة' : 'Close preview';

  return (
    <div className="lightbox active" onClick={onClose}>
      <div className="lightbox-bg" />
      <div
        className="lightbox-content"
        role="dialog" aria-modal="true" aria-label={title || alt}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '90vw', maxHeight: '90vh' }}
      >
        <button ref={closeButton} type="button" className="lightbox-close" aria-label={closeLabel} onClick={onClose}>×</button>
        <Image
          src={localFix || (usePreferred ? preferredImageSrc : imageSrc)}
          unoptimized={!!localFix || usePreferred || undefined}
          onError={localFix ? () => setFailedVisualFix(localFix) : (usePreferred ? () => setFailedNative(preferredImageSrc) : undefined)}
          alt={alt}
          width={800}
          height={600}
          style={{ objectFit: 'contain', maxWidth: '90vw', maxHeight: hasCaption ? '72vh' : '90vh', width: 'auto', height: 'auto' }}
        />
        {hasCaption && (
          <div className="lightbox-caption">
            {title && <h3 className="lightbox-caption-title">{title}</h3>}
            {description && <p className="lightbox-caption-desc">{description}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
