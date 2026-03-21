/**
 * Live bank config reader — reads from MongoDB bot_config with 30s TTL cache.
 * Falls back to defaults in bank-config.ts when MongoDB is unreachable.
 *
 * This is the ONLY module that should be used for reading dynamic bank config.
 * Do NOT import values directly from bank-config.ts in API routes or components.
 */

import clientPromise from '@/lib/mongodb';
import {
  DAILY_BASE,
  DAILY_VIP_BONUS,
  DAILY_COOLDOWN_MS,
  MONTHLY_AMOUNT,
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
  TRADE_MAX_AMOUNT,
  TRADE_WIN_RATE,
  TRADE_LOSS_RATE,
  TRADE_WIN_CHANCE,
  TRADE_COOLDOWN_MS,
  TRADE_PRESET_AMOUNTS,
} from './bank-config';

const DB_NAME = 'Database';
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

async function readBotConfig(docId: string): Promise<any | null> {
  const cached = cache.get(docId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const client = await clientPromise;
    const doc = await client.db(DB_NAME).collection('bot_config').findOne({ _id: docId as any });
    const result = doc?.data ?? null;
    cache.set(docId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.error(`[live-bank-config] Failed to read "${docId}":`, err);
    return null;
  }
}

export interface LiveBankConfig {
  // Loans
  loanTiers: number[];
  loanTiersFull: Array<{ level: number; amount: number; interest: number; duration: number }>;
  loanInterestRate: number;
  loanVipInterestRate: number;
  loanDurationMs: number;
  loanMinLevel: number;

  // Daily
  dailyBase: number;
  dailyMax: number;
  dailyCooldownMs: number;

  // VIP
  dailyVipBonus: number;
  vipCooldownMs: number;

  // Salary
  monthlyAmount: number;
  monthlyCooldownMs: number;

  // Investment
  investmentMinAmount: number;
  investmentProfitRate: number;
  investmentMaturityMs: number;
  investmentEarlyFee: number;
  investmentDepositLockMs: number;

  // Trade
  tradeMaxAmount: number;
  tradeWinRate: number;
  tradeLossRate: number;
  tradeWinChance: number;
  tradeCooldownMs: number;
  tradePresetAmounts: readonly number[];

  // Insurance
  insuranceCost: number;

  // Steal system (from butler_games)
  stealSystem: {
    enabled: boolean;
    chance: number;
    min_amount: number;
    max_amount: number;
    cooldown: number;
  } | null;
}

export async function getLiveBankConfig(): Promise<LiveBankConfig> {
  const [banking, economy, games] = await Promise.all([
    readBotConfig('butler_banking'),
    readBotConfig('butler_economy'),
    readBotConfig('butler_games'),
  ]);

  // Extract loan tiers from the full tier objects
  const fullTiers: Array<{ level: number; amount: number; interest: number; duration: number }> =
    banking?.loan_tiers ?? [];
  const tierAmounts = fullTiers.length > 0
    ? fullTiers.map((t: any) => t.amount)
    : [...LOAN_TIERS];

  // Derive interest/duration from the first tier, or use defaults
  const firstTier = fullTiers[0];
  const loanInterest = firstTier?.interest ?? LOAN_INTEREST_RATE;
  const loanDuration = firstTier?.duration ?? LOAN_DURATION_MS;

  // Economy config
  const daily = economy?.daily_reward;
  const salary = economy?.salary;
  const vip = economy?.vip_reward;

  // Investment config
  const inv = banking?.investment;

  // Trade config
  const trade = banking?.trade_settings;

  // Insurance config
  const insurance = banking?.insurance;

  // Steal system config
  const steal = games?.steal_system;

  return {
    // Loans
    loanTiers: tierAmounts,
    loanTiersFull: fullTiers.length > 0 ? fullTiers : LOAN_TIERS.map((amount) => ({
      level: 0, amount, interest: LOAN_INTEREST_RATE, duration: LOAN_DURATION_MS,
    })),
    loanInterestRate: loanInterest,
    loanVipInterestRate: banking?.vip_interest ?? LOAN_VIP_INTEREST_RATE,
    loanDurationMs: loanDuration,
    loanMinLevel: firstTier?.level ?? LOAN_MIN_LEVEL,

    // Daily
    dailyBase: daily?.min ?? DAILY_BASE,
    dailyMax: daily?.max ?? DAILY_BASE * 2,
    dailyCooldownMs: daily?.cooldown ?? DAILY_COOLDOWN_MS,

    // VIP
    dailyVipBonus: vip?.amount ?? DAILY_VIP_BONUS,
    vipCooldownMs: vip?.cooldown ?? DAILY_COOLDOWN_MS,

    // Salary
    monthlyAmount: salary?.amount ?? MONTHLY_AMOUNT,
    monthlyCooldownMs: salary?.cooldown ?? MONTHLY_COOLDOWN_MS,

    // Investment
    investmentMinAmount: inv?.min_amount ?? INVESTMENT_MIN_AMOUNT,
    investmentProfitRate: inv?.profit_rate ?? INVESTMENT_PROFIT_RATE,
    investmentMaturityMs: inv?.maturity_period ?? INVESTMENT_MATURITY_MS,
    investmentEarlyFee: inv?.early_withdrawal_fee ?? INVESTMENT_EARLY_FEE,
    investmentDepositLockMs: INVESTMENT_DEPOSIT_LOCK_MS,

    // Trade
    tradeMaxAmount: trade?.max_amount ?? TRADE_MAX_AMOUNT,
    tradeWinRate: trade?.win_rate ?? TRADE_WIN_RATE,
    tradeLossRate: trade?.loss_rate ?? TRADE_LOSS_RATE,
    tradeWinChance: trade?.win_chance ?? TRADE_WIN_CHANCE,
    tradeCooldownMs: trade?.cooldown ?? TRADE_COOLDOWN_MS,
    tradePresetAmounts: TRADE_PRESET_AMOUNTS,

    // Insurance
    insuranceCost: insurance?.cost ?? INSURANCE_COST,

    // Steal system
    stealSystem: steal ? {
      enabled: steal.enabled ?? false,
      chance: steal.chance ?? 0.5,
      min_amount: steal.min_amount ?? 100,
      max_amount: steal.max_amount ?? 5000,
      cooldown: steal.cooldown ?? 3600000,
    } : null,
  };
}
