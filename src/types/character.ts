export interface LocalizedString {
  en: string;
  ar: string;
}

export interface Character {
  id: string;
  name: LocalizedString;
  lore?: LocalizedString;
  faction: string;
  imageUrl: string;
  isMainCharacter?: boolean;
  cardId?: string;
}

export interface Faction {
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
}

export type Locale = 'en' | 'ar';

export type CardRarity = 'common' | 'rare' | 'epic' | 'unique' | 'legendary' | 'secret' | 'mythical';

export interface Card {
  id: string;
  name: LocalizedString;
  rarity: CardRarity;
  imageUrl: string;
  characterId?: string; // Link to character if this card represents one
}
