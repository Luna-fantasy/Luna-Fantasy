import clientPromise from '@/lib/mongodb';

/**
 * Build a source → sink flow summary of Lunari transactions over a window.
 * Classifies each transaction type into a semantic "source" (where money came from)
 * or "sink" (where it went), bucketing the unknown into "other".
 */

export interface FlowBucket {
  label: string;
  amount: number;
}

export interface EconomyFlows {
  sources: FlowBucket[]; // inflows into player pockets
  sinks: FlowBucket[];   // outflows from player pockets
  window: { from: string; to: string };
}

// Real transaction types (verified against live lunari_transactions, 2026-04-14).
const SOURCE_MAP: Record<string, string> = {
  lunari_added: 'Admin credits',
  bank_daily: 'Daily rewards',
  bank_loan_taken: 'Loans',
  challenge_reward: 'Challenges',
  trade_win: 'Trades',
  reserve_withdrawal: 'Bank reserve',
};

const SINK_MAP: Record<string, string> = {
  lunari_spent: 'Admin debits',
  luckbox_spend: 'Cards',
  stonebox_spend: 'Stones',
  trade_loss: 'Trades',
  bank_loan_repaid: 'Loan repayment',
  bank_loan_partial_repaid: 'Loan repayment',
  mells_purchase: 'Shops',
  brimor_purchase: 'Shops',
  ticket_spend: 'Tickets',
  bank_investment_deposit: 'Investments',
};

function classify(type: string, amount: number): { kind: 'source' | 'sink' | 'other'; label: string } {
  const t = (type || '').toLowerCase();
  if (SOURCE_MAP[t]) return { kind: 'source', label: SOURCE_MAP[t] };
  if (SINK_MAP[t]) return { kind: 'sink', label: SINK_MAP[t] };
  // Fallback: positive amount → source, negative → sink
  if (amount > 0) return { kind: 'source', label: 'Other earnings' };
  if (amount < 0) return { kind: 'sink', label: 'Other spend' };
  return { kind: 'other', label: 'Other' };
}

export async function getEconomyFlows(windowMs = 30 * 24 * 3600 * 1000): Promise<EconomyFlows> {
  const client = await clientPromise;
  const db = client.db('Database');
  const from = new Date(Date.now() - windowMs);
  const to = new Date();

  // Transactions collection uses `createdAt` (not `timestamp`)
  const rows = await db.collection('lunari_transactions')
    .find({ createdAt: { $gte: from, $lte: to } })
    .project({ type: 1, amount: 1 })
    .limit(100_000)
    .toArray();

  const sources = new Map<string, number>();
  const sinks = new Map<string, number>();

  for (const row of rows) {
    const type = String(row.type ?? '');
    const amt = Number(row.amount ?? 0);
    if (!Number.isFinite(amt) || amt === 0) continue;
    const { kind, label } = classify(type, amt);
    const abs = Math.abs(amt);
    if (kind === 'source') sources.set(label, (sources.get(label) ?? 0) + abs);
    else if (kind === 'sink') sinks.set(label, (sinks.get(label) ?? 0) + abs);
  }

  return {
    sources: Array.from(sources).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount),
    sinks: Array.from(sinks).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount),
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}
