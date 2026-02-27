/**
 * Read vendor shop configs from the shared `vendor_config` collection.
 *
 * Collection uses the st.db pattern: { _id: "brimor", data: { title, description, image, items } }
 * Both the bot (LunaJester/commands/shop.ts) and the web app read from this collection,
 * so item definitions live in one place — the database.
 *
 * Results are cached in-memory for 5 minutes to avoid repeated DB reads.
 */

import clientPromise from '@/lib/mongodb';

export interface VendorItem {
  id: string;
  name: string;
  price: number;
  roleId: string;
  description: string;
  imageUrl?: string;
  type?: string;
}

export interface VendorConfig {
  title: string;
  description: string;
  image: string;
  items: VendorItem[];
}

// In-memory cache: shopId → { config, expiresAt }
const cache = new Map<string, { config: VendorConfig; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a vendor's config from the `vendor_config` collection.
 * Returns null if the vendor doesn't exist in the DB.
 */
export async function getVendorConfig(shopId: string): Promise<VendorConfig | null> {
  const cached = cache.get(shopId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const client = await clientPromise;
  const db = client.db('Database');
  const doc = await db.collection('vendor_config').findOne({ _id: shopId as any });

  if (!doc?.data) return null;

  const config: VendorConfig = typeof doc.data === 'string'
    ? JSON.parse(doc.data)
    : doc.data;

  cache.set(shopId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
  return config;
}

/**
 * Get just the items array for a vendor. Convenience wrapper.
 */
export async function getVendorItems(shopId: string): Promise<VendorItem[]> {
  const config = await getVendorConfig(shopId);
  return config?.items ?? [];
}

/**
 * Find a single item by ID within a vendor's config.
 */
export async function findVendorItem(shopId: string, itemId: string): Promise<VendorItem | null> {
  const items = await getVendorItems(shopId);
  return items.find((i) => i.id === itemId) ?? null;
}
