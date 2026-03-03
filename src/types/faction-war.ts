export interface FactionWarCard {
  name: string;
  image: string;
}

export interface FactionWarFaction {
  id: string;
  name: { en: string; ar: string };
  color: string;
  cards: FactionWarCard[];
}
