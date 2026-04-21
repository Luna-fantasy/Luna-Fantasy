import clientPromise from '@/lib/mongodb';
import { STONE_TIERS, TIER_TONES, type StoneTier, type StoneDef, type StonesSnapshot } from './stones-v2-types';

export { STONE_TIERS, TIER_TONES };
export type { StoneTier, StoneDef, StonesSnapshot };

function normalizeTier(t: unknown): StoneTier | null {
  const v = String(t ?? '').toLowerCase();
  return (STONE_TIERS as readonly string[]).includes(v) ? (v as StoneTier) : null;
}

export async function getStonesSnapshot(): Promise<StonesSnapshot> {
  const client = await clientPromise;
  const db = client.db('Database');

  // Source of truth: bot_config._id="jester_moon_stones".data.{stones, forbidden_stones}
  const [configDoc, distAgg, holdersAgg] = await Promise.all([
    db.collection('bot_config').findOne({ _id: 'jester_moon_stones' as any }),
    db.collection('stones').aggregate([
      { $project: { stones: { $ifNull: ['$items', '$stones'] } } },
      { $unwind: { path: '$stones', preserveNullAndEmptyArrays: false } },
      { $group: {
        _id: { $ifNull: ['$stones.name', 'unknown'] },
        copies: { $sum: 1 },
        owners: { $addToSet: '$_id' },
      } },
      { $project: { copies: 1, owners: { $size: '$owners' } } },
    ]).toArray(),
    db.collection('stones').aggregate([
      { $match: { $or: [{ items: { $exists: true, $ne: [] } }, { stones: { $exists: true, $ne: [] } }] } },
      { $count: 'n' },
    ]).toArray(),
  ]);

  const own = new Map<string, { copies: number; owners: number }>();
  for (const row of distAgg) {
    const key = String((row as any)._id ?? '').toLowerCase();
    own.set(key, { copies: Number((row as any).copies ?? 0), owners: Number((row as any).owners ?? 0) });
  }

  const byTier = Object.fromEntries(STONE_TIERS.map((t) => [t, []])) as unknown as Record<StoneTier, StoneDef[]>;
  const tierCounts = Object.fromEntries(STONE_TIERS.map((t) => [t, 0])) as unknown as Record<StoneTier, number>;

  const moonData = (configDoc as any)?.data ?? {};
  const sources: Array<{ tier: StoneTier; items: any[] }> = [
    { tier: 'regular',   items: Array.isArray(moonData.stones) ? moonData.stones : [] },
    { tier: 'forbidden', items: Array.isArray(moonData.forbidden_stones) ? moonData.forbidden_stones : [] },
  ];

  for (const { tier, items } of sources) {
    const totalWeight = items.reduce((a: number, c: any) => a + Number(c.weight ?? 0), 0) || 1;
    for (const item of items) {
      const weight = Number(item.weight ?? 0);
      const ownership = own.get(String(item.name ?? '').toLowerCase()) ?? { copies: 0, owners: 0 };
      byTier[tier].push({
        name: String(item.name ?? 'Unknown'),
        tier,
        weight,
        sellPrice: Number(item.sell_price ?? item.sellPrice ?? 0),
        emojiId: item.emoji_id ?? item.emojiId ?? null,
        imageUrl: item.imageUrl ?? null,
        type: item.type ?? (tier === 'forbidden' ? 'forbidden' : null),
        ownerCount: ownership.owners,
        copiesOwned: ownership.copies,
        dropPct: (weight / totalWeight) * 100,
      });
      tierCounts[tier]++;
    }
  }

  for (const t of STONE_TIERS) {
    byTier[t].sort((a, b) => b.copiesOwned - a.copiesOwned || a.name.localeCompare(b.name));
  }

  const defined = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  const owned = Array.from(own.values()).reduce((a, b) => a + b.copies, 0);
  const holders = (holdersAgg[0] as any)?.n ?? 0;

  return {
    byTier,
    totals: { defined, owned, holders, tierCounts },
  };
}
