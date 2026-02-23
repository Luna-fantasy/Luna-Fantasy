import clientPromise from '@/lib/mongodb';

/**
 * Get user's current ticket count.
 */
export async function getUserTickets(discordId: string): Promise<number> {
  const client = await clientPromise;
  const db = client.db('Database');
  const doc = await db.collection('tickets').findOne({ _id: discordId as any });
  if (!doc?.data) return 0;
  return typeof doc.data === 'number' ? doc.data : parseInt(doc.data, 10) || 0;
}

/**
 * Add tickets to user — atomic $inc with string-data fallback.
 */
export async function addTickets(discordId: string, count: number): Promise<number> {
  const client = await clientPromise;
  const db = client.db('Database');
  const collection = db.collection('tickets');

  try {
    const result = await collection.findOneAndUpdate(
      { _id: discordId as any },
      { $inc: { data: count } },
      { upsert: true, returnDocument: 'after' }
    );
    return result ? (typeof result.data === 'number' ? result.data : parseInt(result.data, 10) || 0) : count;
  } catch (err: any) {
    if (err?.code !== 14) throw err;
  }

  // Fallback for string data (legacy st.db)
  const doc = await collection.findOne({ _id: discordId as any });
  const current = doc?.data ? (typeof doc.data === 'string' ? parseInt(doc.data, 10) : doc.data) || 0 : 0;
  const newTotal = current + count;
  await collection.updateOne(
    { _id: discordId as any },
    { $set: { data: newTotal } },
    { upsert: true }
  );
  return newTotal;
}
