/**
 * Server-side config value validation for Oracle VC system.
 * Key names match the seed script + bot schema exactly.
 */

const EXPECTED_BUTTON_KEYS = [
  'lock', 'unlock', 'hide', 'limit', 'region', 'trust',
  'ban', 'kick', 'claim', 'transfer', 'whisper', 'save',
  'load', 'math', 'trivia', 'react', 'sowalef',
] as const;

const EXPECTED_AURA_TIERS = ['dormant', 'flickering', 'glowing', 'radiant', 'blazing'] as const;
const EXPECTED_AURA_THRESHOLDS = ['flickering', 'glowing', 'radiant', 'blazing'] as const;
const EXPECTED_AURA_WEIGHTS = [
  'warmthPerVisitor', 'warmthMax', 'energyDivisor', 'energyMax',
  'harmonyPerMin', 'harmonyMax', 'loyaltyMax',
] as const;

function posInt(v: unknown): boolean { return typeof v === 'number' && Number.isInteger(v) && v > 0; }
function posNum(v: unknown): boolean { return typeof v === 'number' && v > 0; }

function validateSetup(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';

  if (value.staffRoleIds !== undefined) {
    if (!Array.isArray(value.staffRoleIds)) return 'staffRoleIds must be an array';
    if (value.staffRoleIds.some((r: any) => typeof r !== 'string')) return 'Each staffRoleId must be a string';
  }

  const intervals = ['gracePeriodMs', 'welcomeCooldownMs', 'challengeIntervalMs', 'auraUpdateIntervalMs', 'panelAutoRefreshMs'];
  for (const f of intervals) {
    if (value[f] !== undefined && !posInt(value[f])) return `${f} must be a positive integer`;
  }
  if (typeof value.gracePeriodMs === 'number' && value.gracePeriodMs < 1000) return 'gracePeriodMs must be >= 1000';
  if (typeof value.maxTempRoomsPerUser === 'number' && (value.maxTempRoomsPerUser < 1 || value.maxTempRoomsPerUser > 10)) return 'maxTempRoomsPerUser must be 1-10';
  if (typeof value.maxVipRoomsPerUser === 'number' && (value.maxVipRoomsPerUser < 1 || value.maxVipRoomsPerUser > 5)) return 'maxVipRoomsPerUser must be 1-5';
  if (typeof value.challengeMinMembers === 'number' && (value.challengeMinMembers < 1 || value.challengeMinMembers > 25)) return 'challengeMinMembers must be 1-25';

  return null;
}

function validateGamesTrivia(value: any): string | null {
  if (!Array.isArray(value)) return 'Must be an array';
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'object' || item === null) return `Item ${i}: must be an object`;
    if (typeof item.q !== 'string' || item.q.trim().length === 0) return `Item ${i}: q must be non-empty`;
    if (!Array.isArray(item.answers) || item.answers.length !== 4) return `Item ${i}: must have exactly 4 answers`;
    if (item.answers.some((a: any) => typeof a !== 'string' || a.trim().length === 0)) return `Item ${i}: all answers must be non-empty strings`;
    if (typeof item.correct !== 'number' || !Number.isInteger(item.correct) || item.correct < 0 || item.correct > 3) return `Item ${i}: correct must be 0-3`;
  }
  return null;
}

function validateGamesSowalef(value: any): string | null {
  if (!Array.isArray(value)) return 'Must be an array';
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string' || value[i].trim().length === 0) return `Item ${i}: must be non-empty string`;
  }
  return null;
}

function validateGamesSettings(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';

  // Nested reward pairs
  if (value.triviaReward) {
    const r = value.triviaReward;
    if (typeof r.autoDropMin === 'number' && typeof r.autoDropMax === 'number' && r.autoDropMin > r.autoDropMax) return 'triviaReward: autoDropMin must be <= autoDropMax';
    if (typeof r.miniMin === 'number' && typeof r.miniMax === 'number' && r.miniMin > r.miniMax) return 'triviaReward: miniMin must be <= miniMax';
  }
  if (value.mathOps) {
    const m = value.mathOps;
    if (typeof m.rewardMin === 'number' && typeof m.rewardMax === 'number' && m.rewardMin > m.rewardMax) return 'mathOps: rewardMin must be <= rewardMax';
    if (m.timeoutMs !== undefined && !posInt(m.timeoutMs)) return 'mathOps.timeoutMs must be positive';
  }
  if (value.quickReact) {
    const q = value.quickReact;
    if (typeof q.rewardMin === 'number' && typeof q.rewardMax === 'number' && q.rewardMin > q.rewardMax) return 'quickReact: rewardMin must be <= rewardMax';
    if (q.timeoutMs !== undefined && !posInt(q.timeoutMs)) return 'quickReact.timeoutMs must be positive';
  }

  // Timeouts
  for (const f of ['triviaTimeoutMs', 'gameCooldownMs', 'endCooldownMs', 'sowalefDebounceMs']) {
    if (value[f] !== undefined && !posInt(value[f])) return `${f} must be a positive integer`;
  }

  // Streak bonuses
  if (value.streakBonuses) {
    if (typeof value.streakBonuses !== 'object') return 'streakBonuses must be an object';
    for (const k of ['3', '5', '10']) {
      if (value.streakBonuses[k] !== undefined && !posNum(value.streakBonuses[k])) return `streakBonuses["${k}"] must be positive`;
    }
  }

  // Aura reward multipliers
  if (value.auraRewardMultipliers) {
    if (typeof value.auraRewardMultipliers !== 'object') return 'auraRewardMultipliers must be an object';
    for (const tier of ['dormant', 'flickering', 'glowing', 'radiant', 'blazing']) {
      const v = value.auraRewardMultipliers[tier];
      if (v !== undefined && (typeof v !== 'number' || v < 0 || v > 5)) return `auraRewardMultipliers.${tier} must be 0-5`;
    }
  }

  // Boss challenge
  if (value.bossChallenge) {
    const bc = value.bossChallenge;
    if (typeof bc !== 'object') return 'bossChallenge must be an object';
    if (typeof bc.rewardMin === 'number' && typeof bc.rewardMax === 'number' && bc.rewardMin > bc.rewardMax) return 'bossChallenge: rewardMin must be <= rewardMax';
    if (bc.cooldownHours !== undefined && (!posNum(bc.cooldownHours) || bc.cooldownHours > 168)) return 'bossChallenge.cooldownHours must be 1-168';
    if (bc.questionCount !== undefined && (!posInt(bc.questionCount) || bc.questionCount > 20)) return 'bossChallenge.questionCount must be 1-20';
  }

  return null;
}

