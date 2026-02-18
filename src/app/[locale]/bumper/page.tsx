import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/cards.css';
import { BumperContent } from './BumperContent';
import { getCardCatalog } from '@/lib/cards';
import type { Card } from '@/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'bumperPage' });

  const title = `${t('heroTitle')} | Luna`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/bumper/`,
      languages: { en: 'https://lunarian.app/en/bumper/', ar: 'https://lunarian.app/ar/bumper/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna',
      url: `https://lunarian.app/${locale}/bumper/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Bumper Card Game' }],
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://lunarian.app/images/og-image.png'],
    },
  };
}

export default async function BumperPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cards = await getCardCatalog('bumper');

  return (
    <BumperContent
      cards={cards as Card[]}
      locale={locale as 'en' | 'ar'}
    />
  );
}
