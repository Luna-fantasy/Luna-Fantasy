import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const client = await clientPromise;
  const docs = await client
    .db('Database')
    .collection('characters')
    .find({})
    .project({ _id: 0, id: 1, name: 1, lore: 1, faction: 1, imageUrl: 1, isMainCharacter: 1, cardId: 1 })
    .limit(500)
    .toArray();

  return NextResponse.json({ characters: docs });
}
