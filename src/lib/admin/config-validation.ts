/**
 * Server-side config value range validation.
 * Prevents API-level bypass of invalid values (negative XP, zero cooldowns, min > max, etc.)
 */

interface ValidationError {
  field: string;
  message: string;
}

type Validator = (value: any) => ValidationError[];

// Validates that numeric fields are >= 0
function nonNegative(value: any, fields: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return errors;
  for (const f of fields) {
    if (value[f] !== undefined && typeof value[f] === 'number' && value[f] < 0) {
      errors.push({ field: f, message: `${f} must be >= 0` });
    }
  }
  return errors;
}

// Validates that numeric fields are > 0
function positive(value: any, fields: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return errors;
  for (const f of fields) {
    if (value[f] !== undefined && typeof value[f] === 'number' && value[f] <= 0) {
      errors.push({ field: f, message: `${f} must be > 0` });
    }
  }
  return errors;
}

// Validates that min <= max for a pair of fields
function minMax(value: any, minField: string, maxField: string): ValidationError[] {
  if (typeof value !== 'object' || value === null) return [];
  const min = value[minField];
  const max = value[maxField];
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    return [{ field: `${minField}/${maxField}`, message: `${minField} must be <= ${maxField}` }];
  }
  return [];
}

// Validates string fields don't exceed max length
function stringMaxLength(value: any, fields: string[], max: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return errors;
  for (const f of fields) {
    if (value[f] !== undefined && typeof value[f] === 'string' && value[f].length > max) {
      errors.push({ field: f, message: `${f} must be at most ${max} characters` });
    }
  }
  return errors;
}

// Validates URL fields are valid URLs (if present and non-empty)
function validUrl(value: any, fields: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return errors;
  for (const f of fields) {
    if (value[f] !== undefined && typeof value[f] === 'string' && value[f].length > 0) {
      try {
        const url = new URL(value[f]);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push({ field: f, message: `${f} must use http or https` });
        }
      } catch {
        errors.push({ field: f, message: `${f} must be a valid URL` });
      }
    }
  }
  return errors;
}

// Validates rate fields are between 0 and 1
function rate01(value: any, fields: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return errors;
  for (const f of fields) {
    if (value[f] !== undefined && typeof value[f] === 'number' && (value[f] < 0 || value[f] > 1)) {
      errors.push({ field: f, message: `${f} must be between 0 and 1` });
    }
  }
  return errors;
}

// Validates loan tiers array
function validateLoanTiers(value: any): ValidationError[] {
  if (!Array.isArray(value)) return [];
  const errors: ValidationError[] = [];
  for (let i = 0; i < value.length; i++) {
    const tier = value[i];
    if (typeof tier !== 'object' || tier === null) continue;
    if (typeof tier.level === 'number' && tier.level < 0) errors.push({ field: `tier[${i}].level`, message: 'Level must be >= 0' });
    if (typeof tier.amount === 'number' && tier.amount < 0) errors.push({ field: `tier[${i}].amount`, message: 'Amount must be >= 0' });
    if (typeof tier.interest === 'number' && (tier.interest < 0 || tier.interest > 1)) errors.push({ field: `tier[${i}].interest`, message: 'Interest must be between 0 and 1' });
    if (typeof tier.duration === 'number' && tier.duration <= 0) errors.push({ field: `tier[${i}].duration`, message: 'Duration must be > 0' });
  }
  return errors;
}

