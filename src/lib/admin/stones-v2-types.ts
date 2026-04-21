export const STONE_TIERS = ['regular', 'forbidden'] as const;
export type StoneTier = typeof STONE_TIERS[number];

export const TIER_TONES: Record<StoneTier, string> = {
  regular:   '#06b6d4',
  forbidden: '#ef4444',
};

export interface StoneDef {
  name: string;
  tier: StoneTier;
  weight: number;
  sellPrice: number;
  emojiId: string | null;
  imageUrl: string | null;
  type: string | null;
  ownerCount: number;
  copiesOwned: number;
  dropPct: number;
}

export interface StonesSnapshot {
  byTier: Record<StoneTier, StoneDef[]>;
  totals: {
    defined: number;
    owned: number;
    holders: number;
    tierCounts: Record<StoneTier, number>;
  };
}
