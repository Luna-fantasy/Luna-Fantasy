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
