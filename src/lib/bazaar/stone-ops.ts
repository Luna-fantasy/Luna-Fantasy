import clientPromise from '@/lib/mongodb';

interface StoneRecord {
  id: number;
  name: string;
  imageUrl: string;
  acquiredAt: string;
}

interface StoneData {
  stones: StoneRecord[];
}

/**
 * Read user's stone collection.
 * Data is stored as { stones: [...] } (sometimes stringified).
 */
export async function getUserStones(discordId: string): Promise<StoneData> {
  const client = await clientPromise;
  const db = client.db('Database');
  const doc = await db.collection('stones').findOne({ _id: discordId as any });

  if (!doc?.data) return { stones: [] };

  try {
    const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    return { stones: parsed.stones ?? (Array.isArray(parsed) ? parsed : []) };
  } catch {
    return { stones: [] };
  }
}

/**
 * Check if user already owns a stone by name.
 */
export async function userOwnsStone(discordId: string, stoneName: string): Promise<boolean> {
  const { stones } = await getUserStones(discordId);
  return stones.some((s) => s.name === stoneName);
}

const MAX_RETRIES = 3;

/**
 * Add a stone to user's collection using optimistic concurrency.
 *
 * Stones are ALWAYS added, even duplicates (unlike cards).
 * Uses read-modify-write with exact match on old data to prevent
 * concurrent writes from overwriting each other.
 */
export async function addStoneToUser(
  discordId: string,
  stone: { name: string; imageUrl: string }
): Promise<void> {
  const client = await clientPromise;
  const db = client.db('Database');
  const collection = db.collection('stones');

  const newStone: StoneRecord = {
    id: Date.now() + Math.random(),
    name: stone.name,
    imageUrl: stone.imageUrl,
    acquiredAt: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const doc = await collection.findOne({ _id: discordId as any });

    if (!doc) {
      // No document exists — insert new one with upsert guard
      const result = await collection.updateOne(
        { _id: discordId as any },
        { $setOnInsert: { data: { stones: [newStone] } } },
        { upsert: true }
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) return;
      // Another insert beat us — re-read and append
      continue;
    }

    // Parse existing stones — CLONE to avoid mutating doc.data
    // (doc.data is used in the match filter for optimistic concurrency)
    let stoneData: StoneData;
    try {
      const parsed = doc.data
        ? typeof doc.data === 'string'
          ? JSON.parse(doc.data)
          : doc.data
        : { stones: [] };
      const rawStones = parsed.stones ?? (Array.isArray(parsed) ? parsed : []);
      stoneData = { stones: [...rawStones] }; // Shallow clone
    } catch {
      stoneData = { stones: [] };
    }

    stoneData.stones.push(newStone);

    // Optimistic concurrency: only update if data hasn't changed since our read.
    // doc.data still holds the ORIGINAL value (not mutated thanks to clone).
    const updateResult = await collection.updateOne(
      { _id: discordId as any, data: doc.data },
      { $set: { data: stoneData } }
    );

    if (updateResult.modifiedCount > 0) return; // Success

    // Data was modified by another request — retry
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }

  // All retries exhausted — throw to trigger refund
  throw new Error('Failed to add stone after retries (concurrent modification)');
}
