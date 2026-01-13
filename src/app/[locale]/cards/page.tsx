import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/cards.css';
import { CardsContent } from './CardsContent';
import cardsData from '@/data/cards.json';
import type { Card } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cardsPage' });
  const showcase = await getTranslations({ locale, namespace: 'showcase' });

  return {
    title: `${showcase('gameTitle')} | Luna Fantasy`,
    description: t('subtitle'),
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
