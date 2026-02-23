import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('Database');

    const transactions = await db
      .collection('lunari_transactions')
      .find({ discordId: session.user.discordId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        id: t._id.toString(),
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        metadata: t.metadata,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    console.error('Transactions API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
