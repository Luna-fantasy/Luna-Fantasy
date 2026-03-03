import clientPromise from '@/lib/mongodb';

/**
 * Get user's current ticket count.
 */
export async function getUserTickets(discordId: string): Promise<number> {
  const client = await clientPromise;
  const db = client.db('Database');
  const doc = await db.collection('tickets').findOne({ _id: discordId as any });
  if (doc?.balance == null) return 0;
  return typeof doc.balance === 'number' ? doc.balance : 0;
}

/**
 * Add tickets to user — atomic $inc.
 */
export async function addTickets(discordId: string, count: number): Promise<number> {
  const client = await clientPromise;
  const db = client.db('Database');
  const collection = db.collection('tickets');

  const result = await collection.findOneAndUpdate(
    { _id: discordId as any },
    { $inc: { balance: count } },
    { upsert: true, returnDocument: 'after' }
  );
  return result ? (typeof result.balance === 'number' ? result.balance : 0) : count;
}
