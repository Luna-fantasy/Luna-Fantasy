import clientPromise from '@/lib/mongodb';
import { RARITY_ORDER, type Rarity, type CardDef, type CardsSnapshot } from './cards-v2-types';

export { RARITY_ORDER, RARITY_TONES } from './cards-v2-types';
export type { Rarity, CardDef, CardsSnapshot } from './cards-v2-types';

function normalizeRarity(r: unknown): Rarity | null {
  const up = String(r ?? '').toUpperCase();
  // SPECIAL was deprecated 2026-04-15 — fold any residual docs into SECRET.
  if (up === 'SPECIAL') return 'SECRET';
  if ((RARITY_ORDER as readonly string[]).includes(up)) return up as Rarity;
  return null;
}

export async function getCardsSnapshot(): Promise<CardsSnapshot> {
  const client = await clientPromise;
  const db = client.db('Database');

  const [configDocs, distAgg, holdersAgg] = await Promise.all([
    db.collection('cards_config').find({}).toArray(),
    // Ownership: per-user cards arrays; $unwind counts
    db.collection('cards').aggregate([
      { $project: { cards: { $ifNull: ['$items', '$cards'] } } },
      { $unwind: { path: '$cards', preserveNullAndEmptyArrays: false } },
      { $group: {
        _id: { name: '$cards.name', rarity: { $toUpper: '$cards.rarity' } },
        copies: { $sum: 1 },
        owners: { $addToSet: '$_id' },
      } },
      { $project: { copies: 1, owners: { $size: '$owners' } } },
    ]).toArray(),
    // Distinct holder count
    db.collection('cards').aggregate([
      { $match: { $or: [{ items: { $exists: true, $ne: [] } }, { cards: { $exists: true, $ne: [] } }] } },
      { $count: 'n' },
    ]).toArray(),
  ]);

  // Build ownership lookup: "name|rarity" → { copies, owners }
  // Fold any 'SPECIAL' rarity entries into 'SECRET' since the tier is deprecated.
  const own = new Map<string, { copies: number; owners: number }>();
  for (const row of distAgg) {
    let rarity = String((row as any)._id?.rarity ?? '').toUpperCase();
    if (rarity === 'SPECIAL') rarity = 'SECRET';
    const key = `${String((row as any)._id?.name ?? '').toLowerCase()}|${rarity}`;
    const existing = own.get(key);
    if (existing) {
      existing.copies += Number((row as any).copies ?? 0);
      existing.owners += Number((row as any).owners ?? 0);
    } else {
      own.set(key, { copies: Number((row as any).copies ?? 0), owners: Number((row as any).owners ?? 0) });
    }
  }

  const byRarity = Object.fromEntries(RARITY_ORDER.map((r) => [r, []])) as unknown as Record<Rarity, CardDef[]>;
  const rarityCounts = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0])) as unknown as Record<Rarity, number>;

  for (const doc of configDocs) {
    const rarity = normalizeRarity((doc as any)._id);
    if (!rarity) continue;
    const items = Array.isArray((doc as any).items) ? (doc as any).items : [];
    const totalWeight = items.reduce((a: number, c: any) => a + Number(c.weight ?? 0), 0) || 1;

    for (const item of items) {
      const weight = Number(item.weight ?? 0);
      const key = `${String(item.name ?? '').toLowerCase()}|${rarity}`;
      const ownership = own.get(key) ?? { copies: 0, owners: 0 };
      byRarity[rarity].push({
        name: String(item.name ?? 'Unknown'),
        rarity,
        attack: Number(item.attack ?? 0),
        weight,
        imageUrl: item.imageUrl ?? null,
        ownerCount: ownership.owners,
        copiesOwned: ownership.copies,
        dropPct: (weight / totalWeight) * 100,
      });
      rarityCounts[rarity]++;
    }
  }

  // Sort each rarity by ownership desc then name
  for (const r of RARITY_ORDER) {
    byRarity[r].sort((a, b) => b.copiesOwned - a.copiesOwned || a.name.localeCompare(b.name));
  }

  const defined = Object.values(rarityCounts).reduce((a, b) => a + b, 0);
  const owned = Array.from(own.values()).reduce((a, b) => a + b.copies, 0);
  const holders = (holdersAgg[0] as any)?.n ?? 0;

  return {
    byRarity,
    totals: { defined, owned, holders, rarityCounts },
  };
}
