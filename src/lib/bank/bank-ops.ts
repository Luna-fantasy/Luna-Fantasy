/**
 * Bank operations — loans, investment, cooldowns, dashboard.
 * Uses the same MongoDB/st.db format as the Discord bots.
 */

import clientPromise from '@/lib/mongodb';
import { getLiveBankConfig } from './live-bank-config';
import { getUserGuildRoles, classifyUserRoles } from './discord-roles';
import { deductLunari, creditLunari, getBalance, checkDebt, addToBankReserve, logTransaction, trackProfileEarnings, trackProfileSpending } from '@/lib/bazaar/lunari-ops';
import { depositInvestmentTx, withdrawInvestmentTx, type InvestmentTerms } from './investment-tx';
import type { LoanRecord, InvestmentRecord, BankDashboardData } from '@/types/bank';

function getDb() {
  return clientPromise.then((client) => client.db('Database'));
}

// ── Cooldowns ──

/**
 * Check if a cooldown has expired. Returns the timestamp of last use, or null.
 */
export async function getCooldown(type: string, userId: string): Promise<number | null> {
  const db = await getDb();
  const doc = await db.collection('cooldowns').findOne({ _id: `${type}_${userId}` as any });
  if (doc?.value == null) return null;
  return typeof doc.value === 'number' ? doc.value : null;
}

/**
 * Check if a cooldown is still active. Returns { onCooldown, remainingMs, lastUsed }.
 */
export async function checkCooldown(
  type: string,
  userId: string,
  durationMs: number
): Promise<{ onCooldown: boolean; remainingMs: number; lastUsed: number | null }> {
  const lastUsed = await getCooldown(type, userId);
  if (!lastUsed) return { onCooldown: false, remainingMs: 0, lastUsed: null };

  const elapsed = Date.now() - lastUsed;
  if (elapsed >= durationMs) return { onCooldown: false, remainingMs: 0, lastUsed };

  return { onCooldown: true, remainingMs: durationMs - elapsed, lastUsed };
}

/**
 * Set a cooldown to the current timestamp.
 */
export async function setCooldown(type: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.collection('cooldowns').updateOne(
    { _id: `${type}_${userId}` as any },
    { $set: { value: Date.now() } },
    { upsert: true }
  );
}

// ── Level ──

export async function getUserLevel(userId: string): Promise<number> {
  const db = await getDb();
  const doc = await db.collection('levels').findOne({ _id: userId as any });
  return doc?.level ?? 0;
}

// ── Profile (for passport check) ──

/**
 * Read a user's profile data, handling both st.db v7 wrapped format
 * ({ data: {...} } or { data: "JSON string" }) and top-level flat docs.
 * Mirrors the extraction logic used by the game-data route so passport
 * checks stay consistent across the site.
 */
export async function getUserProfile(userId: string): Promise<{ passport: any | null } | null> {
  const db = await getDb();
  const doc = await db.collection('profiles').findOne({ _id: userId as any });
  if (!doc) return null;

  // Flat / top-level passport field
  if ((doc as any).passport) return { passport: (doc as any).passport };

  const data = (doc as any).data;
  if (!data) return { passport: null };

  if (typeof data === 'object') {
    return { passport: data.passport ?? null };
  }
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return { passport: parsed?.passport ?? null };
    } catch {
      return { passport: null };
    }
  }
  return { passport: null };
}

// ── Debt ──

export async function getDebtAmount(userId: string): Promise<number> {
  const db = await getDb();
  const doc = await db.collection('debt').findOne({ _id: userId as any });
  if (doc?.amount == null) return 0;
  return typeof doc.amount === 'number' ? doc.amount : 0;
}

export async function clearDebt(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection('debt').deleteOne({ _id: userId as any });
}

// ── Loans ──

export async function getUserLoans(userId: string): Promise<LoanRecord[]> {
  const db = await getDb();
  const doc = await db.collection('bank').findOne({ _id: userId as any });
  if (!doc?.loans) return [];
  return Array.isArray(doc.loans) ? doc.loans : [];
}

export async function getActiveLoan(userId: string): Promise<LoanRecord | null> {
  const loans = await getUserLoans(userId);
  return loans.find((l) => l.active) ?? null;
}

