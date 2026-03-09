/**
 * Bank operations — loans, investment, cooldowns, dashboard.
 * Uses the same MongoDB/st.db format as the Discord bots.
 */

import clientPromise from '@/lib/mongodb';
import {
  DAILY_BASE,
  DAILY_VIP_BONUS,
  DAILY_COOLDOWN_MS,
  MONTHLY_COOLDOWN_MS,
  LOAN_TIERS,
  LOAN_INTEREST_RATE,
  LOAN_VIP_INTEREST_RATE,
  LOAN_DURATION_MS,
  LOAN_MIN_LEVEL,
  INVESTMENT_MIN_AMOUNT,
  INVESTMENT_PROFIT_RATE,
  INVESTMENT_MATURITY_MS,
  INVESTMENT_EARLY_FEE,
  INVESTMENT_DEPOSIT_LOCK_MS,
  INSURANCE_COST,
} from './bank-config';
import { getUserGuildRoles, classifyUserRoles } from './discord-roles';
import { deductLunari, creditLunari, getBalance, checkDebt, addToBankReserve, logTransaction } from '@/lib/bazaar/lunari-ops';
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

// ── Debt ──

export async function getDebtAmount(userId: string): Promise<number> {
  const db = await getDb();
  const doc = await db.collection('system').findOne({ _id: `debt_${userId}` as any });
  if (doc?.value == null) return 0;
  return typeof doc.value === 'number' ? doc.value : 0;
}

export async function clearDebt(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection('system').deleteOne({ _id: `debt_${userId}` as any });
}

// ── Loans ──

export async function getUserLoans(userId: string): Promise<LoanRecord[]> {
  const db = await getDb();
  const doc = await db.collection('system').findOne({ _id: `loans_${userId}` as any });
  if (!doc?.value) return [];
  return Array.isArray(doc.value) ? doc.value : [];
}

export async function getActiveLoan(userId: string): Promise<LoanRecord | null> {
  const loans = await getUserLoans(userId);
  return loans.find((l) => l.active) ?? null;
}