function validateContentWelcome(value: any): string | null {
  if (!Array.isArray(value)) return 'Must be an array';
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string' || value[i].trim().length === 0) return `Greeting ${i}: must be non-empty`;
    if (!value[i].includes('{name}')) return `Greeting ${i}: must contain {name}`;
  }
  return null;
}

function validateContentPanel(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';
  for (const key of ['line1', 'line2', 'line3', 'line4']) {
    if (typeof value[key] !== 'string' || value[key].trim().length === 0) return `${key} must be non-empty`;
  }
  return null;
}

function validateContentButtons(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';
  for (const key of EXPECTED_BUTTON_KEYS) {
    if (typeof value[key] !== 'string' || value[key].trim().length === 0) return `Button "${key}" must be non-empty`;
    if (value[key].length > 80) return `Button "${key}" exceeds Discord's 80-character limit`;
  }
  return null;
}

function validateContentAura(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';

  if (value.auraTiers) {
    for (const tier of EXPECTED_AURA_TIERS) {
      if (typeof value.auraTiers[tier] !== 'string') return `auraTiers.${tier} must be a string`;
    }
  }
  if (value.auraThresholds) {
    let prev = -1;
    for (const key of EXPECTED_AURA_THRESHOLDS) {
      const v = value.auraThresholds[key];
      if (typeof v !== 'number' || v <= 0) return `auraThresholds.${key} must be positive`;
      if (v <= prev) return `auraThresholds must be ascending (${key}: ${v} must be > ${prev})`;
      prev = v;
    }
  }
  if (value.auraWeights) {
    for (const key of EXPECTED_AURA_WEIGHTS) {
      if (typeof value.auraWeights[key] !== 'number' || value.auraWeights[key] < 0) return `auraWeights.${key} must be >= 0`;
    }
  }

  return null;
}

function validateContentWhisper(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';
  if (value.colors !== undefined && !Array.isArray(value.colors)) return 'colors must be an array';
  if (value.cooldownMs !== undefined && !posInt(value.cooldownMs)) return 'cooldownMs must be positive';
  if (value.autoCleanupMs !== undefined && !posInt(value.autoCleanupMs)) return 'autoCleanupMs must be positive';
  if (value.modalTitle !== undefined && typeof value.modalTitle === 'string' && value.modalTitle.trim().length === 0) return 'modalTitle must be non-empty';
  if (value.modalPlaceholder !== undefined && typeof value.modalPlaceholder === 'string' && value.modalPlaceholder.trim().length === 0) return 'modalPlaceholder must be non-empty';
  return null;
}

function validateContentExpiry(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';
  for (const key of ['trivia', 'math', 'emoji_race', 'quickreact', 'endurance']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return `${key} must be a string`;
  }
  return null;
}

function validateVip(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';

  if (value.tiers) {
    for (const [name, tier] of Object.entries(value.tiers)) {
      const t = tier as any;
      if (typeof t !== 'object' || t === null) return `tiers.${name} must be an object`;
      if (typeof t.cost === 'number' && t.cost <= 0) return `tiers.${name}.cost must be positive`;
      if (typeof t.days === 'number' && t.days <= 0) return `tiers.${name}.days must be positive`;
    }
  }
  if (typeof value.renewDiscountPercent === 'number' && (value.renewDiscountPercent < 0 || value.renewDiscountPercent > 100)) return 'renewDiscountPercent must be 0-100';
  if (value.expiryWarningHours !== undefined && !posNum(value.expiryWarningHours)) return 'expiryWarningHours must be positive';
  if (value.graceAfterExpiryMs !== undefined && !posInt(value.graceAfterExpiryMs)) return 'graceAfterExpiryMs must be positive';

  return null;
}

function validateAssets(value: any): string | null {
  if (typeof value !== 'object' || value === null) return 'Must be an object';
  if (value.panelBannerUrl !== undefined && typeof value.panelBannerUrl !== 'string') return 'panelBannerUrl must be a string';
  return null;
}

const ORACLE_VALIDATORS: Record<string, (value: any) => string | null> = {
  setup: validateSetup,
  games_trivia: validateGamesTrivia,
  games_sowalef: validateGamesSowalef,
  games_settings: validateGamesSettings,
  content_welcome: validateContentWelcome,
  content_panel: validateContentPanel,
  content_buttons: validateContentButtons,
  content_aura: validateContentAura,
  content_whisper: validateContentWhisper,
  content_expiry: validateContentExpiry,
  vip: validateVip,
  assets: validateAssets,
};

export function validateOracleConfig(section: string, value: any): string | null {
  const validator = ORACLE_VALIDATORS[section];
  if (!validator) return null;
  return validator(value);
}
