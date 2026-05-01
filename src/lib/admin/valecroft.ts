// Valecroft family (Luna Butler properties vendor) admin helpers — SERVER-ONLY.
// Reads/writes the new collections: properties_catalog, properties_items_catalog,
// user_properties, user_property_items, property_eclipse_events, property_transactions.
// Pure types / constants live in `./valecroft-types.ts` (import those from client components).

import clientPromise from '@/lib/mongodb';
import {
  ITEM_CATEGORIES, RARITIES, PROPERTY_TIERS, DEFAULT_TIER_SLOT_RULES,
  slugifyKey,
  type PropertyTier, type Rarity, type ItemCategory, type SlotRule,
  type PropertyCatalogEntry, type ItemCatalogEntry,
  type UserPropertyRow, type ValecroftStats,
} from './valecroft-types';

// Re-export so existing server-side imports keep working.
export {
  ITEM_CATEGORIES, RARITIES, PROPERTY_TIERS, DEFAULT_TIER_SLOT_RULES,
  slugifyKey,
};
export type {
  PropertyTier, Rarity, ItemCategory, SlotRule,
  PropertyCatalogEntry, ItemCatalogEntry,
  UserPropertyRow, ValecroftStats,
};

// ── Catalog: properties ──

function db() {
  return clientPromise.then(c => c.db('Database'));
}