// Validates a commands config object (both Butler and Jester)
function validateCommandsConfig(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];
  const allTriggers = new Map<string, string>(); // trigger → command key (for duplicate detection)
  for (const [key, cmd] of Object.entries(value)) {
    const c = cmd as any;
    if (!c || typeof c !== 'object') { errors.push({ field: key, message: 'Must be an object' }); continue; }
    if (typeof c.enabled !== 'boolean') errors.push({ field: `${key}.enabled`, message: 'enabled must be boolean' });
    if (!Array.isArray(c.allowedRoles)) {
      errors.push({ field: `${key}.allowedRoles`, message: 'allowedRoles must be an array' });
    } else {
      if (c.allowedRoles.length > 25)
        errors.push({ field: `${key}.allowedRoles`, message: 'Max 25 roles per command' });
      for (const r of c.allowedRoles) {
        if (typeof r !== 'string' || !/^\d{17,20}$/.test(r))
          errors.push({ field: `${key}.allowedRoles`, message: 'Invalid Discord role ID' });
      }
    }
    if (!Array.isArray(c.triggers)) { errors.push({ field: `${key}.triggers`, message: 'triggers must be an array' }); continue; }
    if (c.triggers.length === 0) errors.push({ field: `${key}.triggers`, message: 'Must have at least one trigger' });
    if (c.triggers.length > 10) errors.push({ field: `${key}.triggers`, message: 'Max 10 triggers per command' });
    for (let i = 0; i < c.triggers.length; i++) {
      const t = c.triggers[i];
      if (typeof t !== 'string' || t.length === 0 || t.length > 50)
        errors.push({ field: `${key}.triggers[${i}]`, message: 'Trigger must be 1-50 chars' });
      if (typeof t === 'string' && t.includes(' '))
        errors.push({ field: `${key}.triggers[${i}]`, message: 'Trigger cannot contain spaces' });
      if (typeof t === 'string') {
        const lower = t.toLowerCase();
        if (allTriggers.has(lower))
          errors.push({ field: `${key}.triggers[${i}]`, message: `Duplicate trigger "${t}" (also used by "${allTriggers.get(lower)}")` });
        else allTriggers.set(lower, key);
      }
    }
  }
  return errors;
}

// Validates badge thresholds config
function validateBadgeThresholds(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];
  for (const key of ['million', 'text_messages', 'voice_seconds', 'game_wins', 'la_luna_level']) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'number' || value[key] < 0) errors.push({ field: key, message: `${key} must be >= 0` });
      if (typeof value[key] === 'number' && !Number.isInteger(value[key])) errors.push({ field: key, message: `${key} must be an integer` });
    }
  }
  return errors;
}

// Section-specific validators for Butler config
const BUTLER_VALIDATORS: Record<string, Validator> = {
  daily_reward: (v) => [...nonNegative(v, ['amount']), ...positive(v, ['cooldown'])],
  salary: (v) => [...nonNegative(v, ['amount']), ...positive(v, ['cooldown'])],
  vip_reward: (v) => [...nonNegative(v, ['amount']), ...positive(v, ['cooldown'])],
  investor_reward: (v) => [...nonNegative(v, ['amount']), ...positive(v, ['cooldown'])],
  investor_interest: (v) => {
    const errs: ValidationError[] = [];
    if (typeof v !== 'number' || !Number.isFinite(v)) errs.push({ field: 'root', message: 'Must be a number' });
    else if (v < 0 || v > 1) errs.push({ field: 'root', message: 'Interest rate must be between 0 and 1 (e.g. 0.15 = 15%)' });
    return errs;
  },
  notifications: (v) => {
    const errs: ValidationError[] = [];
    if (typeof v !== 'object' || v === null) errs.push({ field: 'root', message: 'Must be an object' });
    return errs;
  },
  text_xp: (v) => [
    ...nonNegative(v, ['min', 'max']),
    ...positive(v, ['cooldown']),
    ...minMax(v, 'min', 'max'),
  ],
  voice_xp: (v) => [...nonNegative(v, ['xp_per_minute']), ...positive(v, ['check_interval'])],
  loan_tiers: validateLoanTiers,
  investment: (v) => [
    ...rate01(v, ['profit_rate', 'early_withdrawal_fee']),
    ...nonNegative(v, ['min_amount']),
    ...positive(v, ['maturity_period', 'check_interval']),
  ],
  steal_system: (v) => [
    ...nonNegative(v, ['min_percentage', 'max_percentage']),
    ...positive(v, ['cooldown']),
    ...minMax(v, 'min_percentage', 'max_percentage'),
    ...stringMaxLength(v, ['success_title', 'fail_title', 'success_footer'], 256),
    ...stringMaxLength(v, ['fail_description'], 1000),
    ...validUrl(v, ['success_image', 'fail_image']),
  ],
  commands: validateCommandsConfig,
  badge_thresholds: validateBadgeThresholds,
};

