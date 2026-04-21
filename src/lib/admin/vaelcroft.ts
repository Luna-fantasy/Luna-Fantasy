// Vaelcroft family (Luna Butler properties vendor) admin helpers — SERVER-ONLY.
// Reads/writes the new collections: properties_catalog, properties_items_catalog,
// user_properties, user_property_items, property_eclipse_events, property_transactions.
// Pure types / constants live in `./vaelcroft-types.ts` (import those from client components).

import clientPromise from '@/lib/mongodb';
import {
  ITEM_CATEGORIES, RARITIES, PROPERTY_TIERS, DEFAULT_TIER_SLOT_RULES,
  slugifyKey,
  type PropertyTier, type Rarity, type ItemCategory, type SlotRule,
  type PropertyCatalogEntry, type ItemCatalogEntry,
  type UserPropertyRow, type VaelcroftStats,
} from './vaelcroft-types';

// Re-export so existing server-side imports keep working.
export {
  ITEM_CATEGORIES, RARITIES, PROPERTY_TIERS, DEFAULT_TIER_SLOT_RULES,
  slugifyKey,
};
export type {
  PropertyTier, Rarity, ItemCategory, SlotRule,
  PropertyCatalogEntry, ItemCatalogEntry,
  UserPropertyRow, VaelcroftStats,
};

// ── Catalog: properties ──

function db() {
  return clientPromise.then(c => c.db('Database'));
}

export async function listProperties(opts: { activeOnly?: boolean } = {}): Promise<PropertyCatalogEntry[]> {
  const col = (await db()).collection<PropertyCatalogEntry>('properties_catalog');
  const q: any = opts.activeOnly ? { active: true } : {};
  return col.find(q).sort({ tier: 1, price: 1 }).toArray() as unknown as PropertyCatalogEntry[];
}

export async function getProperty(key: string): Promise<PropertyCatalogEntry | null> {
  const col = (await db()).collection<PropertyCatalogEntry>('properties_catalog');
  return (await col.findOne({ key })) as unknown as PropertyCatalogEntry | null;
}

export async function createProperty(input: Omit<PropertyCatalogEntry, '_id' | 'created_at' | 'updated_at'>): Promise<void> {
  const col = (await db()).collection<PropertyCatalogEntry>('properties_catalog');
  const now = new Date();
  await col.insertOne({
    ...input,
    slot_rules_override: input.slot_rules_override ?? null,
    created_at: now,
    updated_at: now,
  } as any);
}

export async function updateProperty(key: string, patch: Partial<Omit<PropertyCatalogEntry, '_id' | 'key' | 'created_at'>>): Promise<void> {
  const col = (await db()).collection<PropertyCatalogEntry>('properties_catalog');
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith('$') || k.includes('.')) continue;
    sanitized[k] = v;
  }
  sanitized.updated_at = new Date();
  await col.updateOne({ key }, { $set: sanitized });
}

export async function deleteProperty(key: string): Promise<{ deletedCatalog: boolean; hadOwner: boolean }> {
  const d = await db();
  const ownerDoc = await d.collection('user_properties').findOne({ property_key: key });
  if (ownerDoc) {
    return { deletedCatalog: false, hadOwner: true };
  }
  const res = await d.collection('properties_catalog').deleteOne({ key });
  return { deletedCatalog: res.deletedCount > 0, hadOwner: false };
}

// ── Catalog: items ──

export async function listItems(opts: { category?: ItemCategory; activeOnly?: boolean } = {}): Promise<ItemCatalogEntry[]> {
  const col = (await db()).collection<ItemCatalogEntry>('properties_items_catalog');
  const q: any = {};
  if (opts.category) q.category = opts.category;
  if (opts.activeOnly) q.active = true;
  return col.find(q).sort({ category: 1, rarity: 1, price: 1 }).toArray() as unknown as ItemCatalogEntry[];
}

export async function getItem(key: string): Promise<ItemCatalogEntry | null> {
  const col = (await db()).collection<ItemCatalogEntry>('properties_items_catalog');
  return (await col.findOne({ key })) as unknown as ItemCatalogEntry | null;
}

export async function createItem(input: Omit<ItemCatalogEntry, '_id' | 'created_at' | 'updated_at'>): Promise<void> {
  const col = (await db()).collection<ItemCatalogEntry>('properties_items_catalog');
  const now = new Date();
  await col.insertOne({ ...input, created_at: now, updated_at: now } as any);
}

export async function updateItem(key: string, patch: Partial<Omit<ItemCatalogEntry, '_id' | 'key' | 'created_at'>>): Promise<void> {
  const col = (await db()).collection<ItemCatalogEntry>('properties_items_catalog');
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith('$') || k.includes('.')) continue;
    sanitized[k] = v;
  }
  sanitized.updated_at = new Date();
  await col.updateOne({ key }, { $set: sanitized });
}

