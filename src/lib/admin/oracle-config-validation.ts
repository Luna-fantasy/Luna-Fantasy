/**
 * Server-side config value range validation for Oracle VC system.
 * Prevents API-level bypass of invalid values.
 */

interface ValidationError {
  field: string;
  message: string;
}

type Validator = (value: any) => ValidationError[];

const EXPECTED_BUTTON_KEYS = [
  'joinVc', 'leaveVc', 'lockRoom', 'unlockRoom', 'renameRoom',
  'setLimit', 'muteAll', 'unmuteAll', 'kickUser', 'banUser',
  'allowUser', 'transferOwner', 'closeRoom', 'openPanel',
  'startTrivia', 'startSowalef', 'whisper',
] as const;

const EXPECTED_AURA_TIERS = ['newcomer', 'regular', 'devoted', 'legendary', 'mythic'] as const;

function validateSetup(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  if (value.staffRoleIds !== undefined) {
    if (!Array.isArray(value.staffRoleIds)) {
      errors.push({ field: 'staffRoleIds', message: 'staffRoleIds must be an array' });
    } else {
      for (let i = 0; i < value.staffRoleIds.length; i++) {
        if (typeof value.staffRoleIds[i] !== 'string') {
          errors.push({ field: `staffRoleIds[${i}]`, message: 'Each staffRoleId must be a string' });
        }
      }
    }
  }

  // All numeric interval fields must be positive integers
  const numericFields = [
    'checkIntervalMs', 'cleanupIntervalMs', 'inactivityTimeoutMs',
    'maxTempRoomsPerUser', 'maxVipRoomsPerUser', 'gracePeriodMs',
  ];
  for (const f of numericFields) {
    if (value[f] !== undefined) {
      if (typeof value[f] !== 'number' || !Number.isInteger(value[f]) || value[f] <= 0) {
        errors.push({ field: f, message: `${f} must be a positive integer` });
      }
    }
  }

  if (typeof value.gracePeriodMs === 'number' && value.gracePeriodMs < 1000) {
    errors.push({ field: 'gracePeriodMs', message: 'gracePeriodMs must be >= 1000' });
  }

  if (typeof value.maxTempRoomsPerUser === 'number' && (value.maxTempRoomsPerUser < 1 || value.maxTempRoomsPerUser > 10)) {
    errors.push({ field: 'maxTempRoomsPerUser', message: 'maxTempRoomsPerUser must be 1-10' });
  }

  if (typeof value.maxVipRoomsPerUser === 'number' && (value.maxVipRoomsPerUser < 1 || value.maxVipRoomsPerUser > 5)) {
    errors.push({ field: 'maxVipRoomsPerUser', message: 'maxVipRoomsPerUser must be 1-5' });
  }

  return errors;
}

function validateGamesTrivia(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!Array.isArray(value)) return [{ field: 'root', message: 'Must be an array' }];

  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'object' || item === null) {
      errors.push({ field: `[${i}]`, message: 'Each item must be an object' });
      continue;
    }
    if (typeof item.q !== 'string' || item.q.trim().length === 0) {
      errors.push({ field: `[${i}].q`, message: 'q must be a non-empty string' });
    }
    if (!Array.isArray(item.answers) || item.answers.length !== 4) {
      errors.push({ field: `[${i}].answers`, message: 'answers must be an array of exactly 4 items' });
    } else {
      for (let j = 0; j < item.answers.length; j++) {
        if (typeof item.answers[j] !== 'string' || item.answers[j].trim().length === 0) {
          errors.push({ field: `[${i}].answers[${j}]`, message: 'Each answer must be a non-empty string' });
        }
      }
    }
    if (typeof item.correct !== 'number' || !Number.isInteger(item.correct) || item.correct < 0 || item.correct > 3) {
      errors.push({ field: `[${i}].correct`, message: 'correct must be an integer 0-3' });
    }
  }

  return errors;
}

function validateGamesSowalef(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!Array.isArray(value)) return [{ field: 'root', message: 'Must be an array' }];

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string' || value[i].trim().length === 0) {
      errors.push({ field: `[${i}]`, message: 'Each item must be a non-empty string' });
    }
  }

  return errors;
}