// Validates a shop config object (Brimor, Broker)
function validateShopConfig(value: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof value !== 'object' || value === null) return [{ field: 'root', message: 'Must be an object' }];
  if (typeof value.title === 'string' && value.title.length > 100)
    errors.push({ field: 'title', message: 'Title must be at most 100 chars' });
  if (typeof value.description === 'string' && value.description.length > 500)
    errors.push({ field: 'description', message: 'Description must be at most 500 chars' });
  if (value.image) errors.push(...validUrl({ image: value.image }, ['image']));
  if (Array.isArray(value.items)) {
    for (let i = 0; i < value.items.length; i++) {
      const item = value.items[i];
      if (!item.name || typeof item.name !== 'string')
        errors.push({ field: `items[${i}].name`, message: 'Name required' });
      if (typeof item.price !== 'number' || item.price < 1 || item.price > 10_000_000)
        errors.push({ field: `items[${i}].price`, message: 'Price must be 1–10,000,000' });
    }
  }
  return errors;
}

// Section-specific validators for Jester config
const JESTER_VALIDATORS: Record<string, Validator> = {
  commands: validateCommandsConfig,
  shop_brimor: validateShopConfig,
  shop_broker: validateShopConfig,
  trade: (v) => {
    const errors: ValidationError[] = [];
    if (typeof v !== 'object' || v === null) return errors;
    if (v.auction_duration_ms !== undefined) {
      if (typeof v.auction_duration_ms !== 'number') errors.push({ field: 'auction_duration_ms', message: 'Must be a number' });
      else if (v.auction_duration_ms < 3_600_000) errors.push({ field: 'auction_duration_ms', message: 'Must be at least 1 hour (3600000ms)' });
      else if (v.auction_duration_ms > 604_800_000) errors.push({ field: 'auction_duration_ms', message: 'Must be at most 7 days (604800000ms)' });
    }
    return errors;
  },
  seluna_schedule: (v) => [
    ...positive(v, ['duration_hours', 'reappear_days']),
  ],
  points_settings: (v) => {
    const errors: ValidationError[] = [];
    if (typeof v !== 'object' || v === null) return errors;
    for (const [key, val] of Object.entries(v)) {
      if (typeof val === 'number' && val < 0) {
        errors.push({ field: key, message: `${key} must be >= 0` });
      }
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const tier = val[i] as any;
          if (typeof tier?.points === 'number' && tier.points < 0) {
            errors.push({ field: `${key}[${i}].points`, message: 'Points must be >= 0' });
          }
          if (typeof tier?.players === 'number' && tier.players < 1) {
            errors.push({ field: `${key}[${i}].players`, message: 'Players must be >= 1' });
          }
        }
      }
    }
    return errors;
  },
};

/**
 * Validates a config section value. Returns null if valid, or an error message string if invalid.
 */
export function validateButlerConfig(section: string, value: any): string | null {
  const validator = BUTLER_VALIDATORS[section];
  if (!validator) return null;
  const errors = validator(value);
  if (errors.length === 0) return null;
  return errors.map(e => e.message).join('; ');
}

export function validateJesterConfig(section: string, value: any): string | null {
  const validator = JESTER_VALIDATORS[section];
  if (!validator) return null;
  const errors = validator(value);
  if (errors.length === 0) return null;
  return errors.map(e => e.message).join('; ');
}
