import { NextResponse } from 'next/server';
import { getUserCards } from '@/lib/bazaar/card-ops';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

/**
 * GET /api/users/[discordId]/cards
 * Public card collection view for swap proposals.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ discordId: string }> }
) {
  const ip = getClientIp(_request);
  const rl = checkRateLimit('public_cards', ip, RATE_LIMITS.public_cards.maxRequests, RATE_LIMITS.public_cards.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const { discordId } = await params;

  if (!discordId || typeof discordId !== 'string') {
    return NextResponse.json({ error: 'Discord ID is required' }, { status: 400 });
  }

  // Get user info
  const client = await clientPromise;
  const db = client.db('Database');
  const user = await db.collection('users').findOne({ discordId });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get their cards
  const cards = await getUserCards(discordId);

  return NextResponse.json({
    discordId,
    username: user.globalName || user.username || 'Unknown',
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      rarity: c.rarity,
      attack: c.attack,
      weight: c.weight,
      imageUrl: c.imageUrl,
      source: c.source,
    })),
  });
}
