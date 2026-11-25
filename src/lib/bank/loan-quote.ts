import type { LoanTierDetail } from '@/types/bank';

export function loanQuote(amount: number, rate: number) {
  const interest = Math.floor(amount * rate);
  return { interest, repayment: amount + interest };
}

export function canChooseLoanTier(tier: LoanTierDetail | undefined, level: number, hasPassport: boolean) {
  return tier?.passport_required ? hasPassport : level >= (tier?.level ?? 1);
}
