import type { Collection } from 'mongodb';

/** Counts ledger entries by UTC hour of day over the previous 24 hours. */
export async function getHourlyTransactions(collection: Collection, now = new Date()): Promise<number[]> {
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const window = { $gte: start, $lte: now };
  const rows = await collection.aggregate<{ _id: number; count: number }>([
    // Current entries use BSON dates. Older writers used ISO strings, epoch milliseconds or timestamp.
    { $match: { $or: [
      { createdAt: window },
      { createdAt: { $type: 'string' } },
      { createdAt: { $gte: start.getTime(), $lte: now.getTime() } },
      { createdAt: null, timestamp: { $exists: true } },
    ] } },
    { $project: { at: { $convert: { input: { $ifNull: ['$createdAt', '$timestamp'] }, to: 'date', onError: null, onNull: null } } } },
    { $match: { at: window } },
    { $group: { _id: { $hour: '$at' }, count: { $sum: 1 } } },
  ]).toArray();
  const bins = Array<number>(24).fill(0);
  for (const row of rows) bins[row._id] = row.count;
  return bins;
}
