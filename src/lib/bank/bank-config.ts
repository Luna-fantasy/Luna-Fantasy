/**
 * Bank configuration constants — sourced from LunaButler/config.ts
 * and LunaButler/commands/banker_commands.ts.
 *
 * Do NOT change values here without verifying against the bot source.
 */

// ── Daily Salary ──
export const DAILY_BASE = 3_000;
export const DAILY_VIP_BONUS = 2_000;
export const DAILY_COOLDOWN_MS = 86_400_000; // 24 hours

// ── Monthly Salary ──
export const MONTHLY_AMOUNT = 80_000;
export const MONTHLY_COOLDOWN_MS = 2_592_000_000; // 30 days

// ── Loans ──
export const LOAN_TIERS = [5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 75_000, 100_000] as const;
export const LOAN_INTEREST_RATE = 0.20; // 20%
export const LOAN_VIP_INTEREST_RATE = 0.15; // 15%
export const LOAN_DURATION_DAYS = 7;
export const LOAN_DURATION_MS = LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const LOAN_MIN_LEVEL = 1;

// ── Investment ──
export const INVESTMENT_MIN_AMOUNT = 20_000;
export const INVESTMENT_PROFIT_RATE = 0.30; // 30%
export const INVESTMENT_MATURITY_DAYS = 30;
export const INVESTMENT_MATURITY_MS = INVESTMENT_MATURITY_DAYS * 24 * 60 * 60 * 1000;
export const INVESTMENT_EARLY_FEE = 5_000;
export const INVESTMENT_DEPOSIT_LOCK_DAYS = 7;
export const INVESTMENT_DEPOSIT_LOCK_MS = INVESTMENT_DEPOSIT_LOCK_DAYS * 24 * 60 * 60 * 1000;

// ── Insurance ──
export const INSURANCE_COST = 500_000;

// ── Discord Role IDs (from LunaButler/commands/banker_commands.ts) ──
export const STAFF_ROLES = {
  '1416510580038041621': 'Mastermind',
  '1416555884141613126': 'Luna Sentinel',
  '1416556873758277826': 'Luna Guardian',
  '1416546769474682951': 'Luna Knight',
  '1417164354058719303': 'Luna Wizard',
  '1418318823592820836': 'Luna Healer',
} as const;

export const SPECIAL_ROLES = {
  '1417160274447827086': 'Luna Noble',
  '1427759046697422859': 'Trickster',
  '1458898769343942798': 'Luna Chosen',
} as const;

export const BOOSTER_ROLE_ID = '1416510408210251798';
export const VIP_DEPOSIT_ROLE_ID = '1450899585206845470';
export const GUILD_ID = '1243327880478462032';

// All role IDs that qualify for monthly salary
export const MONTHLY_ELIGIBLE_ROLE_IDS = [
  ...Object.keys(STAFF_ROLES),
  ...Object.keys(SPECIAL_ROLES),
  BOOSTER_ROLE_ID,
];
