import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/characters.css';
import { CharactersContent } from './CharactersContent';

import factions from '@/data/factions.json';
import { getCardCatalog } from '@/lib/cards';
import { getCharacters } from '@/lib/characters';
import type { Character, Faction, Card } from '@/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'charactersPage' });
  const showcase = await getTranslations({ locale, namespace: 'showcase' });

  const title = `${showcase('charsTitle')} | Luna Fantasy`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/characters/`,
      languages: { en: 'https://lunarian.app/en/characters/', ar: 'https://lunarian.app/ar/characters/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/characters/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Fantasy Characters' }],
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

export default async function CharactersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [allCharacters, cards] = await Promise.all([getCharacters(), getCardCatalog()]);

  return (
    <CharactersContent
      characters={allCharacters}
      factions={factions as Faction[]}
      cards={cards as Card[]}
      locale={locale as 'en' | 'ar'}
    />
  );
}