export async function listProperties(opts: { activeOnly?: boolean; includeSpecial?: boolean } = {}): Promise<PropertyCatalogEntry[]> {
  const col = (await db()).collection<PropertyCatalogEntry>('properties_catalog');
  const q: any = {};
  if (opts.activeOnly) q.active = true;
  // Special properties are gifts — never listed in any public catalog
  // surface. The admin dashboard can still see them by passing
  // `includeSpecial: true`.
  if (!opts.includeSpecial) q.tier = { $ne: 'special' };
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

// ── Owners (per-property + per-item) ──

export interface OwnerRow {
    discord_id: string;
    state?: string;
    damage_percent?: number;
    purchased_at?: Date | string;
    custom_name?: string | null;
    granted_by_admin?: boolean;
}

export async function listPropertyOwners(key: string): Promise<OwnerRow[]> {
    const d = await db();
    const rows = await d.collection('user_properties').find({ property_key: key }).toArray();
    return rows.map((r: any) => ({
        discord_id: String(r.discord_id),
        state: r.state,
        damage_percent: r.damage_percent ?? 0,
        purchased_at: r.purchased_at,
        custom_name: r.custom_name ?? null,
        granted_by_admin: r.granted_by_admin === true,
    }));
}

/** Grant a property to a user without payment. One-property-per-user is still
 *  enforced — if the user already owns a different property this returns false. */
export async function grantPropertyToUser(discordId: string, key: string): Promise<{ ok: boolean; reason?: string }> {
    const d = await db();
    const prop = await d.collection<PropertyCatalogEntry>('properties_catalog').findOne({ key });
    if (!prop) return { ok: false, reason: 'unknown_property' };
    if (prop.active === false) return { ok: false, reason: 'inactive' };

    const existing = await d.collection('user_properties').findOne({ discord_id: discordId });
    if (existing) {
        return { ok: false, reason: existing.property_key === key ? 'already_owns_this' : 'already_owns_other' };
    }
    await d.collection('user_properties').insertOne({
        discord_id: discordId,
        property_key: key,
        custom_name: null,
        purchased_at: new Date(),
        last_repaired_at: null,
        damage_percent: 0,
        foreclosure_deadline: null,
        state: 'owned',
        granted_by_admin: true,
    } as any);
    return { ok: true };
}

/** Revoke a property from a user. Returns placed items to storage so the user
 *  doesn't lose them. */
export async function revokePropertyFromUser(discordId: string, key: string): Promise<{ ok: boolean; itemsReturned: number }> {
    const d = await db();
    const owner = await d.collection('user_properties').findOne({ discord_id: discordId, property_key: key });
    if (!owner) return { ok: false, itemsReturned: 0 };
    const itemsRes = await d.collection('user_property_items').updateMany(
        { discord_id: discordId, placed_in_property_key: key },
        { $set: { placed_in_property_key: null, placed_slot_index: null } },
    );
    await d.collection('user_properties').deleteOne({ _id: (owner as any)._id });
    return { ok: true, itemsReturned: itemsRes.modifiedCount };
}

export async function listItemOwners(key: string): Promise<Array<{ discord_id: string; copies: number; placed: number; damaged: number }>> {
    const d = await db();
    const rows = await d.collection('user_property_items').find({ item_key: key }).toArray();
    const map = new Map<string, { copies: number; placed: number; damaged: number }>();
    for (const r of rows as any[]) {
        const id = String(r.discord_id);
        const cur = map.get(id) ?? { copies: 0, placed: 0, damaged: 0 };
        cur.copies += 1;
        if (r.placed_in_property_key) cur.placed += 1;
        if ((r.damage_percent ?? 0) > 0) cur.damaged += 1;
        map.set(id, cur);
    }
    return Array.from(map.entries()).map(([discord_id, v]) => ({ discord_id, ...v }));
}

export async function grantItemToUser(discordId: string, key: string): Promise<{ ok: boolean; reason?: string }> {
    const d = await db();
    const def = await d.collection('properties_items_catalog').findOne({ key });
    if (!def) return { ok: false, reason: 'unknown_item' };
    await d.collection('user_property_items').insertOne({
        discord_id: discordId,
        item_key: key,
        placed_in_property_key: null,
        placed_slot_index: null,
        acquired_at: new Date(),
        damage_percent: 0,
    } as any);
    return { ok: true };
}

/** Remove ONE copy of the item from the user. */
export async function revokeOneItemFromUser(discordId: string, key: string): Promise<{ ok: boolean }> {
    const d = await db();
    const row = await d.collection('user_property_items').findOne({ discord_id: discordId, item_key: key });
    if (!row) return { ok: false };
    await d.collection('user_property_items').deleteOne({ _id: (row as any)._id });
    return { ok: true };
}

// ── Special property grants (Mastermind only) ──

export interface GrantSpecialResult {
  ok: boolean;
  reason?: 'already_owns' | 'not_in_guild' | 'unknown_property' | 'not_special_tier' | 'inactive';
}

/**
 * Grant a `special`-tier property to a user. Bypasses purchase / price /
 * one-per-user checks because special properties are gifts. Refuses to
 * grant non-`special` tiers — those are sold normally and shouldn't be
 * handed out by this path.
 */
export async function grantSpecialProperty(discordId: string, key: string): Promise<GrantSpecialResult> {
  const d = await db();
  const prop = await d.collection<PropertyCatalogEntry>('properties_catalog').findOne({ key });
  if (!prop) return { ok: false, reason: 'unknown_property' };
  if (prop.tier !== 'special') return { ok: false, reason: 'not_special_tier' };
  if (prop.active === false) return { ok: false, reason: 'inactive' };

  // Special properties relax the one-property-per-user constraint:
  // a Mastermind can stack a Special grant on top of a regular property.
  // But we still don't want duplicate Special grants of the same key.
  const existing = await d.collection('user_properties').findOne({
    discord_id: discordId,
    property_key: key,
  });
  if (existing) return { ok: false, reason: 'already_owns' };

  await d.collection('user_properties').insertOne({
    discord_id: discordId,
    property_key: key,
    custom_name: null,
    purchased_at: new Date(),
    last_repaired_at: null,
    damage_percent: 0,
    foreclosure_deadline: null,
    state: 'owned',
    granted_by_admin: true,
  } as any);
  return { ok: true };
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
  // Mongo sorts rarity strings alphabetically (common, epic, forbidden,
  // legendary, rare, unique) which is not the canonical ladder. Re-sort
  // in JS so the admin table + bot vendors read in tier order:
  // common → rare → epic → unique → legendary → forbidden.
  const RARITY_RANK: Record<string, number> = {
    common: 0, rare: 1, epic: 2, unique: 3, legendary: 4, forbidden: 5,
  };
  const rows = await col.find(q).toArray();
  rows.sort((a: any, b: any) => {
    if (a.category !== b.category) return String(a.category).localeCompare(String(b.category));
    const ra = RARITY_RANK[a.rarity] ?? 99;
    const rb = RARITY_RANK[b.rarity] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.price ?? 0) - (b.price ?? 0);
  });
  return rows as unknown as ItemCatalogEntry[];
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

export async function getValecroftStats(): Promise<ValecroftStats> {
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