function validateGamesSettings(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  // Reward min/max pairs
  const rewardPairs = [
    ['triviaRewardMin', 'triviaRewardMax'],
    ['sowalefRewardMin', 'sowalefRewardMax'],
    ['mathRewardMin', 'mathRewardMax'],
  ];
  for (const [minF, maxF] of rewardPairs) {
    if (value[minF] !== undefined && typeof value[minF] === 'number' && value[minF] < 0) {
      errors.push({ field: minF, message: `${minF} must be >= 0` });
    }
    if (value[maxF] !== undefined && typeof value[maxF] === 'number' && value[maxF] < 0) {
      errors.push({ field: maxF, message: `${maxF} must be >= 0` });
    }
    if (typeof value[minF] === 'number' && typeof value[maxF] === 'number' && value[minF] > value[maxF]) {
      errors.push({ field: `${minF}/${maxF}`, message: `${minF} must be <= ${maxF}` });
    }
  }

  // All timeout fields must be positive
  const timeoutFields = ['triviaTimeoutMs', 'sowalefTimeoutMs', 'mathTimeoutMs', 'cooldownMs'];
  for (const f of timeoutFields) {
    if (value[f] !== undefined) {
      if (typeof value[f] !== 'number' || value[f] <= 0) {
        errors.push({ field: f, message: `${f} must be positive` });
      }
    }
  }

  // streakBonuses must have keys "3", "5", "10" with positive values
  if (value.streakBonuses !== undefined) {
    if (typeof value.streakBonuses !== 'object' || value.streakBonuses === null) {
      errors.push({ field: 'streakBonuses', message: 'streakBonuses must be an object' });
    } else {
      const requiredKeys = ['3', '5', '10'];
      const actualKeys = Object.keys(value.streakBonuses);
      for (const k of requiredKeys) {
        if (!(k in value.streakBonuses)) {
          errors.push({ field: `streakBonuses.${k}`, message: `streakBonuses must have key "${k}"` });
        } else if (typeof value.streakBonuses[k] !== 'number' || value.streakBonuses[k] <= 0) {
          errors.push({ field: `streakBonuses.${k}`, message: `streakBonuses["${k}"] must be a positive number` });
        }
      }
      for (const k of actualKeys) {
        if (!requiredKeys.includes(k)) {
          errors.push({ field: `streakBonuses.${k}`, message: `Unexpected key "${k}" in streakBonuses` });
        }
      }
    }
  }

  return errors;
}

function validateContentWelcome(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!Array.isArray(value)) return [{ field: 'root', message: 'Must be an array' }];

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string' || value[i].trim().length === 0) {
      errors.push({ field: `[${i}]`, message: 'Each greeting must be a non-empty string' });
    } else if (!value[i].includes('{name}')) {
      errors.push({ field: `[${i}]`, message: 'Each greeting must contain {name}' });
    }
  }

  return errors;
}

function validateContentPanel(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  for (const key of ['line1', 'line2', 'line3', 'line4']) {
    if (typeof value[key] !== 'string' || value[key].trim().length === 0) {
      errors.push({ field: key, message: `${key} must be a non-empty string` });
    }
  }

  return errors;
}

function validateContentButtons(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  for (const key of EXPECTED_BUTTON_KEYS) {
    if (typeof value[key] !== 'string' || value[key].trim().length === 0) {
      errors.push({ field: key, message: `${key} must be a non-empty string` });
    }
  }

  return errors;
}