export async function createLoan(
  userId: string,
  tierAmount: number
): Promise<{ loan: LoanRecord; balanceAfter: number }> {
  const config = await getLiveBankConfig();

  // Resolve the full tier object — we need the passport_required flag and
  // per-tier level requirement, not just the amount. Mirrors Butler's
  // banker_commands.handleTakeLoan lookup.
  const tier = config.loanTiersFull.find((t) => t.amount === tierAmount);
  if (!tier) {
    throw new Error('Invalid loan tier');
  }

  // Fix inconsistent state before checking
  await fixOverdueLoanState(userId);

  // Check preconditions — include profile (for passport) and investment
  // (for VIP status, derived server-side — do NOT trust client).
  const [activeLoan, hasDebt, level, profile, investment] = await Promise.all([
    getActiveLoan(userId),
    checkDebt(userId),
    getUserLevel(userId),
    getUserProfile(userId),
    getInvestment(userId),
  ]);

  if (activeLoan) throw new Error('You already have an active loan');
  if (hasDebt) throw new Error('You have outstanding debt');

  // Passport-gated tiers bypass the level check but require a passport.
  // Mirrors Butler's banker_commands.ts:1036 logic exactly.
  if (tier.passport_required) {
    if (!profile?.passport) {
      throw new Error('This loan is only available to Luna Passport holders');
    }
  } else if (level < tier.level) {
    throw new Error(`You must be at least level ${tier.level} for this loan`);
  }

  // VIP is derived from active investment — NEVER taken from client input.
  // Mirrors Butler's banker_commands.ts:1067 check.
  const isVip = !!(investment && investment.amount > 0);

  const interestRate = isVip ? config.loanVipInterestRate : (tier.interest ?? config.loanInterestRate);
  const interest = Math.floor(tierAmount * interestRate);
  const loanDuration = tier.duration ?? config.loanDurationMs;
  const now = Date.now();

  const loan: LoanRecord = {
    tier: tierAmount,
    amount: tierAmount,
    repaymentAmount: tierAmount + interest,
    interestRate,
    isVIP: isVip,
    dueDate: now + loanDuration,
    active: true,
    takenAt: now,
    overdue: false,
  };

  // Credit the loan amount to user
  const { balanceAfter } = await creditLunari(userId, tierAmount);

  // Push loan record to bank collection
  const db = await getDb();
  await db.collection('bank').updateOne(
    { _id: userId as any },
    { $push: { loans: loan } as any, $set: { updatedAt: new Date() } },
    { upsert: true }
  );

  return { loan, balanceAfter };
}

/**
 * Fix inconsistent overdue loan state — mirrors Butler's fixOverdueLoanState.
 * If a loan is marked overdue + inactive but never marked paid, and the user
 * has no debt, it means the auto-deduction already paid it. Mark it as paid.
 */
export async function fixOverdueLoanState(userId: string): Promise<void> {
  const loans = await getUserLoans(userId);
  const debt = await getDebtAmount(userId);

  const needsFix = loans.some((l) => l.overdue && !l.active && !l.paidAt);
  if (!needsFix || debt > 0) return;

  const fixed = loans.map((loan) => {
    if (loan.overdue && !loan.active && !loan.paidAt) {
      return { ...loan, overdue: false, paidAt: Date.now() };
    }
    return loan;
  });

  const db = await getDb();
  await db.collection('bank').updateOne(
    { _id: userId as any },
    { $set: { loans: fixed, updatedAt: new Date() } }
  );
}

export async function repayLoan(
  userId: string
): Promise<{ repaymentAmount: number; balanceAfter: number }> {
  // Must pay debt before repaying loans — mirrors Butler logic
  const debt = await getDebtAmount(userId);
  if (debt > 0) throw new Error('You must pay your outstanding debt before repaying a loan');

  await fixOverdueLoanState(userId);

  const loans = await getUserLoans(userId);
  const activeIndex = loans.findIndex((l) => l.active);
  if (activeIndex === -1) throw new Error('No active loan to repay');

  const loan = loans[activeIndex];
  const repaymentAmount = loan.repaymentAmount;

  // Deduct repayment from user
  const deductResult = await deductLunari(userId, repaymentAmount);
  if (!deductResult.success) throw new Error('Insufficient balance to repay loan');

  // Mark loan as paid
  loans[activeIndex] = {
    ...loan,
    active: false,
    overdue: false,
    paidAt: Date.now(),
  };

  const db = await getDb();
  await db.collection('bank').updateOne(
    { _id: userId as any },
    { $set: { loans, updatedAt: new Date() } }
  );

  // Only add interest portion to bank reserve (not the full repayment)
  const interestAmount = repaymentAmount - loan.amount;
  if (interestAmount > 0) {
    await addToBankReserve(interestAmount);
  }

  return { repaymentAmount, balanceAfter: deductResult.balanceAfter };
}

