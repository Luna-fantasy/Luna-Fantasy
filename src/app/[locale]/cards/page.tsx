import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/cards.css';
import { CardsContent } from './CardsContent';
import cardsData from '@/data/cards.json';
import type { Card } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cardsPage' });
  const showcase = await getTranslations({ locale, namespace: 'showcase' });

  const title = `${showcase('gameTitle')} | Luna Fantasy`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/cards/`,
      languages: { en: 'https://lunarian.app/en/cards/', ar: 'https://lunarian.app/ar/cards/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/cards/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Fantasy Card Game' }],
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

export default async function CardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <CardsContent
      cards={cardsData as Card[]}
      locale={locale as 'en' | 'ar'}
    />
  );
}
