/**
 * Weighted random selection — matches the Discord bot algorithm exactly.
 * Uses a pool-based approach where each item gets Math.max(1, Math.round(weight * 1000)) entries.
 */
export function weightedRandomDraw<T extends { weight: number }>(items: T[]): T {
  // Filter out weight-0 items (admin-only)
  const eligible = items.filter((i) => i.weight > 0);

  if (eligible.length === 0) {
    throw new Error('No eligible items for weighted random draw');
  }

  // Build pool: each item gets Math.max(1, Math.round(weight * 1000)) entries
  const pool: T[] = [];
  for (const item of eligible) {
    const entries = Math.max(1, Math.round(item.weight * 1000));
    for (let i = 0; i < entries; i++) {
      pool.push(item);
    }
  }

  // Random selection
  return pool[Math.floor(Math.random() * pool.length)];
}