/**
 * Partial loan repayment — reduces the loan's repaymentAmount.
 * Mirrors Butler's handleLoanModal logic.
 */
export async function partialRepayLoan(
  userId: string,
  amount: number
): Promise<{ newRepaymentAmount: number; balanceAfter: number; fullyPaid: boolean }> {
  const debt = await getDebtAmount(userId);
  if (debt > 0) throw new Error('You must pay your outstanding debt before repaying a loan');

  if (amount <= 0) throw new Error('Invalid payment amount');

  await fixOverdueLoanState(userId);

  const loans = await getUserLoans(userId);
  const activeIndex = loans.findIndex((l) => l.active);
  if (activeIndex === -1) throw new Error('No active loan to repay');

  const loan = loans[activeIndex];
  if (amount > loan.repaymentAmount) throw new Error('Amount exceeds loan repayment amount');

  // Deduct from user
  const deductResult = await deductLunari(userId, amount);
  if (!deductResult.success) throw new Error('Insufficient balance');

  const newRepaymentAmount = loan.repaymentAmount - amount;

  // Add interest portion of this payment to bank reserve
  const cfg = await getLiveBankConfig();
  const interestRate = loan.interestRate || cfg.loanInterestRate;
  const interestPortion = Math.floor(amount * (interestRate / (1 + interestRate)));
  if (interestPortion > 0) {
    await addToBankReserve(interestPortion);
  }

  const fullyPaid = newRepaymentAmount === 0;

  if (fullyPaid) {
    // Mark loan as fully paid
    loans[activeIndex] = {
      ...loan,
      repaymentAmount: 0,
      active: false,
      overdue: false,
      paidAt: Date.now(),
    };
  } else {
    // Update remaining repayment amount
    loans[activeIndex] = {
      ...loan,
      repaymentAmount: newRepaymentAmount,
    };
  }

  const db = await getDb();
  await db.collection('bank').updateOne(
    { _id: userId as any },
    { $set: { loans, updatedAt: new Date() } }
  );

  return { newRepaymentAmount, balanceAfter: deductResult.balanceAfter, fullyPaid };
}

/**
 * Pay outstanding debt (full or partial). Mirrors Butler's handleDebtConfirmation / handleDebtModal.
 */
