import clientPromise from '@/lib/mongodb';
import type { TransactionRecord } from '@/types/bazaar';

function getDb() {
  return clientPromise.then((client) => client.db('Database'));
}

/**
 * Fire-and-forget: increment money_earned + total_earned in profiles collection.
 * Matches bot behavior: profilesManager.addMoneyEarned(userId, amount)
 */
async function trackProfileEarnings(discordId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  try {
    const db = await getDb();
    const collection = db.collection('profiles');
    try {
      await collection.updateOne(
        { _id: discordId as any },
        { $inc: { 'data.money_earned': amount, 'data.total_earned': amount } },
        { upsert: true }
      );
    } catch (err: any) {
      // Fallback for string data — read, parse, increment, write back
      if (err?.code !== 14) return;
      const doc = await collection.findOne({ _id: discordId as any });
      const parsed = doc?.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : {};
      parsed.money_earned = (parsed.money_earned ?? 0) + amount;
      parsed.total_earned = (parsed.total_earned ?? 0) + amount;
      await collection.updateOne(
        { _id: discordId as any },
        { $set: { data: parsed } },
        { upsert: true }
      );
    }
  } catch {
    // Fire-and-forget — never block the main operation
  }
}

/**
 * Fire-and-forget: increment money_spent + total_spent in profiles collection.
 * Matches bot behavior: profilesManager.addMoneySpent(userId, amount)
 */
async function trackProfileSpending(discordId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  try {
    const db = await getDb();
    const collection = db.collection('profiles');
    try {
      await collection.updateOne(
        { _id: discordId as any },
        { $inc: { 'data.money_spent': amount, 'data.total_spent': amount } },
        { upsert: true }
      );
    } catch (err: any) {
      if (err?.code !== 14) return;
      const doc = await collection.findOne({ _id: discordId as any });
      const parsed = doc?.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : {};
      parsed.money_spent = (parsed.money_spent ?? 0) + amount;
      parsed.total_spent = (parsed.total_spent ?? 0) + amount;
      await collection.updateOne(
        { _id: discordId as any },
        { $set: { data: parsed } },
        { upsert: true }
      );
    }
  } catch {
    // Fire-and-forget — never block the main operation
  }
}

/**
 * Atomic check-and-deduct Lunari.
 * Uses findOneAndUpdate with $gte guard — only deducts if balance >= amount.
 * Falls back to optimistic concurrency if data is stored as string (legacy).
 */
