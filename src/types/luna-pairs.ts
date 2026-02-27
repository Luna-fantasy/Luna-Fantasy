export interface LunaPairsCard {
  name: string;
  image: string;
}

export interface LunaPairsFaction {
  id: string;
  name: { en: string; ar: string };
  color: string;
  cards: LunaPairsCard[];
}
