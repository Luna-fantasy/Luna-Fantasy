'use client';

import { useEffect } from 'react';
import Image from 'next/image';

interface LightboxProps {
  isOpen: boolean;
  imageSrc: string;
  alt: string;
  onClose: () => void;
  /** Optional caption shown below the image — card name / description */
  title?: string;
  description?: string;
}

export function Lightbox({ isOpen, imageSrc, alt, onClose, title, description }: LightboxProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasCaption = !!(title || description);

  return (
    <div className="lightbox active" onClick={onClose}>
      <div className="lightbox-bg" />
      <div
        className="lightbox-content"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '90vw', maxHeight: '90vh' }}
      >
        <Image
          src={imageSrc}
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
