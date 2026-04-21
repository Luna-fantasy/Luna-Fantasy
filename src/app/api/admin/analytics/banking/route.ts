import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const DB = 'Database';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('analytics_banking', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const bankCol = db.collection('bank');
    const debtCol = db.collection('debt');
    const sysCol = db.collection('system');

    const now = Date.now();

    const [activeLoansAgg, overdueAgg, investAgg, debtAgg, reserveDoc, recentLoans] = await Promise.all([
      bankCol.aggregate([
        { $unwind: '$loans' },
        { $match: { 'loans.active': true } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$loans.amount' }, totalRepayment: { $sum: '$loans.repaymentAmount' } } },
      ]).toArray(),

      bankCol.aggregate([
        { $unwind: '$loans' },
        { $match: { 'loans.active': true, 'loans.dueDate': { $lt: now } } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$loans.repaymentAmount' } } },
      ]).toArray(),

      bankCol.aggregate([
        { $match: { 'investment.active': true } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$investment.amount' } } },
      ]).toArray(),

      debtCol.aggregate([
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      ]).toArray(),

      sysCol.findOne({ _id: 'luna_bank_reserve' as any }),

      bankCol.aggregate([
        { $unwind: '$loans' },
        { $match: { 'loans.active': true } },
        { $sort: { 'loans.takenAt': -1 } },
        { $limit: 10 },
        { $lookup: { from: 'discord_users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { userId: '$_id', username: '$user.username', loan: '$loans' } },
      ]).toArray(),
    ]);

    return NextResponse.json({
      reserve: reserveDoc?.value ?? 0,
      activeLoans: activeLoansAgg[0] ?? { count: 0, totalAmount: 0, totalRepayment: 0 },
      overdueLoans: overdueAgg[0] ?? { count: 0, totalAmount: 0 },
      investments: investAgg[0] ?? { count: 0, totalAmount: 0 },
      debt: debtAgg[0] ?? { count: 0, totalAmount: 0 },
      recentLoans,
    });
  } catch (err: any) {
    console.error('[analytics/banking] Error:', err);
    return NextResponse.json({ error: 'Failed to load banking analytics' }, { status: 500 });
  }
}
