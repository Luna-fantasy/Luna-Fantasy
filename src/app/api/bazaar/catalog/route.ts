import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { LUCKBOX_TIERS } from '@/lib/bazaar/luckbox-config';
import { getStoneDropRates, STONE_BOX_PRICE, TICKET_PACKAGES } from '@/lib/bazaar/stone-config';
import { LUNARI_PACKAGES } from '@/lib/stripe';
import { getBalance, checkDebt } from '@/lib/bazaar/lunari-ops';
import { getUserTickets } from '@/lib/bazaar/ticket-ops';
import { setCsrfCookie } from '@/lib/bazaar/csrf';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('Database');

    // Get card counts per rarity from catalog
    const rarities = LUCKBOX_TIERS.map((t) => t.rarity);
    const rarityCounts = await Promise.all(
      rarities.map(async (rarity) => {
        const doc = await db.collection('cards_config').findOne({ _id: rarity.toUpperCase() as any });
        let count = 0;
        if (doc?.data) {
          const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
          count = Array.isArray(parsed) ? parsed.length : 0;
        }
        return { rarity, count };
      })
    );

    const luckboxTiers = LUCKBOX_TIERS.map((t) => ({
      ...t,
      cardCount: rarityCounts.find((r) => r.rarity === t.rarity)?.count ?? 0,
    }));

    // Stone drop rates
    const stoneBox = {
      price: STONE_BOX_PRICE,
      stones: getStoneDropRates(),
    };

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
      ticketPackages: TICKET_PACKAGES,
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
