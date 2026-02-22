import type { LuckboxTier, LuckboxTierConfig } from '@/types/bazaar';

export const LUCKBOX_TIERS: LuckboxTierConfig[] = [
  { tier: 'common', price: 250, rarity: 'common', label: 'Common' },
  { tier: 'rare', price: 500, rarity: 'rare', label: 'Rare' },
  { tier: 'epic', price: 750, rarity: 'epic', label: 'Epic' },
  { tier: 'unique', price: 1_000, rarity: 'unique', label: 'Unique' },
  { tier: 'legendary', price: 1_500, rarity: 'legendary', label: 'Legendary' },
  { tier: 'secret', price: 2_000, rarity: 'secret', label: 'Secret' },
];

export function getLuckboxTier(tier: LuckboxTier): LuckboxTierConfig | undefined {
  return LUCKBOX_TIERS.find((t) => t.tier === tier);
}

export const VALID_TIERS: LuckboxTier[] = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret'];

/**
 * Rarity-based stat ranges for attack and weight.
 * Attack and weight are randomly generated within these ranges at draw time,
 * matching the bot's behavior (see luna-jester.md).
 */
interface RarityStatRange {
  attackMin: number;
  attackMax: number;
  weightMin: number;
  weightMax: number;
}

const RARITY_STAT_RANGES: Record<string, RarityStatRange> = {
  common:    { attackMin: 11,  attackMax: 59,   weightMin: 1,    weightMax: 10 },
  rare:      { attackMin: 60,  attackMax: 70,   weightMin: 1,    weightMax: 10 },
  epic:      { attackMin: 70,  attackMax: 90,   weightMin: 0.5,  weightMax: 10 },
  unique:    { attackMin: 91,  attackMax: 110,  weightMin: 0.5,  weightMax: 10 },
  legendary: { attackMin: 110, attackMax: 550,  weightMin: 0.1,  weightMax: 10 },
  secret:    { attackMin: 1,   attackMax: 1000, weightMin: 0.02, weightMax: 11 },
  forbidden: { attackMin: 1,   attackMax: 12,   weightMin: 0,    weightMax: 0 },
};

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Generate random attack and weight stats for a card based on its rarity.
 */
export function generateCardStats(rarity: string): { attack: number; weight: number } {
  const range = RARITY_STAT_RANGES[rarity.toLowerCase()];
  if (!range) return { attack: 0, weight: 1 };
  return {
    attack: Math.round(randomInRange(range.attackMin, range.attackMax)),
    weight: randomInRange(range.weightMin, range.weightMax),
  };
}
