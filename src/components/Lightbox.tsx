'use client';

import { useEffect } from 'react';
import Image from 'next/image';

interface LightboxProps {
  isOpen: boolean;
  imageSrc: string;
  alt: string;
  onClose: () => void;
}

export function Lightbox({ isOpen, imageSrc, alt, onClose }: LightboxProps) {
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

  return (
    <div className="lightbox active" onClick={onClose}>
      <div className="lightbox-bg" />
      <Image
        src={imageSrc}
        alt={alt}
        width={800}
        height={600}
        style={{ objectFit: 'contain', maxWidth: '90vw', maxHeight: '90vh', width: 'auto', height: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
