import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit('partners_browse', ip, RATE_LIMITS.partners_browse.maxRequests, RATE_LIMITS.partners_browse.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const docs = await db.collection('partners').find({}).sort({ order: 1 }).toArray();

    const partners = docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      description: doc.description,
      logo: doc.logo,
      website: doc.website,
      socials: doc.socials || {},
      order: doc.order ?? 0,
    }));

    return NextResponse.json(partners);
  } catch (err) {
    console.error('Partners API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
