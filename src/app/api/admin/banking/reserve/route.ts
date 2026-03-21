import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { creditLunari, logTransaction } from '@/lib/bazaar/lunari-ops';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

/**
 * GET — Fetch current reserve balance and recent withdrawals.
 */
export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const [reserveDoc, recentWithdrawals] = await Promise.all([
      db.collection('system').findOne({ _id: 'luna_bank_reserve' as any }),
      db.collection('lunari_transactions')
        .find({ type: 'reserve_withdrawal' })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),
    ]);

    const rawValue = reserveDoc?.value ?? reserveDoc?.data;
    const balance = typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? parseFloat(rawValue) || 0
        : 0;

    // Resolve usernames for withdrawal recipients
    const recipientIds = Array.from(new Set(
      recentWithdrawals.map((w) => w.discordId).filter(Boolean)
    ));

    const [webUsers, discordUsers] = recipientIds.length > 0
      ? await Promise.all([
          db.collection('users').find({ discordId: { $in: recipientIds } }).project({ discordId: 1, username: 1, globalName: 1, name: 1 }).toArray(),
          db.collection('discord_users').find({ _id: { $in: recipientIds } }).project({ _id: 1, username: 1 }).toArray(),
        ])
      : [[], []];

    const nameMap = new Map<string, string>();
    for (const u of discordUsers) nameMap.set(String(u._id), u.username ?? '');
    for (const u of webUsers) nameMap.set(u.discordId, u.globalName ?? u.name ?? u.username ?? '');

    const withdrawals = recentWithdrawals.map((w) => ({
      _id: w._id.toString(),
      discordId: w.discordId,
      recipientName: nameMap.get(w.discordId) ?? '',
      amount: w.amount,
      reason: w.metadata?.reason ?? '',
      adminName: w.metadata?.adminName ?? '',
      reserveBefore: w.metadata?.reserveBefore,
      reserveAfter: w.metadata?.reserveAfter,
      timestamp: w.createdAt ?? w.timestamp,
    }));

    return NextResponse.json({ balance: Math.round(balance), recentWithdrawals: withdrawals });
  } catch (error) {
    console.error('Reserve fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — Withdraw from reserve and credit a user.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  let body: { discordId: string; amount: number; reason: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { discordId, amount, reason } = body;

  // Validate Discord ID
  if (!discordId || !/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  // Validate amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Amount must be a positive integer' }, { status: 400 });
  }
  if (amount > 10_000_000) {
    return NextResponse.json({ error: 'Amount cannot exceed 10,000,000 Lunari' }, { status: 400 });
  }

  // Validate reason
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) {
    return NextResponse.json({ error: 'Reason required (3-500 characters)' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Atomic decrement — $gte guard prevents overdraw on concurrent requests
    const decrementResult = await db.collection('system').findOneAndUpdate(
      { _id: 'luna_bank_reserve' as any, value: { $type: 'number', $gte: amount } },
      { $inc: { value: -amount } },
      { returnDocument: 'before' },
    );

    if (!decrementResult) {
      // Re-read for error message (balance too low or doc missing)
      const reserveDoc = await db.collection('system').findOne({ _id: 'luna_bank_reserve' as any });
      const rawValue = reserveDoc?.value ?? reserveDoc?.data;
      const currentBalance = typeof rawValue === 'number'
        ? rawValue
        : typeof rawValue === 'string'
          ? parseFloat(rawValue) || 0
          : 0;
      return NextResponse.json({
        error: `Insufficient reserve. Current balance: ${Math.round(currentBalance).toLocaleString()} Lunari`,
        reserveBalance: Math.round(currentBalance),
      }, { status: 400 });
    }

    const reserveBefore = decrementResult.value as number;

    // Credit the user — rollback reserve if this fails
    let creditResult;
    try {
      creditResult = await creditLunari(discordId, amount);
    } catch (creditError) {
      // Attempt to refund the reserve
      try {
        await db.collection('system').findOneAndUpdate(
          { _id: 'luna_bank_reserve' as any },
          { $inc: { value: amount } },
        );
      } catch (rollbackError) {
        console.error('[Reserve] CRITICAL: creditLunari AND rollback failed:', { creditError, rollbackError, amount, discordId });
      }
      return NextResponse.json({ error: 'Failed to credit user. Reserve has been refunded.' }, { status: 500 });
    }

    const reserveAfter = reserveBefore - amount;
    const adminName = authResult.session.user?.globalName ?? authResult.session.user?.username ?? 'Admin';

    // Log transaction
    await logTransaction({
      discordId,
      type: 'reserve_withdrawal',
      amount,
      balanceBefore: creditResult.balanceAfter - amount,
      balanceAfter: creditResult.balanceAfter,
      metadata: {
        reason: reason.trim(),
        adminId,
        adminName,
        reserveBefore: Math.round(reserveBefore),
        reserveAfter: Math.round(reserveAfter),
      },
      source: 'web',
      createdAt: new Date(),
    });

    // Audit log
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: adminName,
      action: 'reserve_withdrawal',
      targetDiscordId: discordId,
      before: { reserve: Math.round(reserveBefore) },
      after: { reserve: Math.round(reserveAfter), userBalance: creditResult.balanceAfter },
      metadata: { amount, reason: reason.trim() },
      ip: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      reserveBefore: Math.round(reserveBefore),
      reserveAfter: Math.round(reserveAfter),
      userBalanceAfter: creditResult.balanceAfter,
    });
  } catch (error) {
    console.error('Reserve withdrawal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
