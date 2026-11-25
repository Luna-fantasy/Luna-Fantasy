'use client';

import { useLocale } from 'next-intl';
import { MissingRoute } from '@/components/MissingRoute';

export default function LocaleNotFound() {
  return <MissingRoute locale={useLocale()}/>;
}
