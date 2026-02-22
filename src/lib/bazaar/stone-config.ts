import type { StoneConfig, TicketPackage } from '@/types/bazaar';

export const STONE_BOX_PRICE = 2_000;

export const STONES: StoneConfig[] = [
  { name: 'Lunar Stone', weight: 20, imageUrl: 'https://assets.lunarian.app/stones/lunar_stone.png' },
  { name: 'Silver Beach Gem', weight: 15, imageUrl: 'https://assets.lunarian.app/stones/silver_beach_gem.png' },
  { name: 'Wishmaster Broken Cube', weight: 10, imageUrl: 'https://assets.lunarian.app/stones/wishmaster_broken_cube.png' },
  { name: "Dragon's Tear", weight: 5, imageUrl: 'https://assets.lunarian.app/stones/dragon_s_tear.png' },
  { name: 'Solar Stone', weight: 3, imageUrl: 'https://assets.lunarian.app/stones/solar_stone.png' },
  { name: 'Galaxy Stone', weight: 1, imageUrl: 'https://assets.lunarian.app/stones/galaxy_stone.png' },
  { name: 'Stone of Wisdom', weight: 0.5, imageUrl: 'https://assets.lunarian.app/stones/stone_of_wisdom.png' },
  { name: 'Astral Prism', weight: 0.2, imageUrl: 'https://assets.lunarian.app/stones/astral_prism.png' },
  { name: 'Eternal Stone', weight: 0.1, imageUrl: 'https://assets.lunarian.app/stones/eternal_stone.png' },
  { name: 'Mastermind Stone', weight: 0.05, imageUrl: 'https://assets.lunarian.app/stones/mastermind_stone.png' },
  { name: 'Luna Moon Stone', weight: 0, imageUrl: 'https://assets.lunarian.app/stones/luna_moon_stone.png' },
  { name: 'Moonbound Emerald', weight: 0, imageUrl: 'https://assets.lunarian.app/stones/moonbound_emerald.png' },
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
