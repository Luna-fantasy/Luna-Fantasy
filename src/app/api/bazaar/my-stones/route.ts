import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserStones } from '@/lib/bazaar/stone-ops';
import { STONES, getStoneSellPrice } from '@/lib/bazaar/stone-config';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';

export interface DuplicateStone {
  name: string;
  imageUrl: string;
  count: number;
  sellPrice: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit('my_stones', session.user.discordId, RATE_LIMITS.my_stones.maxRequests, RATE_LIMITS.my_stones.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { stones } = await getUserStones(session.user.discordId);

    // Group by name and count
    const grouped = new Map<string, number>();
    for (const s of stones) {
      grouped.set(s.name, (grouped.get(s.name) || 0) + 1);
    }

    // Build image lookup from config
    const imageMap = new Map(STONES.map((s) => [s.name, s.imageUrl]));

    // Filter to duplicates (count > 1) with sell_price > 0
    const duplicates: DuplicateStone[] = [];
    for (const [name, count] of Array.from(grouped)) {
      if (count > 1) {
        const sellPrice = getStoneSellPrice(name);
        if (sellPrice > 0) {
          duplicates.push({
            name,
            imageUrl: imageMap.get(name) || '',
            count,
            sellPrice,
          });
        }
      }
    }

    return NextResponse.json({ duplicates });
  } catch (err) {
    console.error('My stones API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