export async function payDebt(
  userId: string,
  amount?: number
): Promise<{ amountPaid: number; remainingDebt: number; balanceAfter: number }> {
  const currentDebt = await getDebtAmount(userId);
  if (currentDebt <= 0) throw new Error('No outstanding debt');

  const amountToPay = amount ?? currentDebt; // default to full payment
  if (amountToPay <= 0) throw new Error('Invalid payment amount');
  if (amountToPay > currentDebt) throw new Error('Amount exceeds outstanding debt');

  // Deduct from user
  const deductResult = await deductLunari(userId, amountToPay);
  if (!deductResult.success) throw new Error('Insufficient balance');

  const remainingDebt = currentDebt - amountToPay;

  if (remainingDebt === 0) {
    // Fully paid — clear debt and mark overdue loans as paid
    await clearDebt(userId);

    const loans = await getUserLoans(userId);
    const hasOverdueUnpaid = loans.some((l) => l.overdue && !l.paidAt);
    if (hasOverdueUnpaid) {
      const updated = loans.map((loan) => {
        if (loan.overdue && !loan.paidAt) {
          return { ...loan, active: false, overdue: false, paidAt: Date.now() };
        }
        return loan;
      });
      const db = await getDb();
      await db.collection('bank').updateOne(
        { _id: userId as any },
        { $set: { loans: updated, updatedAt: new Date() } }
      );
    }
  } else {
    // Partial — update remaining debt
    const db = await getDb();
    await db.collection('debt').updateOne(
      { _id: userId as any },
      { $set: { amount: remainingDebt, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  return { amountPaid: amountToPay, remainingDebt, balanceAfter: deductResult.balanceAfter };
}

// ── Investment ──

export async function getInvestment(userId: string): Promise<InvestmentRecord | null> {
  const db = await getDb();
  const doc = await db.collection('bank').findOne({ _id: userId as any });
  if (!doc?.investment) return null;
  const data = doc.investment;
  if (!data.active) return null;
  return data as InvestmentRecord;
}

function investmentTerms(config: Awaited<ReturnType<typeof getLiveBankConfig>>): InvestmentTerms {
  return {
    maturityMs: config.investmentMaturityMs,
    profitRate: config.investmentProfitRate,
    earlyFee: config.investmentEarlyFee,
    depositLockMs: config.investmentDepositLockMs,
  };
}

// The debit, the deposit write and the reserve update happen in one transaction (investment-tx)
export async function depositInvestment(
  userId: string,
  amount: number
): Promise<{ investment: InvestmentRecord; balanceAfter: number }> {
  const config = await getLiveBankConfig();

  if (amount < config.investmentMinAmount) {
    throw new Error(`Minimum deposit is ${config.investmentMinAmount.toLocaleString()} Lunari`);
  }

  const result = await depositInvestmentTx(await clientPromise, userId, amount, investmentTerms(config));
  void trackProfileSpending(userId, amount);
  return result;
}

// Claiming, paying and clearing the deposit happen in one transaction, so a double click or
// Butler's payout can't pay it again (investment-tx)
export async function withdrawInvestment(
  userId: string
): Promise<{ payout: number; profit: number; early: boolean; balanceAfter: number }> {
  const config = await getLiveBankConfig();
  const result = await withdrawInvestmentTx(await clientPromise, userId, investmentTerms(config));
  if (!result) throw new Error('No active investment');

  if (result.payout > 0) void trackProfileEarnings(userId, result.payout);
  return { payout: result.payout, profit: result.profit, early: result.early, balanceAfter: result.balanceAfter };
}

// ── Insurance ──

export async function hasInsurance(userId: string): Promise<boolean> {
  const db = await getDb();
  const doc = await db.collection('system').findOne({ _id: `insurances_${userId}` as any });
  if (!doc?.value) return false;
  return Array.isArray(doc.value) && doc.value.some((ins: any) => ins.type === 'steal_protection');
}

export async function purchaseInsurance(
  userId: string
): Promise<{ balanceAfter: number }> {
  const config = await getLiveBankConfig();
  const alreadyHas = await hasInsurance(userId);
  if (alreadyHas) throw new Error('You already have theft protection');

  const deductResult = await deductLunari(userId, config.insuranceCost);
  if (!deductResult.success) throw new Error('Insufficient balance');

  const db = await getDb();
  const doc = await db.collection('system').findOne({ _id: `insurances_${userId}` as any });
  const insurances = Array.isArray(doc?.value) ? doc.value : [];

  insurances.push({
    type: 'steal_protection',
    purchasedAt: new Date().toISOString(),
    duration: -1, // lifetime
  });

  await db.collection('system').updateOne(
    { _id: `insurances_${userId}` as any },
    { $set: { value: insurances } },
    { upsert: true }
  );

  await addToBankReserve(config.insuranceCost);

  return { balanceAfter: deductResult.balanceAfter };
}

// ── Dashboard ──

export async function getBankDashboardData(userId: string): Promise<BankDashboardData> {
  const [
    balance,
    debt,
    level,
    loans,
    investment,
    dailyCooldown,
    monthlyCooldown,
    roleIds,
    insured,
    profile,
  ] = await Promise.all([
    getBalance(userId),
    getDebtAmount(userId),
    getUserLevel(userId),
    getUserLoans(userId),
    getInvestment(userId),
    getCooldown('daily', userId),
    getCooldown('monthly', userId),
    getUserGuildRoles(userId),
    hasInsurance(userId),
    getUserProfile(userId),
  ]);

  const roles = classifyUserRoles(roleIds);
  const activeLoan = loans.find((l) => l.active) ?? null;

  return {
    balance,
    debt,
    level,
    loans,
    activeLoan,
    investment,
    cooldowns: {
      daily: dailyCooldown,
      monthly: monthlyCooldown,
    },
    roles,
    hasInsurance: insured,
    hasPassport: !!profile?.passport,
  };
}
