import type { StoneConfig, TicketPackage } from '@/types/bazaar';

export const STONE_BOX_PRICE = 2_000;
export const STONE_REFUND_AMOUNT = 1_000;

export const STONES: StoneConfig[] = [
  { name: 'Lunar Stone', weight: 20, sell_price: 500, imageUrl: 'https://assets.lunarian.app/stones/lunar_stone.png' },
  { name: 'Silver Beach Gem', weight: 15, sell_price: 750, imageUrl: 'https://assets.lunarian.app/stones/silver_beach_gem.png' },
  { name: 'Wishmaster Broken Cube', weight: 10, sell_price: 1000, imageUrl: 'https://assets.lunarian.app/stones/wishmaster_broken_cube.png' },
  { name: "Dragon's Tear", weight: 5, sell_price: 1500, imageUrl: 'https://assets.lunarian.app/stones/dragon_s_tear.png' },
  { name: 'Solar Stone', weight: 3, sell_price: 2000, imageUrl: 'https://assets.lunarian.app/stones/solar_stone.png' },
  { name: 'Galaxy Stone', weight: 1, sell_price: 3000, imageUrl: 'https://assets.lunarian.app/stones/galaxy_stone.png' },
  { name: 'Stone of Wisdom', weight: 0.5, sell_price: 5000, imageUrl: 'https://assets.lunarian.app/stones/stone_of_wisdom.png' },
  { name: 'Astral Prism', weight: 0.2, sell_price: 7500, imageUrl: 'https://assets.lunarian.app/stones/astral_prism.png' },
  { name: 'Eternal Stone', weight: 0.1, sell_price: 10000, imageUrl: 'https://assets.lunarian.app/stones/eternal_stone.png' },
  { name: 'Mastermind Stone', weight: 0.05, sell_price: 15000, imageUrl: 'https://assets.lunarian.app/stones/mastermind_stone.png' },
  { name: 'Luna Moon Stone', weight: 0, sell_price: 15000, imageUrl: 'https://assets.lunarian.app/stones/luna_moon_stone.png' },
  { name: 'Moonbound Emerald', weight: 0, sell_price: 20000, imageUrl: 'https://assets.lunarian.app/stones/moonbound_emerald.png' },
];

/** Calculate drop percentage for display */
export function getStoneDropRates(): { name: string; weight: number; dropPercent: number }[] {
  const totalWeight = STONES.filter((s) => s.weight > 0).reduce((sum, s) => {
    const entries = Math.max(1, Math.round(s.weight * 1000));
    return sum + entries;
  }, 0);

  return STONES.map((s) => {
    if (s.weight === 0) return { name: s.name, weight: s.weight, dropPercent: 0 };
    const entries = Math.max(1, Math.round(s.weight * 1000));
    return {
      name: s.name,
      weight: s.weight,
      dropPercent: Math.round((entries / totalWeight) * 10000) / 100,
    };
  });
}

export function getStoneSellPrice(stoneName: string): number {
  return STONES.find((s) => s.name === stoneName)?.sell_price ?? 0;
}

/**
 * Async version that checks DB config first, then falls back to hardcoded.
 * Use this in API routes that may have DB-configured stones.
 */
export async function getStoneSellPriceAsync(stoneName: string): Promise<number> {
  try {
    const { getStoneBoxConfig } = await import('./shop-config');
    const config = await getStoneBoxConfig();
    const found = config.stones.find((s) => s.name === stoneName);
    if (found) return found.sell_price;
  } catch {
    // Fallback to hardcoded
  }
  return STONES.find((s) => s.name === stoneName)?.sell_price ?? 0;
}

export const TICKET_PACKAGES: TicketPackage[] = [
  { id: 'pack1', name: 'Moon Dust', tickets: 1, price: 1_000 },
  { id: 'pack2', name: 'Luna Potion', tickets: 2, price: 2_000 },
  { id: 'pack3', name: 'Lunar Orb', tickets: 3, price: 3_000 },
  { id: 'pack4', name: 'Pegasus Thigh', tickets: 4, price: 4_000 },
  { id: 'pack5', name: 'Dragon Eyes', tickets: 5, price: 5_000 },
];

export function getTicketPackage(id: string): TicketPackage | undefined {
  return TICKET_PACKAGES.find((p) => p.id === id);
}
