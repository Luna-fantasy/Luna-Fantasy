import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
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
