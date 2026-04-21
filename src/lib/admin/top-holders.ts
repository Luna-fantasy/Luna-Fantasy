import clientPromise from '@/lib/mongodb';

export interface TopHolder {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  balance: number;
  sparkline: number[]; // 14-day balance trajectory
  sharePct: number;    // % of total circulation
}

export async function getTopHolders(n = 25): Promise<TopHolder[]> {
  const client = await clientPromise;
  const db = client.db('Database');

  const top = await db.collection('points')
    .find({ balance: { $gt: 0 } })
    .sort({ balance: -1 })
    .limit(Math.min(100, Math.max(1, n)))
    .project({ _id: 1, balance: 1 })
    .toArray();

  const ids = top.map((r: any) => String(r._id));
  if (ids.length === 0) return [];

  // Sum of ALL balances for share %
  const sumAgg = await db.collection('points').aggregate([
    { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$balance', 0] } } } } },
  ]).toArray();
  const totalCirculation = Number((sumAgg[0] as any)?.total ?? 0);

  const [discord, recentTx] = await Promise.all([
    db.collection('discord_users').find({ _id: { $in: ids } as any })
      .project({ _id: 1, username: 1, globalName: 1, avatar: 1 }).toArray(),
    db.collection('lunari_transactions')
      .find({ discordId: { $in: ids }, createdAt: { $gte: new Date(Date.now() - 14 * 86400_000) } })
      .project({ discordId: 1, balanceAfter: 1, createdAt: 1 })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);

  const discordById = new Map(discord.map((d: any) => [String(d._id), d]));
  const txByUser = new Map<string, any[]>();
  for (const t of recentTx) {
    const k = String((t as any).discordId);
    const arr = txByUser.get(k) ?? [];
    arr.push(t);
    txByUser.set(k, arr);
  }

  return top.map((r: any) => {
    const discordId = String(r._id);
    const d = discordById.get(discordId) as any;
    const image = d?.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${d.avatar}.png?size=128`
      : null;
    const balance = Number(r.balance ?? 0);
    const txs = txByUser.get(discordId) ?? [];
    const sparkline: number[] = new Array(14).fill(balance);
    if (txs.length > 0) {
      const cutoff = Date.now() - 14 * 86400_000;
      let carry = Number(txs[0].balanceAfter ?? balance);
      for (const t of txs) {
        const day = Math.floor((new Date(t.createdAt).getTime() - cutoff) / 86400_000);
        if (day >= 0 && day <= 13) {
          carry = Number(t.balanceAfter ?? carry);
          sparkline[day] = carry;
        }
      }
      for (let i = 1; i < 14; i++) if (sparkline[i] === balance) sparkline[i] = sparkline[i - 1];
    }

    return {
      discordId,
      username: d?.username ?? null,
      globalName: d?.globalName ?? null,
      image,
      balance,
      sparkline,
      sharePct: totalCirculation > 0 ? (balance / totalCirculation) * 100 : 0,
    };
  });
}

export interface LoanSummary {
  activeCount: number;
  outstandingValue: number;
  overdueCount: number;
  avgInterestRate: number;
  byTier: Record<number, { count: number; value: number }>;
}

export async function getLoanSummary(): Promise<LoanSummary> {
  const client = await clientPromise;
  const db = client.db('Database');
  const now = Date.now();

  const result = await db.collection('bank').aggregate([
    { $match: { loans: { $exists: true, $ne: [] } } },
    { $unwind: '$loans' },
    { $match: { 'loans.active': true, 'loans.paidAt': { $exists: false } } },
    { $group: {
      _id: '$loans.tier',
      count: { $sum: 1 },
      value: { $sum: '$loans.repaymentAmount' },
      interest: { $sum: '$loans.interestRate' },
      overdue: { $sum: { $cond: [{ $lt: ['$loans.dueDate', now] }, 1, 0] } },
    } },
  ]).toArray();

  let activeCount = 0, outstandingValue = 0, interestSum = 0, overdueCount = 0;
  const byTier: Record<number, { count: number; value: number }> = {};
  for (const r of result) {
    const tier = Number((r as any)._id ?? 0);
    activeCount += (r as any).count;
    outstandingValue += (r as any).value;
    interestSum += (r as any).interest;
    overdueCount += (r as any).overdue;
    byTier[tier] = { count: (r as any).count, value: (r as any).value };
  }

  return {
    activeCount,
    outstandingValue,
    overdueCount,
    avgInterestRate: activeCount > 0 ? interestSum / activeCount : 0,
    byTier,
  };
}
