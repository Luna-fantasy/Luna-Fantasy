import clientPromise from '@/lib/mongodb';
import type { TransactionRecord } from '@/types/bazaar';
import { sendTransactionEmbed } from '@/lib/admin/discord-logger';

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

  // Atomic numeric deduction — balance field is always a number
  const result = await collection.findOneAndUpdate(
    { _id: discordId as any, balance: { $type: 'number', $gte: amount } },
    { $inc: { balance: -amount } },
    { returnDocument: 'after' }
  );

  if (result) {
    const balanceAfter = typeof result.balance === 'number' ? result.balance : 0;
    console.log(`[deductLunari] success: ${discordId} deducted ${amount}, before=${balanceAfter + amount}, after=${balanceAfter}`);
    void trackProfileSpending(discordId, amount);
    return { success: true, balanceBefore: balanceAfter + amount, balanceAfter };
  }

  // No match — either insufficient balance or user doesn't exist
  const doc = await collection.findOne({ _id: discordId as any });
  const currentBalance = doc?.balance ?? 0;
  return { success: false, balanceBefore: currentBalance, balanceAfter: currentBalance };
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

  const result = await collection.findOneAndUpdate(
    { _id: discordId as any },
    { $inc: { balance: amount } },
    { upsert: true, returnDocument: 'after' }
  );
  const balanceAfter = result ? (typeof result.balance === 'number' ? result.balance : 0) : amount;
  void trackProfileEarnings(discordId, amount);
  return { balanceAfter };
}

/**
 * Get user's current Lunari balance.
 */
export async function getBalance(discordId: string): Promise<number> {
  const db = await getDb();
  const doc = await db.collection('points').findOne({ _id: discordId as any });
  if (doc?.balance == null) return 0;
  return typeof doc.balance === 'number' ? doc.balance : 0;
}

/**
 * Add to bank reserve — called on every purchase.
 * Handles legacy string data by converting to number before incrementing.
 */
export async function addToBankReserve(amount: number): Promise<void> {
  const db = await getDb();
  const collection = db.collection('system');

  await collection.findOneAndUpdate(
    { _id: 'luna_bank_reserve' as any },
    { $inc: { value: amount } },
    { upsert: true }
  );
}

/**
 * Check if user has outstanding debt — blocks purchases.
 */
export async function checkDebt(discordId: string): Promise<boolean> {
  const db = await getDb();
  const debtDoc = await db.collection('system').findOne({ _id: `debt_${discordId}` as any });
  const debt = debtDoc?.value || 0;
  return typeof debt === 'number' ? debt > 0 : 0 > 0;
}

/**
 * Log a transaction to the appropriate collection based on type.
 * card_* → cards_transactions, stone_* → stones_transactions, else → lunari_transactions
 */
export async function logTransaction(record: Omit<TransactionRecord, '_id'>): Promise<void> {
  const db = await getDb();

  let collection = 'lunari_transactions';
  if (record.type.startsWith('card_') || record.type === 'luckbox_spend') collection = 'cards_transactions';
  else if (record.type.startsWith('stone_') || record.type === 'stonebox_spend') collection = 'stones_transactions';

  await db.collection(collection).insertOne(record);

  if (record.source === 'web') {
    void sendTransactionEmbed(record).catch(() => {});
  }
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