export async function deleteItem(key: string): Promise<{ deletedCatalog: boolean; placedCount: number }> {
  const d = await db();
  const placed = await d.collection('user_property_items').countDocuments({ item_key: key });
  if (placed > 0) {
    return { deletedCatalog: false, placedCount: placed };
  }
  const res = await d.collection('properties_items_catalog').deleteOne({ key });
  return { deletedCatalog: res.deletedCount > 0, placedCount: 0 };
}

// ── Ownership ──

export async function listOwnership(opts: {
  state?: 'owned' | 'damaged' | 'foreclosed';
  discordId?: string;
  limit?: number;
} = {}): Promise<UserPropertyRow[]> {
  const d = await db();
  const q: any = {};
  if (opts.state) q.state = opts.state;
  if (opts.discordId) q.discord_id = opts.discordId;

  const limit = Math.min(200, Math.max(10, opts.limit ?? 100));
  const docs = await d.collection('user_properties').find(q).sort({ purchased_at: -1 }).limit(limit).toArray();
  if (docs.length === 0) return [];

  const keys = Array.from(new Set(docs.map((r: any) => r.property_key)));
  const catalog = await d.collection('properties_catalog').find({ key: { $in: keys } }).toArray();
  const byKey = new Map(catalog.map((c: any) => [c.key, c]));

  return docs.map((r: any) => {
    const cat: any = byKey.get(r.property_key);
    return {
      _id: String(r._id),
      discord_id: r.discord_id,
      property_key: r.property_key,
      custom_name: r.custom_name ?? null,
      purchased_at: r.purchased_at,
      last_repaired_at: r.last_repaired_at ?? null,
      damage_percent: r.damage_percent ?? 0,
      foreclosure_deadline: r.foreclosure_deadline ?? null,
      state: r.state,
      property_name: cat?.name ?? null,
      property_tier: (cat?.tier ?? null) as PropertyTier | null,
    };
  });
}

// Admin force-foreclose — removes ownership + returns placed items to storage.
// The next scheduled Butler sweep will audit-log; this path logs immediately for dashboard visibility.
export async function adminForceForeclose(discordId: string, adminDiscordId: string): Promise<{ forecloseddKey: string | null; itemsReturned: number }> {
  const d = await db();
  const ownerDoc: any = await d.collection('user_properties').findOne({ discord_id: discordId });
  if (!ownerDoc) return { forecloseddKey: null, itemsReturned: 0 };

  const returnRes = await d.collection('user_property_items').updateMany(
    { discord_id: discordId, placed_in_property_key: ownerDoc.property_key },
    { $set: { placed_in_property_key: null, placed_slot_index: null } },
  );
  await d.collection('user_properties').deleteOne({ _id: ownerDoc._id });

  // Write a foreclosure transaction to property_transactions so dashboards see it
  await d.collection('property_transactions').insertOne({
    discord_id: discordId,
    type: 'foreclosure',
    amount: 0,
    metadata: {
      property_key: ownerDoc.property_key,
      admin_action: 'force-foreclose',
      admin_id: adminDiscordId,
      items_returned: returnRes.modifiedCount,
    },
    created_at: new Date(),
  } as any);

  return { forecloseddKey: ownerDoc.property_key, itemsReturned: returnRes.modifiedCount };
}

// ── Stats ──

export async function getVaelcroftStats(): Promise<VaelcroftStats> {
  const d = await db();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [propsTotal, propsSold, itemsTotal, damagedDocs, pendingForeclosures, sunkAgg] = await Promise.all([
    d.collection('properties_catalog').countDocuments({}),
    d.collection('user_properties').countDocuments({}),
    d.collection('properties_items_catalog').countDocuments({}),
    d.collection('user_properties').countDocuments({ state: 'damaged' }),
    d.collection('user_properties').countDocuments({ state: 'damaged', foreclosure_deadline: { $lte: now } }),
    d.collection('property_transactions').aggregate([
      { $match: { type: { $in: ['buy_property', 'buy_item', 'repair'] }, created_at: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
  ]);

  const lunariSunkLast30d = Math.abs(Number((sunkAgg[0] as any)?.total ?? 0));

  const activeProps = await d.collection('properties_catalog').countDocuments({ active: true });
  const activeAvailable = Math.max(0, activeProps - propsSold);

  return {
    properties_total: propsTotal,
    properties_sold: propsSold,
    properties_active_for_sale: activeAvailable,
    items_total: itemsTotal,
    active_eclipses: damagedDocs,
    pending_foreclosures: pendingForeclosures,
    lunari_sunk_last_30d: lunariSunkLast30d,
  };
}
