import clientPromise from '@/lib/mongodb';

interface CardRecord {
  name: string;
  rarity: string;
  attack: number;
  imageUrl: string;
  weight?: number;
  source: string;
  obtainedDate: string;
  id: string;
}

let cardIdCounter = 0;

/**
 * Read user's card collection from the cards collection.
 * Data is stored as a JSON array (sometimes stringified).
 */
export async function getUserCards(discordId: string): Promise<CardRecord[]> {
  const client = await clientPromise;
  const db = client.db('Database');
  const doc = await db.collection('cards').findOne({ _id: discordId as any });

  if (!doc?.data) return [];

  try {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  } catch {
    return [];
  }
}

/**
 * Check if user already owns a card by name.
 */
export async function userOwnsCard(discordId: string, cardName: string): Promise<boolean> {
  const cards = await getUserCards(discordId);
  return cards.some((c) => c.name === cardName);
}

const MAX_RETRIES = 3;

/**
 * Add a card to user's collection using optimistic concurrency.
 *
 * Uses a read-modify-write loop with exact match on the old data value
 * to prevent concurrent writes from overwriting each other.
 * If the match fails (another write happened), re-reads and retries.
 */
export async function addCardToUser(
  discordId: string,
  card: { name: string; rarity: string; attack: number; imageUrl: string; weight?: number },
  tierLabel: string
): Promise<void> {
  const client = await clientPromise;
  const db = client.db('Database');
  const collection = db.collection('cards');

  const newCard: CardRecord = {
    name: card.name,
    rarity: card.rarity,
    attack: card.attack,
    imageUrl: card.imageUrl,
    weight: card.weight,
    source: tierLabel,
    obtainedDate: new Date().toISOString(),
    id: `${card.name}_${Date.now()}_${cardIdCounter++}`,
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const doc = await collection.findOne({ _id: discordId as any });

    if (!doc) {
      // No document exists — insert new one with upsert guard
      const result = await collection.updateOne(
        { _id: discordId as any },
        { $setOnInsert: { data: [newCard] } },
        { upsert: true }
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) return;
      // Another insert beat us — re-read and append
      continue;
    }

    // Parse existing cards — CLONE the array to avoid mutating doc.data
    // (doc.data is used in the match filter for optimistic concurrency)
    let cards: CardRecord[];
    try {
      const raw = doc.data
        ? typeof doc.data === 'string'
          ? JSON.parse(doc.data)
          : Array.isArray(doc.data) ? doc.data : []
        : [];
      cards = [...raw]; // Shallow clone so push doesn't mutate doc.data
    } catch {
      cards = [];
    }

    cards.push(newCard);

    // Optimistic concurrency: only update if data hasn't changed since our read.
    // doc.data still holds the ORIGINAL value (not mutated thanks to clone).
    const updateResult = await collection.updateOne(
      { _id: discordId as any, data: doc.data },
      { $set: { data: cards } }
    );

    if (updateResult.modifiedCount > 0) return; // Success

    // Data was modified by another request — retry
    if (attempt < MAX_RETRIES - 1) {
      // Small jittered delay to reduce contention
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }

  // All retries exhausted — throw to trigger refund
  throw new Error('Failed to add card after retries (concurrent modification)');
}

/**
 * Remove a card from user's collection using optimistic concurrency.
 *
 * Uses the same read-modify-write loop with exact match on old data value.
 * Returns the removed CardRecord, or null if the card was not found.
 */
export async function removeCardFromUser(
  discordId: string,
  cardId: string
): Promise<CardRecord | null> {
  const client = await clientPromise;
  const db = client.db('Database');
  const collection = db.collection('cards');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const doc = await collection.findOne({ _id: discordId as any });
    if (!doc?.data) return null;

    let cards: CardRecord[];
    try {
      const raw = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
      cards = Array.isArray(raw) ? [...raw] : [];
    } catch {
      return null;
    }

    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx === -1) return null;

    const [removed] = cards.splice(idx, 1);

    const updateResult = await collection.updateOne(
      { _id: discordId as any, data: doc.data },
      { $set: { data: cards } }
    );

    if (updateResult.modifiedCount > 0) return removed;

    // Data was modified by another request — retry
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }

  return null;
}
