'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface AdminLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showClose?: boolean;
  children: React.ReactNode;
}

const SIZE_MAP = { sm: 400, md: 500, lg: 700, xl: 900 };

let scrollLockCount = 0;

export default function AdminLightbox({
  isOpen,
  onClose,
  title,
  size = 'md',
  showClose = true,
  children,
}: AdminLightboxProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const prevFocusRef = useRef<Element | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Sync visibility with isOpen
  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement;
      setVisible(true);
      setClosing(false);
    }
  }, [isOpen]);

  // Handle close animation when isOpen becomes false while visible
  useEffect(() => {
    if (!isOpen && visible && !closing) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
        (prevFocusRef.current as HTMLElement)?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, visible, closing]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      onCloseRef.current();
      (prevFocusRef.current as HTMLElement)?.focus();
    }, 200);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    document.addEventListener('keydown', handleEscape);
    scrollLockCount++;
    if (scrollLockCount === 1) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      scrollLockCount--;
      if (scrollLockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [visible, handleClose]);

  useEffect(() => {
    if (visible && !closing) {
      lightboxRef.current?.focus();
    }
  }, [visible, closing]);

  if (!visible || !portalTarget) return null;

  return createPortal(
    <div className={`admin-lightbox-overlay ${closing ? 'admin-lightbox-closing' : ''}`} onClick={handleClose}>
      <div
        ref={lightboxRef}
        className={`admin-lightbox admin-lightbox-${size}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: SIZE_MAP[size] }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        {(title || showClose) && (
          <div className="admin-lightbox-header">
            {title && <h3 className="admin-lightbox-title">{title}</h3>}
            {showClose && (
              <button className="admin-lightbox-close" onClick={handleClose} aria-label="Close">
                &times;
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    portalTarget,
  );
}
