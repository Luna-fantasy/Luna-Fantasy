// SPECIAL deprecated 2026-04-15 — all SPECIAL content merged into SECRET.
export const RARITY_ORDER = [
  'COMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'SECRET', 'FORBIDDEN',
] as const;

export type Rarity = typeof RARITY_ORDER[number];

export const RARITY_TONES: Record<Rarity, string> = {
  COMMON:    '#00FF99',
  RARE:      '#0077FF',
  EPIC:      '#B066FF',
  UNIQUE:    '#FF3366',
  LEGENDARY: '#FFD54F',
  SECRET:    '#c084fc',
  FORBIDDEN: '#ef4444',
};

export interface CardDef {
  name: string;
  rarity: Rarity;
  attack: number;
  weight: number;
  imageUrl: string | null;
  ownerCount: number;
  copiesOwned: number;
  dropPct: number;
}

export interface CardsSnapshot {
  byRarity: Record<Rarity, CardDef[]>;
  totals: {
    defined: number;
    owned: number;
    holders: number;
    rarityCounts: Record<Rarity, number>;
  };
}
