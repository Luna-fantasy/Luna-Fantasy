/**
 * DB-backed shop configuration loaders.
 *
 * Each loader checks the `vendor_config` collection first, then falls back
 * to the hardcoded defaults in luckbox-config.ts / stone-config.ts.
 * Results are cached in-memory for 2 minutes.
 */

import clientPromise from '@/lib/mongodb';
import { LUCKBOX_TIERS } from './luckbox-config';
import { STONES, STONE_BOX_PRICE, STONE_REFUND_AMOUNT, TICKET_PACKAGES } from './stone-config';
import type {
  LuckboxBoxConfig,
  LuckboxShopConfig,
  StoneShopConfig,
  StoneConfig,
  TicketShopConfig,
  TicketPackage,
  LuckboxTierConfig,
} from '@/types/bazaar';

const DB_NAME = 'Database';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Invalidate all shop config caches */
export function invalidateShopConfigCache(): void {
  cache.clear();
}

// ── Luckbox Config ──

/** Convert hardcoded tiers to the new multi-rarity format */
function hardcodedToBoxConfig(): LuckboxBoxConfig[] {
  return LUCKBOX_TIERS.map((t, i) => ({
    id: t.tier,
    label: t.label,
    price: t.price,
    rarities: [{ rarity: t.rarity, percentage: 100 }],
    enabled: true,
    order: i,
  }));
}

/** Get luckbox shop config (DB-first, fallback to hardcoded) */
export async function getLuckboxShopConfig(): Promise<LuckboxBoxConfig[]> {
  const cached = getCached<LuckboxBoxConfig[]>('luckbox');
  if (cached) return cached;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const doc = await db.collection('vendor_config').findOne({ _id: 'luckbox' as any });

    if (doc?.data) {
      const config: LuckboxShopConfig = typeof doc.data === 'string'
        ? JSON.parse(doc.data)
        : doc.data;

      if (config.tiers && Array.isArray(config.tiers) && config.tiers.length > 0) {
        const tiers = config.tiers
          .filter((t) => t.enabled)
          .sort((a, b) => a.order - b.order);
        setCache('luckbox', tiers);
        return tiers;
      }
    }
  } catch (err) {
    console.error('[shop-config] Failed to load luckbox config from DB:', err);
  }

  // Fallback to hardcoded
  const fallback = hardcodedToBoxConfig();
  setCache('luckbox', fallback);
  return fallback;
}

/** Get all luckbox tiers (including disabled) for admin */
export async function getLuckboxShopConfigAll(): Promise<LuckboxBoxConfig[]> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const doc = await db.collection('vendor_config').findOne({ _id: 'luckbox' as any });

    if (doc?.data) {
      const config: LuckboxShopConfig = typeof doc.data === 'string'
        ? JSON.parse(doc.data)
        : doc.data;

      if (config.tiers && Array.isArray(config.tiers)) {
        return config.tiers.sort((a, b) => a.order - b.order);
      }
    }
  } catch (err) {
    console.error('[shop-config] Failed to load luckbox config from DB:', err);
  }

  return hardcodedToBoxConfig();
}

/** Convert multi-rarity box to legacy tier format for catalog API compatibility */
export function boxToLegacyTier(box: LuckboxBoxConfig): LuckboxTierConfig {
  // For single-rarity boxes, use the rarity directly
  // For multi-rarity, use the first rarity as the primary
  const primaryRarity = box.rarities[0]?.rarity ?? 'common';
  return {
    tier: box.id as any,
    price: box.price,
    rarity: primaryRarity,
    label: box.label,
  };
}

// ── Stonebox Config ──

export interface StoneBoxResult {
  price: number;
  refundAmount: number;
  stones: StoneConfig[];
}

