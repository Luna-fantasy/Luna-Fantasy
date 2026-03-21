import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getExpiredAuctions, createNotification, generateNotificationId } from '@/lib/bazaar/marketplace-ops';
import { addCardToUser } from '@/lib/bazaar/card-ops';
import { processAuctionResolution } from '../resolve/route';
import clientPromise from '@/lib/mongodb';

/**
 * POST /api/marketplace/auction/auto-resolve
 * Cron endpoint — resolves expired auctions.
 * Protected by secret header. Run every 5 minutes.
 */
export async function POST(request: Request) {
  // Verify cron secret (timing-safe comparison)
  const cronSecret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (!expected || !cronSecret ||
      Buffer.byteLength(cronSecret) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expiredAuctions = await getExpiredAuctions();

  if (expiredAuctions.length === 0) {
    return NextResponse.json({ resolved: 0, cancelled: 0 });
  }

  let resolved = 0;
  let cancelled = 0;

  for (const auction of expiredAuctions) {
    try {
      if (auction.bidCount && auction.bidCount > 0 && auction.currentBidderId) {
        // Has bids — resolve to highest bidder
        const result = await processAuctionResolution(auction);
        const data = await result.json();
        if (data.success) {
          resolved++;
        } else {
          cancelled++;
        }
      } else {
        // No bids — cancel and return card to seller
        const client = await clientPromise;
        const db = client.db('Database');

        await db.collection('card_marketplace').updateOne(
          { listingId: auction.listingId, status: 'active' },
          {
            $set: {
              status: 'expired',
              updatedAt: new Date(),
            },
          }
        );

        try {
          await addCardToUser(
            auction.sellerId,
            {
              name: auction.card.name,
              rarity: auction.card.rarity,
              attack: auction.card.attack,
              imageUrl: auction.card.imageUrl,
              weight: auction.card.weight,
            },
            auction.card.source || 'Auction Expired'
          );

          await db.collection('card_marketplace').updateOne(
            { listingId: auction.listingId },
            { $set: { cardReturned: true } }
          );
        } catch (err) {
          console.error(`[auto-resolve] Failed to return card for ${auction.listingId}:`, err);
        }

        // Notify seller
        await createNotification({
          notificationId: generateNotificationId(auction.sellerId),
          userId: auction.sellerId,
          type: 'auction_expired',
          data: {
            listingId: auction.listingId,
            cardName: auction.card.name,
          },
          read: false,
          createdAt: new Date(),
        });

        cancelled++;
      }
    } catch (error) {
      console.error(`[auto-resolve] Error processing auction ${auction.listingId}:`, error);
    }
  }

  return NextResponse.json({ resolved, cancelled, total: expiredAuctions.length });
}
