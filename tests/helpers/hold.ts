import type { MongoClient } from 'mongodb';

// Holds an uncommitted write on one document from another session. Any transaction that writes
// the same document meanwhile gets a write conflict and has to retry, which is what exposes a
// write that forgot to join its transaction (it would be applied again on every retry).
// Returns an object rather than the release promise itself: awaiting an async function that
// returns a promise would wait for the release too, and nothing would ever run against the hold.
export async function holdDocument(client: MongoClient, collection: string, id: string, ms: number): Promise<{ released: Promise<void> }> {
  const session = client.startSession();
  session.startTransaction();
  await client.db('Database').collection<any>(collection).updateOne({ _id: id }, { $inc: { __hold: 1 } }, { session, upsert: true });
  const released = (async () => {
    await new Promise((r) => setTimeout(r, ms));
    await session.abortTransaction();
    await session.endSession();
  })();
  return { released };
}
