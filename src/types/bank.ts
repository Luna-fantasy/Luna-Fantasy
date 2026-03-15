// ── Bank Types ──

export interface LoanRecord {
  tier: number;
  amount: number;
  repaymentAmount: number;
  interestRate: number;
  isVIP: boolean;
  dueDate: number;
  active: boolean;
  takenAt: number;
  paidAt?: number;
  overdue?: boolean;
}

export interface InvestmentRecord {
  amount: number;
  startDate: string;
  lastDepositDate: string;
  depositLocked: boolean;
  active: boolean;
}

export interface RoleClassification {
  isStaff: boolean;
  isSpecial: boolean;
  isBooster: boolean;
  isVip: boolean;
  staffRoleName?: string;
  specialRoleName?: string;
  roleIds: string[];
}

export interface BankConfigData {
  loanTiers: number[];
  loanInterestRate: number;
  loanVipInterestRate: number;
  loanDurationMs: number;
  dailyBase: number;
  dailyVipBonus: number;
  dailyCooldownMs: number;
  monthlyAmount: number;
  monthlyCooldownMs: number;
  investmentMinAmount: number;
  investmentProfitRate: number;
  investmentMaturityMs: number;
  investmentEarlyFee: number;
  investmentDepositLockMs: number;
  insuranceCost: number;
}

export interface BankDashboardData {
  balance: number;
  debt: number;
  level: number;
  loans: LoanRecord[];
  activeLoan: LoanRecord | null;
  investment: InvestmentRecord | null;
  cooldowns: {
    daily: number | null;      // timestamp of last claim, null if never claimed
    monthly: number | null;
  };
  roles: RoleClassification;
  hasInsurance: boolean;
  config?: BankConfigData;
}

// ── API Response Types ──

export interface DailyClaimResponse {
  success: boolean;
  amount: number;
  vipBonus: number;
  newBalance: number;
  nextClaimAt: number;
}

export interface LoanCreateResponse {
  success: boolean;
  loan: LoanRecord;
  newBalance: number;
}

export interface LoanRepayResponse {
  success: boolean;
  repaymentAmount: number;
  newBalance: number;
}

export interface InvestmentDepositResponse {
  success: boolean;
  investment: InvestmentRecord;
  newBalance: number;
}

export interface InvestmentWithdrawResponse {
  success: boolean;
  payout: number;
  profit: number;
  early: boolean;
  newBalance: number;
}

export interface InsurancePurchaseResponse {
  success: boolean;
  newBalance: number;
}