export async function deductLunari(
  discordId: string,
  amount: number
): Promise<{ success: boolean; balanceBefore: number; balanceAfter: number }> {
  const db = await getDb();
  const collection = db.collection('points');

  // Try atomic numeric deduction first
  try {
    const result = await collection.findOneAndUpdate(
      { _id: discordId as any, data: { $type: 'number', $gte: amount } },
      { $inc: { data: -amount } },
      { returnDocument: 'after' }
    );

    if (result) {
      const balanceAfter = typeof result.data === 'number' ? result.data : parseInt(result.data, 10) || 0;
      console.log(`[deductLunari] atomic success: ${discordId} deducted ${amount}, before=${balanceAfter + amount}, after=${balanceAfter}`);
      void trackProfileSpending(discordId, amount);
      return { success: true, balanceBefore: balanceAfter + amount, balanceAfter };
    }
  } catch (err: any) {
    // $inc on non-numeric data throws TypeMismatch (code 14) — fall through to string fallback
    if (err?.code !== 14) throw err;
    console.log(`[deductLunari] atomic path TypeMismatch for ${discordId}, falling back to string path`);
  }

  // Fallback: data might be stored as string (legacy st.db) or user doesn't exist
  for (let retry = 0; retry < 3; retry++) {
    const doc = await collection.findOne({ _id: discordId as any });
    if (!doc) {
      return { success: false, balanceBefore: 0, balanceAfter: 0 };
    }

    const rawData = doc.data;
    const balance = typeof rawData === 'string' ? parseInt(rawData, 10) : (typeof rawData === 'number' ? rawData : 0);

    if (isNaN(balance) || balance < amount) {
      return { success: false, balanceBefore: balance || 0, balanceAfter: balance || 0 };
    }

    // Optimistic concurrency: exact match on old value
    const updateResult = await collection.updateOne(
      { _id: discordId as any, data: rawData },
      { $set: { data: balance - amount } }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(`[deductLunari] fallback success: ${discordId} deducted ${amount}, before=${balance}, after=${balance - amount}`);
      void trackProfileSpending(discordId, amount);
      return { success: true, balanceBefore: balance, balanceAfter: balance - amount };
    }

    // Data changed since our read — small jittered delay before retry
    if (retry < 2) {
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }

  console.log(`[deductLunari] all retries exhausted for ${discordId}, amount=${amount}`);
  return { success: false, balanceBefore: 0, balanceAfter: 0 };
}

/**
 * Credit Lunari — used by Stripe webhook and refunds.
 * Atomic $inc with upsert. Falls back to read-convert-set for string data.
 */
export async function creditLunari(
  discordId: string,
  amount: number
): Promise<{ balanceAfter: number }> {
  const db = await getDb();
  const collection = db.collection('points');

  try {
    const result = await collection.findOneAndUpdate(
      { _id: discordId as any },
      { $inc: { data: amount } },
      { upsert: true, returnDocument: 'after' }
    );
    const balanceAfter = result ? (typeof result.data === 'number' ? result.data : parseInt(result.data, 10) || 0) : amount;
    void trackProfileEarnings(discordId, amount);
    return { balanceAfter };
  } catch (err: any) {
    if (err?.code !== 14) throw err;
  }

  // Fallback for string data — with optimistic concurrency
  for (let retry = 0; retry < 3; retry++) {
    const doc = await collection.findOne({ _id: discordId as any });
    const rawData = doc?.data;
    const current = rawData ? (typeof rawData === 'string' ? parseInt(rawData, 10) : rawData) || 0 : 0;
    const newBalance = current + amount;

    const result = doc
      ? await collection.updateOne({ _id: discordId as any, data: rawData }, { $set: { data: newBalance } })
      : await collection.updateOne({ _id: discordId as any }, { $setOnInsert: { data: newBalance } }, { upsert: true });

    if (result.modifiedCount > 0 || result.upsertedCount > 0) {
      void trackProfileEarnings(discordId, amount);
      return { balanceAfter: newBalance };
    }
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  }
  throw new Error('Failed to credit Lunari after retries');
}

/**
 * Get user's current Lunari balance.
 */
export async function getBalance(discordId: string): Promise<number> {
  const db = await getDb();
  const doc = await db.collection('points').findOne({ _id: discordId as any });
  if (!doc?.data) return 0;
  return typeof doc.data === 'number' ? doc.data : parseInt(doc.data, 10) || 0;
}

/**
 * Add to bank reserve — called on every purchase.
 * Handles legacy string data by converting to number before incrementing.
 */
export async function addToBankReserve(amount: number): Promise<void> {
  const db = await getDb();
  const collection = db.collection('system');

  // Try atomic $inc first
  try {
    await collection.findOneAndUpdate(
      { _id: 'luna_bank_reserve' as any },
      { $inc: { data: amount } },
      { upsert: true }
    );
    return;
  } catch (err: any) {
    // If data is a string (legacy st.db), fall back to read-convert-set
    if (err?.code !== 14) throw err;
  }

  // Fallback: read, parse, set as number
  const doc = await collection.findOne({ _id: 'luna_bank_reserve' as any });
  const current = doc?.data ? (typeof doc.data === 'string' ? parseInt(doc.data, 10) : doc.data) || 0 : 0;
  await collection.updateOne(
    { _id: 'luna_bank_reserve' as any },
    { $set: { data: current + amount } },
    { upsert: true }
  );
}

/**
 * Check if user has outstanding debt — blocks purchases.
 */
export async function checkDebt(discordId: string): Promise<boolean> {
  const db = await getDb();
  const debtDoc = await db.collection('system').findOne({ _id: `debt_${discordId}` as any });
  const debt = debtDoc?.data || 0;
  return typeof debt === 'number' ? debt > 0 : parseInt(debt, 10) > 0;
}

/**
 * Log a transaction to lunari_transactions.
 */
export async function logTransaction(record: Omit<TransactionRecord, '_id'>): Promise<void> {
  const db = await getDb();
  await db.collection('lunari_transactions').insertOne(record);
}

/**
 * Check if a Stripe session was already processed (idempotency).
 */
export async function isStripeSessionProcessed(sessionId: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.collection('lunari_transactions').findOne({
    'metadata.stripeSessionId': sessionId,
  });
  return !!existing;
}

/**
 * Daily spending limit in Lunari (across all bazaar purchases).
 * Prevents users from draining their entire balance in a single session.
 */
export const DAILY_SPEND_LIMIT = 50_000;

/**
 * Get total Lunari spent today (UTC) by a user across all web bazaar purchases.
 * Only counts debit transactions (negative amounts) from the web source.
 */
export async function getDailySpending(discordId: string): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const result = await db.collection('lunari_transactions').aggregate([
    {
      $match: {
        discordId,
        source: 'web',
        amount: { $lt: 0 },
        createdAt: { $gte: startOfDay },
      },
    },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: { $abs: '$amount' } },
      },
    },
  ]).toArray();

  return result.length > 0 ? result[0].totalSpent : 0;
}