/** Get stonebox config (DB-first, fallback to hardcoded) */
export async function getStoneBoxConfig(): Promise<StoneBoxResult> {
  const cached = getCached<StoneBoxResult>('stonebox');
  if (cached) return cached;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const doc = await db.collection('vendor_config').findOne({ _id: 'stonebox' as any });

    if (doc?.data) {
      const config: StoneShopConfig = typeof doc.data === 'string'
        ? JSON.parse(doc.data)
        : doc.data;

      if (config.stones && Array.isArray(config.stones) && config.stones.length > 0) {
        const result: StoneBoxResult = {
          price: config.price ?? STONE_BOX_PRICE,
          refundAmount: config.refundAmount ?? STONE_REFUND_AMOUNT,
          stones: config.stones,
        };
        setCache('stonebox', result);
        return result;
      }
    }
  } catch (err) {
    console.error('[shop-config] Failed to load stonebox config from DB:', err);
  }

  const fallback: StoneBoxResult = {
    price: STONE_BOX_PRICE,
    refundAmount: STONE_REFUND_AMOUNT,
    stones: STONES,
  };
  setCache('stonebox', fallback);
  return fallback;
}

// ── Ticket Config ──

/** Get ticket packages (DB-first, fallback to hardcoded) */
export async function getTicketShopConfig(): Promise<TicketPackage[]> {
  const cached = getCached<TicketPackage[]>('tickets');
  if (cached) return cached;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const doc = await db.collection('vendor_config').findOne({ _id: 'tickets' as any });

    if (doc?.data) {
      const config: TicketShopConfig = typeof doc.data === 'string'
        ? JSON.parse(doc.data)
        : doc.data;

      if (config.packages && Array.isArray(config.packages) && config.packages.length > 0) {
        setCache('tickets', config.packages);
        return config.packages;
      }
    }
  } catch (err) {
    console.error('[shop-config] Failed to load ticket config from DB:', err);
  }

  setCache('tickets', TICKET_PACKAGES);
  return TICKET_PACKAGES;
}

/** Save luckbox config to DB */
export async function saveLuckboxConfig(tiers: LuckboxBoxConfig[]): Promise<void> {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db.collection('vendor_config').updateOne(
    { _id: 'luckbox' as any },
    { $set: { data: { tiers } } },
    { upsert: true }
  );
  invalidateShopConfigCache();
}

/** Save stonebox config to DB */
export async function saveStoneBoxConfig(config: StoneShopConfig): Promise<void> {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db.collection('vendor_config').updateOne(
    { _id: 'stonebox' as any },
    { $set: { data: config } },
    { upsert: true }
  );
  invalidateShopConfigCache();
}

/** Save ticket config to DB */
export async function saveTicketConfig(packages: TicketPackage[]): Promise<void> {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db.collection('vendor_config').updateOne(
    { _id: 'tickets' as any },
    { $set: { data: { packages } } },
    { upsert: true }
  );
  invalidateShopConfigCache();
}

// ── Mells Selvair (Butler Background Shop) ──

export interface MellsShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  roleId: string;
  backgroundUrl: string;
  rankBackgroundUrl?: string;
  enabled?: boolean;
}

/** Get Mells Selvair shop items (from bot_config, fallback empty) */
export async function getMellsShopConfig(): Promise<MellsShopItem[]> {
  const cached = getCached<MellsShopItem[]>('mells');
  if (cached) return cached;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const doc = await db.collection('bot_config').findOne({ _id: 'butler_shop' as any });

    if (doc?.data?.items && Array.isArray(doc.data.items)) {
      setCache('mells', doc.data.items);
      return doc.data.items;
    }
  } catch (err) {
    console.error('[shop-config] Failed to load mells config from DB:', err);
  }

  return [];
}

/** Save Mells Selvair shop items to DB */
export async function saveMellsConfig(items: MellsShopItem[]): Promise<void> {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db.collection('bot_config').updateOne(
    { _id: 'butler_shop' as any },
    { $set: { data: { items }, updatedAt: new Date() } },
    { upsert: true }
  );
  invalidateShopConfigCache();
}