export async function createLoan(
  userId: string,
  tierAmount: number,
  isVip: boolean
): Promise<{ loan: LoanRecord; balanceAfter: number }> {
  // Validate tier
  if (!LOAN_TIERS.includes(tierAmount as any)) {
    throw new Error('Invalid loan tier');
  }

  // Fix inconsistent state before checking
  await fixOverdueLoanState(userId);

  // Check preconditions
  const [activeLoan, hasDebt, level] = await Promise.all([
    getActiveLoan(userId),
    checkDebt(userId),
    getUserLevel(userId),
  ]);

  if (activeLoan) throw new Error('You already have an active loan');
  if (hasDebt) throw new Error('You have outstanding debt');
  if (level < LOAN_MIN_LEVEL) throw new Error(`You must be at least level ${LOAN_MIN_LEVEL}`);

  const interestRate = isVip ? LOAN_VIP_INTEREST_RATE : LOAN_INTEREST_RATE;
  const interest = Math.floor(tierAmount * interestRate);
  const now = Date.now();

  const loan: LoanRecord = {
    tier: tierAmount,
    amount: tierAmount,
    repaymentAmount: tierAmount + interest,
    interestRate,
    isVIP: isVip,
    dueDate: now + LOAN_DURATION_MS,
    active: true,
    takenAt: now,
    overdue: false,
  };

  // Credit the loan amount to user
  const { balanceAfter } = await creditLunari(userId, tierAmount);

  // Push loan record to system.loans_${userId}
  const db = await getDb();
  const existingLoans = await getUserLoans(userId);
  existingLoans.push(loan);
  await db.collection('system').updateOne(
    { _id: `loans_${userId}` as any },
    { $set: { value: existingLoans } },
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
  await db.collection('system').updateOne(
    { _id: `loans_${userId}` as any },
    { $set: { value: fixed } }
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
  await db.collection('system').updateOne(
    { _id: `loans_${userId}` as any },
    { $set: { value: loans } }
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
  const interestRate = loan.interestRate || LOAN_INTEREST_RATE;
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
  await db.collection('system').updateOne(
    { _id: `loans_${userId}` as any },
    { $set: { value: loans } }
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
      await db.collection('system').updateOne(
        { _id: `loans_${userId}` as any },
        { $set: { value: updated } }
      );
    }
  } else {
    // Partial — update remaining debt
    const db = await getDb();
    await db.collection('system').updateOne(
      { _id: `debt_${userId}` as any },
      { $set: { value: remainingDebt } },
      { upsert: true }
    );
  }

  return { amountPaid: amountToPay, remainingDebt, balanceAfter: deductResult.balanceAfter };
}

// ── Investment ──

export async function getInvestment(userId: string): Promise<InvestmentRecord | null> {
  const db = await getDb();
  const doc = await db.collection('system').findOne({ _id: `investment_${userId}` as any });
  if (!doc?.value) return null;
  const data = doc.value;
  if (!data.active) return null;
  return data as InvestmentRecord;
}

export async function depositInvestment(
  userId: string,
  amount: number
): Promise<{ investment: InvestmentRecord; balanceAfter: number }> {
  if (amount < INVESTMENT_MIN_AMOUNT) {
    throw new Error(`Minimum deposit is ${INVESTMENT_MIN_AMOUNT.toLocaleString()} Lunari`);
  }

  const existing = await getInvestment(userId);
  const now = new Date();

  if (existing) {
    // Check deposit lock — can only add within 7 days of start
    const startDate = new Date(existing.startDate);
    const elapsed = now.getTime() - startDate.getTime();
    if (elapsed > INVESTMENT_DEPOSIT_LOCK_MS) {
      throw new Error('Deposit window has closed (7 days after initial deposit)');
    }
  }

  // Deduct from user
  const deductResult = await deductLunari(userId, amount);
  if (!deductResult.success) throw new Error('Insufficient balance');

  const db = await getDb();
  let investment: InvestmentRecord;

  if (existing) {
    // Add to existing investment
    investment = {
      ...existing,
      amount: existing.amount + amount,
      lastDepositDate: now.toISOString(),
    };
  } else {
    // Create new investment
    investment = {
      amount,
      startDate: now.toISOString(),
      lastDepositDate: now.toISOString(),
      depositLocked: false,
      active: true,
    };
  }

  await db.collection('system').updateOne(
    { _id: `investment_${userId}` as any },
    { $set: { value: investment } },
    { upsert: true }
  );

  // Add to bank reserve
  await addToBankReserve(amount);

  return { investment, balanceAfter: deductResult.balanceAfter };
}

export async function withdrawInvestment(
  userId: string
): Promise<{ payout: number; profit: number; early: boolean; balanceAfter: number }> {
  const investment = await getInvestment(userId);
  if (!investment) throw new Error('No active investment');

  const now = Date.now();
  const startDate = new Date(investment.startDate).getTime();
  const elapsed = now - startDate;
  const isMature = elapsed >= INVESTMENT_MATURITY_MS;

  let payout: number;
  let profit: number;

  if (isMature) {
    // Mature payout: principal + 30%
    payout = Math.floor(investment.amount * (1 + INVESTMENT_PROFIT_RATE));
    profit = payout - investment.amount;
  } else {
    // Early withdrawal: principal - 5,000 fee
    payout = Math.max(0, investment.amount - INVESTMENT_EARLY_FEE);
    profit = payout - investment.amount; // negative
  }

  // Credit payout to user
  const { balanceAfter } = await creditLunari(userId, payout);

  // Clear investment record
  const db = await getDb();
  await db.collection('system').updateOne(
    { _id: `investment_${userId}` as any },
    { $set: { value: { ...investment, active: false } } }
  );

  return { payout, profit, early: !isMature, balanceAfter };
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
  const alreadyHas = await hasInsurance(userId);
  if (alreadyHas) throw new Error('You already have theft protection');

  const deductResult = await deductLunari(userId, INSURANCE_COST);
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

  await addToBankReserve(INSURANCE_COST);

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
  };
}
