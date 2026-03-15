import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const discordId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Get all users with active or overdue loans
    const pipeline = [
      { $unwind: '$loans' },
      {
        $match: {
          $or: [
            { 'loans.active': true, 'loans.paidAt': { $exists: false } },
            { 'loans.overdue': true, 'loans.paidAt': { $exists: false } },
          ],
        },
      },
      { $sort: { 'loans.takenAt': -1 } },
      { $limit: 100 },
      {
        $project: {
          discordId: '$_id',
          amount: '$loans.amount',
          repaymentAmount: '$loans.repaymentAmount',
          interestRate: '$loans.interestRate',
          dueDate: '$loans.dueDate',
          takenAt: '$loans.takenAt',
          active: '$loans.active',
          overdue: '$loans.overdue',
          tier: '$loans.tier',
        },
      },
    ];

    const loans = await db.collection('bank').aggregate(pipeline).toArray();

    // Resolve usernames
    const uniqueIds = Array.from(new Set(loans.map((l) => String(l.discordId)).filter(Boolean)));
    const [webUsers, discordUsers] = uniqueIds.length > 0
      ? await Promise.all([
          db.collection('users').find({ discordId: { $in: uniqueIds } }).project({ discordId: 1, username: 1, globalName: 1, name: 1, image: 1 }).toArray(),
          db.collection('discord_users').find({ _id: { $in: uniqueIds } as any }).project({ _id: 1, username: 1, avatar: 1 }).toArray(),
        ])
      : [[], []];

    const userMap = new Map<string, { username: string; avatar: string | null }>();
    for (const u of discordUsers) userMap.set(String(u._id), { username: u.username ?? '', avatar: u.avatar ?? null });
    for (const u of webUsers) userMap.set(u.discordId, { username: u.globalName ?? u.name ?? u.username ?? '', avatar: u.image ?? null });

    const enriched = loans.map((l) => {
      const user = userMap.get(String(l.discordId));
      return {
        discordId: String(l.discordId),
        username: user?.username ?? '',
        avatar: user?.avatar ?? null,
        amount: l.amount ?? 0,
        repaymentAmount: l.repaymentAmount ?? 0,
        interestRate: l.interestRate ?? 0,
        dueDate: l.dueDate ?? 0,
        takenAt: l.takenAt ?? 0,
        active: l.active ?? false,
        overdue: l.overdue ?? false,
        isOverdue: l.dueDate ? l.dueDate < Date.now() : false,
      };
    });

    return NextResponse.json({ loans: enriched });
  } catch (error) {
    console.error('[admin/banking/loans GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = auth.session.user.discordId!;
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many actions. Wait a moment.' }, { status: 429 });
  }

  try {
    const { action, discordId, loanIndex, newAmount, newDueDate, reason } = await req.json();

    if (!discordId || typeof discordId !== 'string') {
      return NextResponse.json({ error: 'discordId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const bankDoc = await db.collection('bank').findOne({ _id: discordId as any });

    if (!bankDoc?.loans || !Array.isArray(bankDoc.loans)) {
      return NextResponse.json({ error: 'User has no loans' }, { status: 404 });
    }

    const loans = bankDoc.loans;
    // Find the active/overdue loan
    const idx = loanIndex ?? loans.findIndex((l: any) => l.active && !l.paidAt);
    if (idx < 0 || idx >= loans.length) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const loan = loans[idx];
    const before = { ...loan };

    switch (action) {
      case 'absolve': {
        // Forgive the loan entirely
        loans[idx] = { ...loan, active: false, overdue: false, paidAt: Date.now() };

        // Clear any debt for this user
        await db.collection('debt').deleteOne({ _id: discordId as any });

        // Credit the remaining repayment amount back (they don't need to pay)
        // Note: we don't credit — the loan is simply forgiven. The user already received the Lunari.
        break;
      }

      case 'reduce': {
        if (typeof newAmount !== 'number' || newAmount < 0) {
          return NextResponse.json({ error: 'Invalid newAmount' }, { status: 400 });
        }
        if (newAmount === 0) {
          // Full reduction = absolve
          loans[idx] = { ...loan, repaymentAmount: 0, active: false, overdue: false, paidAt: Date.now() };
          await db.collection('debt').deleteOne({ _id: discordId as any });
        } else {
          loans[idx] = { ...loan, repaymentAmount: newAmount };
        }
        break;
      }

      case 'extend': {
        if (typeof newDueDate !== 'number' || newDueDate < Date.now()) {
          return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
        }
        loans[idx] = { ...loan, dueDate: newDueDate, overdue: false };

        // If user had debt from this being overdue, clear it
        if (loan.overdue) {
          await db.collection('debt').deleteOne({ _id: discordId as any });
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await db.collection('bank').updateOne(
      { _id: discordId as any },
      { $set: { loans, updatedAt: new Date() } }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user.username ?? 'unknown',
      action: `loan_${action}`,
      targetDiscordId: discordId,
      metadata: { reason: reason ?? '', loanIndex: idx },
      before,
      after: loans[idx],
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
    });

    return NextResponse.json({ success: true, loan: loans[idx] });
  } catch (error) {
    console.error('[admin/banking/loans POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
