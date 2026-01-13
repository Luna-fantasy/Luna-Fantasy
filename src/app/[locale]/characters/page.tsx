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
import cardsData from '@/data/cards.json';

import type { Character, Faction, Card } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'charactersPage' });
  const showcase = await getTranslations({ locale, namespace: 'showcase' });

  return {
    title: `${showcase('charsTitle')} | Luna Fantasy`,
    description: t('subtitle'),
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

  return (
    <CharactersContent
      characters={allCharacters}
      factions={factions as Faction[]}
      cards={cardsData as Card[]}
      locale={locale as 'en' | 'ar'}
    />
  );
}
