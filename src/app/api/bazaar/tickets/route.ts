import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTicketPackage } from '@/lib/bazaar/stone-config';
import { deductLunari, creditLunari, addToBankReserve, checkDebt, logTransaction, getBalance, getDailySpending, DAILY_SPEND_LIMIT } from '@/lib/bazaar/lunari-ops';
import { addTickets } from '@/lib/bazaar/ticket-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  // CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // Rate limit
  const rl = checkRateLimit('tickets', discordId, RATE_LIMITS.tickets.maxRequests, RATE_LIMITS.tickets.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    // 1. Debt check
    const hasDebt = await checkDebt(discordId);
    if (hasDebt) {
      return NextResponse.json({ error: 'You have outstanding debt. Pay your debts first.' }, { status: 403 });
    }

    // 2. Input validation
    const { packageId } = await request.json();
    const pkg = getTicketPackage(packageId);
    if (!pkg) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
    }

    // 3. Balance check
    const balance = await getBalance(discordId);
    if (balance < pkg.price) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 3b. Daily spending limit
    const dailySpent = await getDailySpending(discordId);
    if (dailySpent + pkg.price > DAILY_SPEND_LIMIT) {
      return NextResponse.json(
        { error: `Daily spending limit reached (${DAILY_SPEND_LIMIT.toLocaleString()}L/day). Try again tomorrow.` },
        { status: 429 }
      );
    }

    // 4. Atomic deduct Lunari
    const deductResult = await deductLunari(discordId, pkg.price);
    if (!deductResult.success) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    try {
      // 5. Add to bank reserve
      await addToBankReserve(pkg.price);

      // 6. Add tickets
      const totalTickets = await addTickets(discordId, pkg.tickets);

      // 7. Log transaction
      await logTransaction({
        discordId,
        type: 'ticket_spend',
        amount: -pkg.price,
        balanceBefore: deductResult.balanceBefore,
        balanceAfter: deductResult.balanceAfter,
        metadata: {
          vendorId: 'zoldar',
          packageId: pkg.id,
          itemReceived: `${pkg.tickets} tickets`,
        },
        createdAt: new Date(),
        source: 'web',
      });

      const res = NextResponse.json({
        ticketsAdded: pkg.tickets,
        newBalance: deductResult.balanceAfter,
        totalTickets,
      });
      return refreshCsrf(res);
    } catch (error) {
      // REFUND on failure after deduction
      await creditLunari(discordId, pkg.price).catch(() => {});
      console.error('Ticket purchase error:', error);
      return NextResponse.json({ error: 'Purchase failed. Lunari refunded.' }, { status: 500 });
    }
  } catch (err) {
    console.error('Tickets API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