function validateContentAura(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  // auraTiers: must have all 5 tier keys
  if (value.auraTiers !== undefined) {
    if (typeof value.auraTiers !== 'object' || value.auraTiers === null) {
      errors.push({ field: 'auraTiers', message: 'auraTiers must be an object' });
    } else {
      for (const tier of EXPECTED_AURA_TIERS) {
        if (!(tier in value.auraTiers)) {
          errors.push({ field: `auraTiers.${tier}`, message: `auraTiers must have key "${tier}"` });
        }
      }
    }
  }

  // auraThresholds: must have ascending values
  if (value.auraThresholds !== undefined) {
    if (typeof value.auraThresholds !== 'object' || value.auraThresholds === null) {
      errors.push({ field: 'auraThresholds', message: 'auraThresholds must be an object' });
    } else {
      const entries = Object.entries(value.auraThresholds)
        .map(([k, v]) => [k, v as number] as const)
        .filter(([, v]) => typeof v === 'number');
      for (let i = 1; i < entries.length; i++) {
        if (entries[i][1] <= entries[i - 1][1]) {
          errors.push({
            field: `auraThresholds.${entries[i][0]}`,
            message: `auraThresholds values must be ascending (${entries[i][0]}: ${entries[i][1]} <= ${entries[i - 1][0]}: ${entries[i - 1][1]})`,
          });
        }
      }
    }
  }

  // auraWeights: all values must be positive
  if (value.auraWeights !== undefined) {
    if (typeof value.auraWeights !== 'object' || value.auraWeights === null) {
      errors.push({ field: 'auraWeights', message: 'auraWeights must be an object' });
    } else {
      for (const [k, v] of Object.entries(value.auraWeights)) {
        if (typeof v !== 'number' || v <= 0) {
          errors.push({ field: `auraWeights.${k}`, message: `auraWeights["${k}"] must be a positive number` });
        }
      }
    }
  }

  return errors;
}

function validateContentWhisper(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  if (value.colors !== undefined) {
    if (!Array.isArray(value.colors)) {
      errors.push({ field: 'colors', message: 'colors must be an array' });
    } else {
      for (let i = 0; i < value.colors.length; i++) {
        if (typeof value.colors[i] !== 'number') {
          errors.push({ field: `colors[${i}]`, message: 'Each color must be a number' });
        }
      }
    }
  }

  if (value.cooldownMs !== undefined) {
    if (typeof value.cooldownMs !== 'number' || value.cooldownMs <= 0) {
      errors.push({ field: 'cooldownMs', message: 'cooldownMs must be a positive number' });
    }
  }

  return errors;
}

function validateVip(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  for (const [tierName, tier] of Object.entries(value)) {
    if (typeof tier !== 'object' || tier === null) {
      errors.push({ field: tierName, message: `${tierName} must be an object` });
      continue;
    }
    const t = tier as any;
    if (typeof t.cost !== 'number' || t.cost <= 0) {
      errors.push({ field: `${tierName}.cost`, message: `${tierName}.cost must be positive` });
    }
    if (typeof t.days !== 'number' || t.days <= 0) {
      errors.push({ field: `${tierName}.days`, message: `${tierName}.days must be positive` });
    }
    if (t.renewDiscountPercent !== undefined) {
      if (typeof t.renewDiscountPercent !== 'number' || t.renewDiscountPercent < 0 || t.renewDiscountPercent > 100) {
        errors.push({ field: `${tierName}.renewDiscountPercent`, message: `${tierName}.renewDiscountPercent must be 0-100` });
      }
    }
  }

  return errors;
}

function validateAssets(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];

  if (value.panelBannerUrl !== undefined && typeof value.panelBannerUrl !== 'string') {
    errors.push({ field: 'panelBannerUrl', message: 'panelBannerUrl must be a string' });
  }

  return errors;
}

const ORACLE_VALIDATORS: Record<string, Validator> = {
  setup: validateSetup,
  games_trivia: validateGamesTrivia,
  games_sowalef: validateGamesSowalef,
  games_settings: validateGamesSettings,
  content_welcome: validateContentWelcome,
  content_panel: validateContentPanel,
  content_buttons: validateContentButtons,
  content_aura: validateContentAura,
  content_whisper: validateContentWhisper,
  vip: validateVip,
  assets: validateAssets,
};

/**
 * Validates an Oracle config section value.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateOracleConfig(section: string, value: any): string | null {
  const validator = ORACLE_VALIDATORS[section];
  if (!validator) return null;
  const errors = validator(value);
  if (errors.length === 0) return null;
  return errors.map(e => e.message).join('; ');
}
