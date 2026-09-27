/**
 * Bank deposit money movements, each in one MongoDB transaction.
 *
 * Butler pays deposits from the same `bank` documents, so a withdrawal must claim the deposit
 * and credit the player in the same transaction, and must clear the record completely: an
 * inactive record that still carries an amount gets paid again by older Butler builds.
 * A top-up must never write back a deposit that was paid out in the meantime.
 */

import type { ClientSession, MongoClient } from 'mongodb';
import type { InvestmentRecord } from '@/types/bank';

export interface InvestmentTerms {
  maturityMs: number;
  profitRate: number;
  earlyFee: number;
  depositLockMs: number;
}

export interface WithdrawResult {
  investment: InvestmentRecord;
  payout: number;
  profit: number;
  early: boolean;
  balanceAfter: number;
}

// The website stores startDate as an ISO string, Butler as epoch ms
export function investmentStartMs(startDate: unknown): number | null {
  const ms = typeof startDate === 'number' ? startDate : typeof startDate === 'string' ? Date.parse(startDate) : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function collections(client: MongoClient) {
  const db = client.db('Database');
  return { bank: db.collection<any>('bank'), points: db.collection<any>('points'), system: db.collection<any>('system') };
}

async function inTransaction<T>(client: MongoClient, fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = client.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return result;
  } finally {
    await session.endSession();
  }
}

/** Claims the active deposit and pays it out. Returns null when there is no active deposit. */
export async function withdrawInvestmentTx(
  client: MongoClient,
  userId: string,
  terms: InvestmentTerms,
  now: number = Date.now()
): Promise<WithdrawResult | null> {
  const { bank, points } = collections(client);
  return inTransaction(client, async (session) => {
    const before = await bank.findOneAndUpdate(
      { _id: userId, 'investment.active': true, 'investment.amount': { $gt: 0 } },
      { $set: { investment: null, updatedAt: new Date() } },
      { session, returnDocument: 'before' }
    );
    if (!before) return null;

    const investment = before.investment as InvestmentRecord;
    const start = investmentStartMs(investment.startDate);
    const early = start === null || now - start < terms.maturityMs;
    const payout = early
      ? Math.max(0, investment.amount - terms.earlyFee)
      : Math.floor(investment.amount * (1 + terms.profitRate));

    const credited = await points.findOneAndUpdate(
      { _id: userId },
      { $inc: { balance: payout } },
      { session, upsert: true, returnDocument: 'after' }
    );
    return {
      investment,
      payout,
      profit: payout - investment.amount,
      early,
      balanceAfter: typeof credited?.balance === 'number' ? credited.balance : payout,
    };
  });
}

/**
 * Takes `amount` from the player and opens a deposit, or adds to the running one while its
 * top-up window is open. Throws with a player-facing message when refused; nothing changes then.
 */
export async function depositInvestmentTx(
  client: MongoClient,
  userId: string,
  amount: number,
  terms: InvestmentTerms,
  now: number = Date.now()
): Promise<{ investment: InvestmentRecord; balanceAfter: number }> {
  const { bank, points, system } = collections(client);
  const nowIso = new Date(now).toISOString();
  return inTransaction(client, async (session) => {
    const doc = await bank.findOne({ _id: userId }, { session });
    const existing: InvestmentRecord | null = doc?.investment?.active ? doc.investment : null;

    if (existing) {
      const start = investmentStartMs(existing.startDate);
      if (start === null || now - start > terms.depositLockMs) {
        throw new Error('Deposit window has closed (7 days after initial deposit)');
      }
    }

    const debited = await points.findOneAndUpdate(
      { _id: userId, balance: { $type: 'number', $gte: amount } },
      { $inc: { balance: -amount } },
      { session, returnDocument: 'after' }
    );
    if (!debited) throw new Error('Insufficient balance');

    let investment: InvestmentRecord;
    if (existing) {
      // $inc on the same deposit (matched by its start date), never a rewrite of the whole record
      const res = await bank.updateOne(
        { _id: userId, 'investment.active': true, 'investment.startDate': existing.startDate },
        { $inc: { 'investment.amount': amount }, $set: { 'investment.lastDepositDate': nowIso, updatedAt: new Date() } },
        { session }
      );
      if (res.matchedCount !== 1) throw new Error('Your deposit changed while this was processing; please try again');
      investment = { ...existing, amount: existing.amount + amount, lastDepositDate: nowIso };
    } else {
      investment = { amount, startDate: nowIso, lastDepositDate: nowIso, depositLocked: false, active: true };
      await bank.updateOne(
        { _id: userId, 'investment.active': { $ne: true } },
        { $set: { investment, updatedAt: new Date() } },
        { session, upsert: true }
      );
    }

    await system.updateOne({ _id: 'luna_bank_reserve' }, { $inc: { value: amount } }, { session, upsert: true });
    return { investment, balanceAfter: debited.balance as number };
  });
}
