import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/cards.css';
import { CardsContent } from './CardsContent';
import { getCardCatalog } from '@/lib/cards';
import type { Card } from '@/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cardsPage' });
  const showcase = await getTranslations({ locale, namespace: 'showcase' });

  const title = `${showcase('gameTitle')} | Luna`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/luna-fantasy/`,
      languages: { en: 'https://lunarian.app/en/luna-fantasy/', ar: 'https://lunarian.app/ar/luna-fantasy/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna',
      url: `https://lunarian.app/${locale}/luna-fantasy/`,
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

export default async function LunaFantasyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cards = await getCardCatalog('lunaFantasy');

  return (
    <CardsContent
      cards={cards as Card[]}
      locale={locale as 'en' | 'ar'}
    />
  );
}
