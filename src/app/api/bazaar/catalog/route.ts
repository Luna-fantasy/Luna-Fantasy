import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLuckboxShopConfig, boxToLegacyTier, getStoneBoxConfig, getTicketShopConfig } from '@/lib/bazaar/shop-config';
import { LUNARI_PACKAGES } from '@/lib/stripe';
import { getBalance, checkDebt } from '@/lib/bazaar/lunari-ops';
import { getUserTickets } from '@/lib/bazaar/ticket-ops';
import { setCsrfCookie } from '@/lib/bazaar/csrf';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('Database');

    // Get luckbox config from DB (falls back to hardcoded)
    const boxes = await getLuckboxShopConfig();

    // Collect all unique rarities across all boxes
    const allRarities = new Set<string>();
    for (const box of boxes) {
      for (const r of box.rarities) {
        allRarities.add(r.rarity);
      }
    }

    // Get card counts per rarity from catalog
    const rarityCounts = await Promise.all(
      Array.from(allRarities).map(async (rarity) => {
        const doc = await db.collection('cards_config').findOne({ _id: rarity.toUpperCase() as any });
        let count = 0;
        if (doc?.items) {
          count = Array.isArray(doc.items) ? doc.items.length : 0;
        }
        return { rarity, count };
      })
    );

    const luckboxTiers = boxes.map((box) => {
      const legacy = boxToLegacyTier(box);
      // Sum card counts across all rarities in this box
      const cardCount = box.rarities.reduce((sum, r) => {
        return sum + (rarityCounts.find((rc) => rc.rarity === r.rarity)?.count ?? 0);
      }, 0);
      return { ...legacy, cardCount, rarities: box.rarities };
    });

    // Stone config from DB (falls back to hardcoded)
    const stoneConfig = await getStoneBoxConfig();
    const totalWeight = stoneConfig.stones.filter((s) => s.weight > 0)
      .reduce((sum, s) => sum + Math.max(1, Math.round(s.weight * 1000)), 0);

    const stoneBox = {
      price: stoneConfig.price,
      stones: stoneConfig.stones.map((s) => {
        if (s.weight === 0) return { name: s.name, weight: s.weight, dropPercent: 0 };
        const entries = Math.max(1, Math.round(s.weight * 1000));
        return {
          name: s.name,
          weight: s.weight,
          dropPercent: Math.round((entries / totalWeight) * 10000) / 100,
        };
      }),
    };

    // Ticket packages from DB (falls back to hardcoded)
    const ticketPackages = await getTicketShopConfig();

    // Optional auth for user data
    let user: { balance: number; tickets: number; hasDebt: boolean } | undefined;
    try {
      const session = await auth();
      if (session?.user?.discordId) {
        const discordId = session.user.discordId;
        const [balance, tickets, hasDebt] = await Promise.all([
          getBalance(discordId),
          getUserTickets(discordId),
          checkDebt(discordId),
        ]);
        user = { balance, tickets, hasDebt };
      }
    } catch {
      // Auth optional, ignore errors
    }

    // Lunari packages (strip sensitive data)
    const lunariPackages = LUNARI_PACKAGES.map(({ id, name, lunari, usd }) => ({
      id,
      name,
      lunari,
      usd,
      stripePriceId: '', // Don't expose to client
    }));

    const response = NextResponse.json({
      luckboxTiers,
      stoneBox,
      ticketPackages,
      lunariPackages,
      user,
    });

    // Issue CSRF token cookie for subsequent POST requests
    await setCsrfCookie(response);

    return response;
  } catch (err) {
    console.error('Catalog API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
