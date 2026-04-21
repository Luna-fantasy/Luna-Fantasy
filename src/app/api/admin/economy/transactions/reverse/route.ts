import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { creditLunari, deductLunari } from '@/lib/bazaar/lunari-ops';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB_NAME = 'Database';

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: { transactionId: string; reason: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { transactionId, reason } = body;
  if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 });
  if (!reason || reason.trim().length < 3 || reason.length > 500) return NextResponse.json({ error: 'Reason required (3-500 characters)' }, { status: 400 });
  if (!/^[0-9a-fA-F]{24}$/.test(transactionId)) return NextResponse.json({ error: 'Invalid transaction ID format' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('lunari_transactions');

    const original = await col.findOne({ _id: new ObjectId(transactionId) });
    if (!original) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    const reverseAmount = -(original.amount ?? 0);
    const targetDiscordId = original.discordId;

    // Verify user exists before applying reversal
    const userDoc = await db.collection('points').findOne({ _id: targetDiscordId as any });
    if (!userDoc) {
      return NextResponse.json({ error: 'Target user not found in points collection' }, { status: 404 });
    }

    // Apply the reverse and track balance
    let balanceBefore = 0;
    let balanceAfter = 0;
    if (reverseAmount > 0) {
      const result = await creditLunari(targetDiscordId, reverseAmount);
      balanceAfter = result.balanceAfter;
      balanceBefore = balanceAfter - reverseAmount;
    } else if (reverseAmount < 0) {
      const result = await deductLunari(targetDiscordId, Math.abs(reverseAmount));
      if (!result.success) {
        return NextResponse.json({ error: 'User has insufficient balance to reverse this transaction' }, { status: 400 });
      }
      balanceBefore = result.balanceBefore;
      balanceAfter = result.balanceAfter;
    }

    // Log the reversal transaction
    await col.insertOne({
      discordId: targetDiscordId,
      type: 'admin_reversal',
      amount: reverseAmount,
      balanceBefore,
      balanceAfter,
      metadata: {
        originalTransactionId: transactionId,
        originalType: original.type,
        originalAmount: original.amount,
        reason: reason.trim(),
      },
      source: 'admin',
      createdAt: new Date(),
    });

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'transaction_reverse',
      targetDiscordId,
      before: { transactionId, type: original.type, amount: original.amount },
      after: { reversalAmount: reverseAmount },
      metadata: { reason: reason.trim() },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, reversalAmount: reverseAmount });
  } catch (error) {
    console.error('Transaction reverse error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
