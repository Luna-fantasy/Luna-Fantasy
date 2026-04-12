/**
 * Passport discount for website bazaar purchases.
 *
 * Mirrors the 10% discount that Butler (shop.ts:323) and Jester
 * (passport_discount.ts) apply to all shop purchases for Luna Passport
 * holders. Both bots check for the Passport role; the website checks
 * profile.data.passport directly because the profile is the source of
 * truth — the role is a derived convenience signal.
 *
 * Usage in a bazaar route:
 *   const discount = await getPassportDiscount(discordId);
 *   const finalPrice = discount.apply(item.price);
 *   // use finalPrice for deductLunari + addToBankReserve + logTransaction
 */

import clientPromise from '@/lib/mongodb';

export const PASSPORT_DISCOUNT_RATE = 0.10;

// In-memory cache so multiple calls within the same request don't re-query.
// 60s TTL — short enough to reflect revocations quickly, long enough to
// batch consecutive purchases in a single session.
const cache = new Map<string, { hasPassport: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Check if a user holds a Luna Passport (profile.data.passport is non-null).
 * Cached for 60 seconds per user.
 */
export async function hasPassport(discordId: string): Promise<boolean> {
  const cached = cache.get(discordId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.hasPassport;
  }

  let result = false;
  try {
    const client = await clientPromise;
    const doc = await client.db('Database').collection('profiles').findOne(
      { _id: discordId as any },
      { projection: { 'data.passport': 1, passport: 1 } }
    );

    if (doc) {
      // Top-level passport field (flat docs)
      if ((doc as any).passport) {
        result = true;
      } else {
        const data = (doc as any).data;
        if (typeof data === 'object' && data?.passport) {
          result = true;
        } else if (typeof data === 'string') {
          try {
            result = !!JSON.parse(data)?.passport;
          } catch { /* ignore */ }
        }
      }
    }
  } catch (err) {
    console.error('[passport-discount] Failed to check passport:', err);
  }

  cache.set(discordId, { hasPassport: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export interface PassportDiscount {
  /** Whether the user holds a passport and qualifies for the discount */
  eligible: boolean;
  /** Apply the discount to a price. Returns Math.floor(price * 0.9) for holders, or original price. */
  apply: (price: number) => number;
  /** Amount saved on a given price (0 if not eligible) */
  savings: (price: number) => number;
}

/**
 * Get the passport discount state for a user. Call once per request,
 * then use the returned object for price computation + metadata.
 */
export async function getPassportDiscount(discordId: string): Promise<PassportDiscount> {
  const eligible = await hasPassport(discordId);
  return {
    eligible,
    apply: (price: number) =>
      eligible ? Math.floor(price * (1 - PASSPORT_DISCOUNT_RATE)) : price,
    savings: (price: number) =>
      eligible ? price - Math.floor(price * (1 - PASSPORT_DISCOUNT_RATE)) : 0,
  };
}
