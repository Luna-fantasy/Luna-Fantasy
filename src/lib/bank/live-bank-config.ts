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

export interface BankPersona {
  name: string;
  title: string;
  description: string;
  portrait: string;
  portraitVersion: number;
}

export interface BankInsurancePlan {
  name: string;
  type: string;
  price: number;
  duration: number;
}

export interface LiveBankConfig {
  // Persona (Avelle Adar) — dashboard-editable, may be null if no DB override yet
  persona: BankPersona | null;

  // Loans
  loanTiers: number[];
  loanTiersFull: Array<{ level: number; amount: number; interest: number; duration: number; passport_required?: boolean }>;
  loanInterestRate: number;
  loanVipInterestRate: number;
  loanDurationMs: number;
  loanMinLevel: number;

  // Daily
  dailyBase: number;
  dailyMax: number;
  dailyCooldownMs: number;

  // VIP / Investor (reads investor_reward first, falls back to legacy vip_reward)
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

  // Insurance — keep scalar insuranceCost for old consumers, but expose the full plan list too
  insuranceCost: number;
  insurancePlans: BankInsurancePlan[];

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

  // Extract loan tiers from the full tier objects — keep passport_required flag
  // so the loan route can enforce passport-gated tiers.
  const fullTiers: Array<{ level: number; amount: number; interest: number; duration: number; passport_required?: boolean }> =
    banking?.loan_tiers ?? [];
  const tierAmounts = fullTiers.length > 0
    ? fullTiers.map((t: any) => t.amount)
    : [...LOAN_TIERS];

  // Derive interest/duration from the first tier, or use defaults
  const firstTier = fullTiers[0];
  const loanInterest = firstTier?.interest ?? LOAN_INTEREST_RATE;
  const loanDuration = firstTier?.duration ?? LOAN_DURATION_MS;

  // Economy config — Butler's canonical shape is {amount, cooldown}. Legacy docs
  // may still carry {min, max, cooldown}; fall back to max then min so we never
  // show a stale zero while a migration is in flight.
  const daily = economy?.daily_reward;
  const dailyAmount = typeof daily?.amount === 'number'
    ? daily.amount
    : (typeof daily?.max === 'number' ? daily.max : (typeof daily?.min === 'number' ? daily.min : DAILY_BASE));

  const salary = economy?.salary;
  // Investor reward = new key; legacy key is vip_reward. Butler already reads
  // both with this precedence, so we mirror it for UI consistency.
  const investor = economy?.investor_reward ?? economy?.vip_reward;

  // Investment config
  const inv = banking?.investment;

  // Trade config
  const trade = banking?.trade_settings;

  // Insurance — Butler + dashboard both use insurance_types (array). Legacy
  // scalar `insurance.cost` is read as a last-resort fallback for old docs.
  const insuranceRaw = banking?.insurance_types;
  const insurancePlans: BankInsurancePlan[] = Array.isArray(insuranceRaw)
    ? insuranceRaw.map((p: any) => ({
        name: String(p?.name ?? ''),
        type: String(p?.type ?? ''),
        price: Number(p?.price ?? 0),
        duration: Number(p?.duration ?? -1),
      }))
    : [];
  const legacyInsuranceCost = typeof banking?.insurance?.cost === 'number' ? banking.insurance.cost : null;
  const insuranceCost = insurancePlans[0]?.price ?? legacyInsuranceCost ?? INSURANCE_COST;

  // Persona — dashboard writes under banking.persona; fall back to null so
  // callers can use their own hardcoded defaults if the DB has no override.
  const personaRaw = banking?.persona;
  const persona: BankPersona | null = personaRaw && typeof personaRaw === 'object'
    ? {
        name: String(personaRaw.name ?? ''),
        title: String(personaRaw.title ?? ''),
        description: String(personaRaw.description ?? ''),
        portrait: String(personaRaw.portrait ?? ''),
        portraitVersion: typeof personaRaw.portraitVersion === 'number' ? personaRaw.portraitVersion : 1,
      }
    : null;

  // Steal system config
  const steal = games?.steal_system;

  return {
    // Persona
    persona,

    // Loans
    loanTiers: tierAmounts,
    loanTiersFull: fullTiers.length > 0 ? fullTiers : LOAN_TIERS.map((amount) => ({
      level: 0, amount, interest: LOAN_INTEREST_RATE, duration: LOAN_DURATION_MS,
    })),
    loanInterestRate: loanInterest,
    loanVipInterestRate: banking?.investor_interest ?? banking?.vip_interest ?? LOAN_VIP_INTEREST_RATE,
    loanDurationMs: loanDuration,
    loanMinLevel: firstTier?.level ?? LOAN_MIN_LEVEL,

    // Daily — prefer canonical {amount}; keep dailyMax/dailyBase both set so
    // existing UI that still reads dailyMax (e.g. BalanceSummary hints) doesn't break.
    dailyBase: dailyAmount,
    dailyMax: dailyAmount,
    dailyCooldownMs: daily?.cooldown ?? DAILY_COOLDOWN_MS,

    // VIP / Investor
    dailyVipBonus: investor?.amount ?? DAILY_VIP_BONUS,
    vipCooldownMs: investor?.cooldown ?? DAILY_COOLDOWN_MS,

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
    insuranceCost,
    insurancePlans,

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
