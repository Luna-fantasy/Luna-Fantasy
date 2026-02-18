import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/characters.css';
import { CharactersContent } from './CharactersContent';

// Import all character data
import mainCharacters from '@/data/characters/main.json';
import lunarians from '@/data/characters/lunarians.json';
import knights from '@/data/characters/knights.json';
import warriors from '@/data/characters/warriors.json';
import dragons from '@/data/characters/dragons.json';
import beasts from '@/data/characters/beasts.json';
import colossals from '@/data/characters/colossals.json';
import moonCreatures from '@/data/characters/moon-creatures.json';
import mythicalCreatures from '@/data/characters/mythical-creatures.json';
import strangeBeing from '@/data/characters/strange-being.json';
import supernaturals from '@/data/characters/supernaturals.json';
import underworld from '@/data/characters/underworld.json';
import factions from '@/data/factions.json';
import { getCardCatalog } from '@/lib/cards';
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

// Combine all characters
const allCharacters: Character[] = [
  ...mainCharacters as Character[],
  ...lunarians as Character[],
  ...knights as Character[],
  ...warriors as Character[],
  ...dragons as Character[],
  ...beasts as Character[],
  ...colossals as Character[],
  ...moonCreatures as Character[],
  ...mythicalCreatures as Character[],
  ...strangeBeing as Character[],
  ...supernaturals as Character[],
  ...underworld as Character[],
];

export default async function CharactersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cards = await getCardCatalog();

  return (
    <CharactersContent
      characters={allCharacters}
      factions={factions as Faction[]}
      cards={cards as Card[]}
      locale={locale as 'en' | 'ar'}
    />
  );
}
