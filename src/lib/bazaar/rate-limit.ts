/**
 * In-memory sliding window rate limiter for bazaar purchase endpoints.
 * Limits requests per user per endpoint to prevent rapid-fire purchases.
 *
 * Note: In-memory only — resets on server restart. For multi-instance
 * deployments, swap to Redis-based rate limiting.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Cleanup stale entries every 5 minutes — guarded against hot-reload duplication
const CLEANUP_KEY = Symbol.for('bazaar-rate-limit-cleanup');
if (!(globalThis as any)[CLEANUP_KEY]) {
  setInterval(() => {
    const cutoff = Date.now() - 120_000; // 2 min old entries
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        if (entry.timestamps.length === 0) store.delete(key);
      }
    }
  }, 300_000);
  (globalThis as any)[CLEANUP_KEY] = true;
}

/**
 * Check rate limit for a user on a given endpoint.
 * @param endpoint - Endpoint identifier (e.g., "luckbox", "stonebox")
 * @param userId - User's discord ID
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed, retryAfterMs } — retryAfterMs is 0 if allowed
 */
export function checkRateLimit(
  endpoint: string,
  userId: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  if (!stores.has(endpoint)) {
    stores.set(endpoint, new Map());
  }
  const store = stores.get(endpoint)!;

  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(userId, entry);
  }

  // Prune timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    // Calculate when the oldest request in the window will expire
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }

  entry.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

// Rate limit configs per endpoint
export const RATE_LIMITS = {
  luckbox: { maxRequests: 5, windowMs: 60_000 },      // 5 per minute
  stonebox: { maxRequests: 5, windowMs: 60_000 },      // 5 per minute
  tickets: { maxRequests: 5, windowMs: 60_000 },       // 5 per minute
  stripe: { maxRequests: 3, windowMs: 300_000 },       // 3 per 5 minutes
  marketplace_list: { maxRequests: 3, windowMs: 60_000 },   // 3 per minute
  marketplace_buy: { maxRequests: 5, windowMs: 60_000 },    // 5 per minute
  marketplace_cancel: { maxRequests: 5, windowMs: 60_000 }, // 5 per minute
  auction_create: { maxRequests: 3, windowMs: 60_000 },    // 3 per minute
  auction_bid: { maxRequests: 10, windowMs: 60_000 },      // 10 per minute
  auction_resolve: { maxRequests: 5, windowMs: 60_000 },   // 5 per minute
  swap_propose: { maxRequests: 3, windowMs: 60_000 },     // 3 per minute
  swap_respond: { maxRequests: 10, windowMs: 60_000 },    // 10 per minute
} as const;
