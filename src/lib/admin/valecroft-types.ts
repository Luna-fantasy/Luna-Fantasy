// Pure types + runtime constants for Valecroft — safe to import from client components.
// Server-only helpers (DB ops) live in `valecroft.ts`.

// `special` is a Mastermind-only tier — never listed in the Valecroft shop,
// never purchasable. Granted directly to a Discord user via the dashboard.
export type PropertyTier = 'shack' | 'cottage' | 'villa' | 'manor' | 'palace' | 'special';
export const PROPERTY_TIERS: PropertyTier[] = ['shack', 'cottage', 'villa', 'manor', 'palace', 'special'];
/** Tiers the public Cassian shop is allowed to list. `special` is excluded. */
export const PUBLIC_PROPERTY_TIERS: PropertyTier[] = ['shack', 'cottage', 'villa', 'manor', 'palace'];

// `forbidden` is a above-legendary item rarity. Applies to artifact / horse /
// sword (all 3 item categories), NOT to property tiers.
export type Rarity = 'common' | 'rare' | 'epic' | 'unique' | 'legendary' | 'forbidden';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'unique', 'legendary', 'forbidden'];

export type ItemCategory = 'artifact' | 'horse' | 'sword';
export const ITEM_CATEGORIES: ItemCategory[] = ['artifact', 'horse', 'sword'];

export interface SlotRule {
  total: number;
  by_rarity: Partial<Record<Rarity, number>>;
}

export const DEFAULT_TIER_SLOT_RULES: Record<PropertyTier, SlotRule> = {
  shack:   { total: 3,  by_rarity: { common: 1, rare: 2 } },
  cottage: { total: 5,  by_rarity: { common: 1, rare: 3, epic: 1 } },
  villa:   { total: 7,  by_rarity: { rare: 4, epic: 2, unique: 1 } },
  manor:   { total: 9,  by_rarity: { rare: 3, epic: 3, unique: 2, legendary: 1 } },
  palace:  { total: 12, by_rarity: { rare: 2, epic: 4, unique: 4, legendary: 2 } },
  // Special properties are bespoke gifts — generous slot allocation that can
  // hold any rarity including forbidden. Override per-grant if needed.
  special: { total: 16, by_rarity: { epic: 4, unique: 4, legendary: 4, forbidden: 4 } },
};

export interface PropertyCatalogEntry {
  _id?: string;
  key: string;
  name: string;
  description: string;
  tier: PropertyTier;
  price: number;
  image_url: string;
  slot_rules_override?: SlotRule | null;
  base_income: number;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ItemCatalogEntry {
  _id?: string;
  key: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: Rarity;
  price: number;
  image_url: string;
  income_bonus: number;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface UserPropertyRow {
  _id: string;
  discord_id: string;
  property_key: string;
  custom_name: string | null;
  purchased_at: Date | string;
  last_repaired_at: Date | string | null;
  damage_percent: number;
  foreclosure_deadline: Date | string | null;
  state: 'owned' | 'damaged' | 'foreclosed';
  property_name: string | null;
  property_tier: PropertyTier | null;
}

export interface ValecroftStats {
  properties_total: number;
  properties_sold: number;
  properties_active_for_sale: number;
  items_total: number;
  active_eclipses: number;
  pending_foreclosures: number;
  lunari_sunk_last_30d: number;
}

export function slugifyKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
