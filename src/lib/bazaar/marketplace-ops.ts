import clientPromise from '@/lib/mongodb';
import type { MarketplaceListing, ListingFilters, ListingsResponse, AuctionBid, UserNotification } from '@/types/marketplace';

const LISTING_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LISTINGS_PER_PAGE = 20;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDb() {
  return clientPromise.then((client) => client.db('Database'));
}

function getCollection() {
  return getDb().then((db) => db.collection('card_marketplace'));
}

/**
 * Expire stale listings — updates status to 'expired' for listings past expiresAt.
 * Called before every listings query.
 */
export async function expireStaleListings(): Promise<void> {
  const collection = await getCollection();
  await collection.updateMany(
    { status: 'active', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired', updatedAt: new Date() } }
  );
}

/**
 * Return expired cards to their owners.
 * Finds expired listings where cardReturned is false and returns cards.
 */
export async function returnExpiredCards(): Promise<void> {
  const collection = await getCollection();
  const { addCardToUser } = await import('@/lib/bazaar/card-ops');

  const expiredListings = await collection
    .find({ status: 'expired', cardReturned: false })
    .project({ _id: 1, listingId: 1, sellerId: 1, card: 1 })
    .toArray();

  for (const listing of expiredListings) {
    try {
      await addCardToUser(
        listing.sellerId,
        {
          name: listing.card.name,
          rarity: listing.card.rarity,
          attack: listing.card.attack,
          imageUrl: listing.card.imageUrl,
          weight: listing.card.weight,
        },
        listing.card.source || 'Marketplace Return'
      );

      await collection.updateOne(
        { _id: listing._id, cardReturned: false },
        { $set: { cardReturned: true, updatedAt: new Date() } }
      );
    } catch (err) {
      console.error(`[marketplace] Failed to return card for listing ${listing.listingId}:`, err);
    }
  }
}

/**
 * Browse active listings with filters and pagination.
 */
export async function getActiveListings(filters: ListingFilters): Promise<ListingsResponse> {
  await expireStaleListings();

  const collection = await getCollection();
  const query: Record<string, any> = { status: 'active' };

  if (filters.rarity) {
    query['card.rarity'] = { $regex: new RegExp(`^${escapeRegex(filters.rarity)}$`, 'i') };
  }
  if (filters.game) {
    query['card.game'] = filters.game;
  }
  if (filters.search) {
    query['card.name'] = { $regex: new RegExp(escapeRegex(filters.search), 'i') };
  }
  if (filters.type) {
    query.type = filters.type;
  }

  let sortOption: Record<string, 1 | -1>;
  switch (filters.sort) {
    case 'price_asc':
      sortOption = { price: 1 };
      break;
    case 'price_desc':
      sortOption = { price: -1 };
      break;
    case 'oldest':
      sortOption = { createdAt: 1 };
      break;
    case 'ending_soon':
      sortOption = { expiresAt: 1 };
      break;
    case 'most_bids':
      sortOption = { bidCount: -1 };
      break;
    case 'newest':
    default:
      sortOption = { createdAt: -1 };
      break;
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? LISTINGS_PER_PAGE));
  const skip = (page - 1) * limit;

  const [listings, total] = await Promise.all([
    collection.find(query).sort(sortOption).skip(skip).limit(limit).toArray(),
    collection.countDocuments(query),
  ]);

  return {
    listings: listings as unknown as MarketplaceListing[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a user's own listings (all statuses).
 */
export async function getUserListings(sellerId: string): Promise<MarketplaceListing[]> {
  const collection = await getCollection();
  const listings = await collection
    .find({ sellerId })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return listings as unknown as MarketplaceListing[];
}

/**
 * Create a new marketplace listing.
 * Card must already be removed from user's collection (escrow).
 */
export async function createListing(
  listing: Omit<MarketplaceListing, '_id'>
): Promise<MarketplaceListing> {
  const collection = await getCollection();
  const result = await collection.insertOne(listing as any);
  return { ...listing, _id: result.insertedId.toString() } as MarketplaceListing;
}

/**
 * Atomic claim: attempt to buy a listing.
 * Uses findOneAndUpdate to ensure only one buyer succeeds.
 * Returns the listing if claimed, null otherwise.
 */
export async function claimListing(
  listingId: string,
  buyerId: string,
  buyerName: string
): Promise<MarketplaceListing | null> {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { listingId, status: 'active' },
    {
      $set: {
        status: 'sold',
        buyerId,
        buyerName,
        soldAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'before' }
  );

  return result as unknown as MarketplaceListing | null;
}

/**
 * Revert a claimed listing back to active (used on buy failure).
 */
export async function revertClaim(listingId: string): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne(
    { listingId, status: 'sold' },
    {
      $set: {
        status: 'active',
        updatedAt: new Date(),
      },
      $unset: {
        buyerId: '',
        buyerName: '',
        soldAt: '',
      },
    }
  );
}

/**
 * Cancel a listing and mark for card return.
 */
export async function cancelListing(
  listingId: string,
  sellerId: string
): Promise<MarketplaceListing | null> {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { listingId, sellerId, status: 'active' },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  return result as unknown as MarketplaceListing | null;
}

/**
 * Update listing price.
 */
export async function updateListingPrice(
  listingId: string,
  sellerId: string,
  newPrice: number
): Promise<MarketplaceListing | null> {
  const collection = await getCollection();

  const result = await collection.findOneAndUpdate(
    { listingId, sellerId, status: 'active' },
    { $set: { price: newPrice, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  return result as unknown as MarketplaceListing | null;
}

/**
 * Get listing by ID.
 */
export async function getListingById(
  listingId: string
): Promise<MarketplaceListing | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ listingId });
  return doc as unknown as MarketplaceListing | null;
}

/**
 * Generate a unique listing ID.
 */
export function generateListingId(sellerId: string): string {
  return `listing_${Date.now()}_${sellerId}`;
}

/**
 * Calculate listing expiry date (7 days from now).
 */
export function getExpiryDate(): Date {
  return new Date(Date.now() + LISTING_DURATION_MS);
}

// ─── Auction Operations ────────────────────────────────────────────

/**
 * Calculate minimum bid increment: max(100, 5% of current bid).
 */
export function getMinBidIncrement(currentBid: number): number {
  return Math.max(100, Math.floor(currentBid * 0.05));
}

/**
 * Calculate auction expiry based on duration in hours.
 */
export function getAuctionExpiryDate(durationHours: 24 | 48 | 72): Date {
  return new Date(Date.now() + durationHours * 60 * 60 * 1000);
}

/**
 * Generate a unique auction listing ID.
 */
export function generateAuctionId(sellerId: string): string {
  return `auction_${Date.now()}_${sellerId}`;
}

/**
 * Place a bid on an auction atomically.
 * Uses findOneAndUpdate with guard on currentBid to ensure atomicity.
 * Returns the updated listing if bid was placed, null if outbid or listing unavailable.
 */
export async function placeBid(
  listingId: string,
  bidderId: string,
  bidderName: string,
  bidAmount: number,
  expectedCurrentBid: number
): Promise<MarketplaceListing | null> {
  const collection = await getCollection();
  const now = new Date();

  const newBid: AuctionBid = {
    bidderId,
    bidderName,
    amount: bidAmount,
    timestamp: now,
  };

  const result = await collection.findOneAndUpdate(
    {
      listingId,
      type: 'auction',
      status: 'active',
      $or: [
        { currentBid: expectedCurrentBid },
        { currentBid: { $exists: false }, 'auctionConfig.startingPrice': { $lte: bidAmount } },
      ],
    },
    {
      $set: {
        currentBid: bidAmount,
        currentBidderId: bidderId,
        currentBidderName: bidderName,
        updatedAt: now,
      },
      $inc: { bidCount: 1 },
      $push: { bids: newBid as any },
    },
    { returnDocument: 'before' }
  );

  return result as unknown as MarketplaceListing | null;
}

/**
 * Resolve an auction — mark as sold to highest bidder.
 * Returns the listing (before update) if resolved, null if not found.
 */
export async function resolveAuction(
  listingId: string,
  sellerId?: string
): Promise<MarketplaceListing | null> {
  const collection = await getCollection();
  const now = new Date();

  const query: Record<string, any> = {
    listingId,
    type: 'auction',
    status: 'active',
    bidCount: { $gte: 1 },
  };
  if (sellerId) {
    query.sellerId = sellerId;
  }

  const result = await collection.findOneAndUpdate(
    query,
    {
      $set: {
        status: 'sold',
        soldAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'before' }
  );

  if (result) {
    // Set buyerId/buyerName from the highest bidder
    await collection.updateOne(
      { listingId, status: 'sold' },
      {
        $set: {
          buyerId: (result as any).currentBidderId,
          buyerName: (result as any).currentBidderName,
          price: (result as any).currentBid,
        },
      }
    );
  }

  return result as unknown as MarketplaceListing | null;
}

/**
 * Get expired auctions that need resolution (have bids but are past expiresAt).
 */
export async function getExpiredAuctions(): Promise<MarketplaceListing[]> {
  const collection = await getCollection();
  const listings = await collection
    .find({
      type: 'auction',
      status: 'active',
      expiresAt: { $lte: new Date() },
    })
    .toArray();
  return listings as unknown as MarketplaceListing[];
}

/**
 * Cancel an auction — only if no bids have been placed.
 */
export async function cancelAuction(
  listingId: string,
  sellerId: string
): Promise<MarketplaceListing | null> {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    {
      listingId,
      sellerId,
      type: 'auction',
      status: 'active',
      $or: [{ bidCount: 0 }, { bidCount: { $exists: false } }],
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  return result as unknown as MarketplaceListing | null;
}

// ─── Notification Operations ───────────────────────────────────────

function getNotificationCollection() {
  return getDb().then((db) => db.collection('user_notifications'));
}

/**
 * Create a notification for a user.
 */
export async function createNotification(
  notification: Omit<UserNotification, '_id'>
): Promise<void> {
  const collection = await getNotificationCollection();
  await collection.insertOne(notification as any);
}

/**
 * Get unread notifications for a user.
 */
export async function getUserNotifications(
  userId: string,
  limit = 20
): Promise<UserNotification[]> {
  const collection = await getNotificationCollection();
  const docs = await collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs as unknown as UserNotification[];
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const collection = await getNotificationCollection();
  return collection.countDocuments({ userId, read: false });
}

/**
 * Mark notifications as read.
 */
export async function markNotificationsRead(
  userId: string,
  notificationIds?: string[]
): Promise<void> {
  const collection = await getNotificationCollection();
  const query: Record<string, any> = { userId };
  if (notificationIds && notificationIds.length > 0) {
    const { ObjectId } = await import('mongodb');
    const validIds = notificationIds.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
    if (validIds.length === 0) return;
    query._id = { $in: validIds.map((id) => new ObjectId(id)) };
  }
  await collection.updateMany(query, { $set: { read: true } });
}

/**
 * Generate a notification ID.
 */
export function generateNotificationId(userId: string): string {
  return `notif_${Date.now()}_${userId}`;
}

export { LISTINGS_PER_PAGE };
