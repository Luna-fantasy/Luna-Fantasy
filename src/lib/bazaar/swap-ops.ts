import clientPromise from '@/lib/mongodb';
import type { CardSwap, SwapStatus } from '@/types/marketplace';

const SWAP_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

function getDb() {
  return clientPromise.then((client) => client.db('Database'));
}

function getCollection() {
  return getDb().then((db) => db.collection('card_swaps'));
}

/**
 * Generate a unique swap ID.
 */
export function generateSwapId(requesterId: string): string {
  return `swap_${Date.now()}_${requesterId}`;
}

/**
 * Calculate swap expiry date (48 hours from now).
 */
export function getSwapExpiryDate(): Date {
  return new Date(Date.now() + SWAP_DURATION_MS);
}

/**
 * Expire stale swaps — updates status to 'expired' for swaps past expiresAt.
 */
export async function expireStaleSwaps(): Promise<void> {
  const collection = await getCollection();
  await collection.updateMany(
    { status: 'pending', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired', resolvedAt: new Date() } }
  );
}

/**
 * Create a new swap offer.
 * Requester's card must already be escrowed (removed from collection).
 */
export async function createSwap(
  swap: Omit<CardSwap, '_id'>
): Promise<CardSwap> {
  const collection = await getCollection();
  const result = await collection.insertOne(swap as any);
  return { ...swap, _id: result.insertedId.toString() } as CardSwap;
}

/**
 * Get swap by ID.
 */
export async function getSwapById(swapId: string): Promise<CardSwap | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ swapId });
  return doc as unknown as CardSwap | null;
}

/**
 * Accept a swap — marks as accepted and returns the swap.
 * Caller handles the card transfer.
 */
export async function acceptSwap(
  swapId: string,
  targetId: string
): Promise<CardSwap | null> {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { swapId, targetId, status: 'pending' },
    {
      $set: {
        status: 'accepted' as SwapStatus,
        resolvedAt: now,
      },
    },
    { returnDocument: 'before' }
  );

  return result as unknown as CardSwap | null;
}

/**
 * Decline a swap — marks as declined.
 * Caller handles returning requester's card.
 */
export async function declineSwap(
  swapId: string,
  targetId: string
): Promise<CardSwap | null> {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { swapId, targetId, status: 'pending' },
    {
      $set: {
        status: 'declined' as SwapStatus,
        resolvedAt: now,
      },
    },
    { returnDocument: 'before' }
  );

  return result as unknown as CardSwap | null;
}

/**
 * Cancel own swap.
 * Caller handles returning requester's card.
 */
export async function cancelSwap(
  swapId: string,
  requesterId: string
): Promise<CardSwap | null> {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { swapId, requesterId, status: 'pending' },
    {
      $set: {
        status: 'cancelled' as SwapStatus,
        resolvedAt: now,
      },
    },
    { returnDocument: 'before' }
  );

  return result as unknown as CardSwap | null;
}

/**
 * Counter a swap — marks original as countered, links to new swap ID.
 */
export async function counterSwap(
  swapId: string,
  targetId: string,
  counterSwapId: string
): Promise<CardSwap | null> {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { swapId, targetId, status: 'pending' },
    {
      $set: {
        status: 'countered' as SwapStatus,
        counterSwapId,
        resolvedAt: now,
      },
    },
    { returnDocument: 'before' }
  );

  return result as unknown as CardSwap | null;
}

/**
 * Get incoming swap offers for a user.
 */
export async function getIncomingSwaps(targetId: string): Promise<CardSwap[]> {
  await expireStaleSwaps();
  const collection = await getCollection();
  const docs = await collection
    .find({ targetId, status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs as unknown as CardSwap[];
}

/**
 * Get outgoing swap offers from a user.
 */
export async function getOutgoingSwaps(requesterId: string): Promise<CardSwap[]> {
  await expireStaleSwaps();
  const collection = await getCollection();
  const docs = await collection
    .find({ requesterId, status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs as unknown as CardSwap[];
}

/**
 * Get swap history for a user (resolved swaps).
 */
export async function getSwapHistory(userId: string): Promise<CardSwap[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({
      $or: [{ requesterId: userId }, { targetId: userId }],
      status: { $in: ['accepted', 'declined', 'countered', 'cancelled', 'expired'] },
    })
    .sort({ resolvedAt: -1 })
    .limit(50)
    .toArray();
  return docs as unknown as CardSwap[];
}

/**
 * Return expired swap cards to requesters.
 * Finds expired swaps and restores escrowed cards.
 */
export async function returnExpiredSwapCards(): Promise<void> {
  const collection = await getCollection();
  const { addCardToUser } = await import('@/lib/bazaar/card-ops');

  // Find expired swaps that need card returns (use a flag field or check status)
  const expiredSwaps = await collection
    .find({ status: 'expired' })
    .toArray();

  for (const swap of expiredSwaps) {
    try {
      await addCardToUser(
        swap.requesterId,
        {
          name: swap.requesterCard.name,
          rarity: swap.requesterCard.rarity,
          attack: swap.requesterCard.attack,
          imageUrl: swap.requesterCard.imageUrl,
          weight: swap.requesterCard.weight,
        },
        swap.requesterCard.source || 'Swap Expired'
      );

      // Mark as handled by changing status to prevent re-processing
      await collection.updateOne(
        { _id: swap._id, status: 'expired' },
        { $set: { status: 'expired_returned' } }
      );
    } catch (err) {
      console.error(`[swaps] Failed to return card for swap ${swap.swapId}:`, err);
    }
  }
}
