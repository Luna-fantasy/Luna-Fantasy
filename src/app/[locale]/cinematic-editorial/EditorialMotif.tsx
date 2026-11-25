'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { mountEditorialMotif } from '@/lib/cinematic/editorial-public.js';
import { editorialArt, type EditorialName } from './editorial-art';

export function EditorialMotif({ motif }: { motif: EditorialName }) {
  const ref = useRef<HTMLDivElement>(null);
  const rtl = useLocale() === 'ar';
  const isLegal = motif === 'terms' || motif === 'privacy' || motif === 'refund';
  useEffect(() => {
    if (ref.current) return mountEditorialMotif(ref.current, motif, rtl);
  }, [motif, rtl]);
  return (
    <div
      ref={ref}
      className={isLegal ? 'v3-legal-scene' : 'v3-edit-graphic'}
      data-luna-motif={motif}
      aria-hidden="true"
    >
      {editorialArt[motif]}
    </div>
  );
}
