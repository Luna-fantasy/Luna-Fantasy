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
  imageVersion?: number;
  items: VendorItem[];
}

// In-memory cache: shopId → { config, expiresAt }
const cache = new Map<string, { config: VendorConfig; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Call after an admin write so the bazaar reflects the change immediately. */
export function invalidateVendorConfigCache(shopId?: string): void {
  if (shopId) cache.delete(shopId);
  else cache.clear();
}

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

// ── Public bazaar merchant portraits ──

export type MerchantSlug = 'kael' | 'meluna' | 'zoldar' | 'seluna' | 'brimor' | 'mells';

// Public slug → the vendor_config doc the admin Shops tab writes portraits to.
// Seluna is special-cased below (its settings live in the seluna_vendor collection).
const MERCHANT_VENDOR_DOC = {
  kael: 'luckbox',
  meluna: 'stonebox',
  zoldar: 'tickets',
  brimor: 'brimor',
  mells: 'mells_selvair',
} as const;

// Version-stamped server-side from the STORED imageVersion — client-side ?v=
// synthesis is banned here (see lib/admin/cache-bust.ts for the cached-404
// story). The stamp is what defeats the 1-year immutable header on R2 keys
// that get overwritten in place.
function stampVersion(image: unknown, version: unknown): string | null {
  if (typeof image !== 'string' || !image.trim()) return null;
  if (typeof version !== 'number' || !version) return image;
  const sep = image.includes('?') ? '&' : '?';
  return `${image}${sep}v=${version}`;
}

/**
 * Final portrait URL per public bazaar merchant, read from the same fields
 * the admin Shops tab writes. Null when a vendor has no uploaded portrait
 * yet — callers keep their hardcoded fallback for those.
 */
export async function getMerchantThumbs(): Promise<Record<MerchantSlug, string | null>> {
  const vendorEntries = await Promise.all(
    (Object.keys(MERCHANT_VENDOR_DOC) as Array<keyof typeof MERCHANT_VENDOR_DOC>).map(async (slug) => {
      try {
        const cfg = await getVendorConfig(MERCHANT_VENDOR_DOC[slug]);
        return [slug, stampVersion(cfg?.image, cfg?.imageVersion)] as const;
      } catch {
        return [slug, null] as const;
      }
    })
  );

  let seluna: string | null = null;
  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const doc = await db.collection('seluna_vendor').findOne({ id: 'settings' } as any);
    const raw = (doc as any)?.value ?? (doc as any)?.data ?? {};
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
    seluna = stampVersion(settings?.image, settings?.imageVersion);
  } catch {
    // fall through — hardcoded fallback covers it
  }

  return { ...(Object.fromEntries(vendorEntries) as Record<keyof typeof MERCHANT_VENDOR_DOC, string | null>), seluna };
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
