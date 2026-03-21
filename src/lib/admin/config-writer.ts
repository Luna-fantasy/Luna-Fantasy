import { readFile, writeFile } from 'fs/promises';
import { execFileSync } from 'child_process';

const BUTLER_PATH = process.env.BUTLER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaButlerMain';
const JESTER_PATH = process.env.JESTER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaJesterMain';

// ── Read config files ──

export async function readButlerConfig(): Promise<string> {
  return readFile(`${BUTLER_PATH}/config.ts`, 'utf-8');
}

export async function readJesterConfig(): Promise<string> {
  return readFile(`${JESTER_PATH}/config.ts`, 'utf-8');
}

// ── Parse specific config sections from Butler ──

interface DailyRewardConfig {
  min: number;
  max: number;
  cooldown: number;
}

interface SalaryConfig {
  amount: number;
  cooldown: number;
}

interface VipRewardConfig {
  amount: number;
  cooldown: number;
}

interface TextXpConfig {
  min: number;
  max: number;
  cooldown: number;
}

interface VoiceXpConfig {
  enabled: boolean;
  xp_per_minute: number;
  require_mic: boolean;
  check_interval: number;
}

interface GameConfig {
  enabled: boolean;
  [key: string]: any;
}

interface LoanTier {
  level: number;
  amount: number;
  interest: number;
  duration: number;
}

interface InvestmentConfig {
  maturity_period: number;
  profit_rate: number;
  min_amount: number;
  early_withdrawal_fee: number;
  check_interval: number;
}

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  roleId: string;
  backgroundUrl: string;
}

export interface ButlerConfigSections {
  daily_reward?: DailyRewardConfig;
  salary?: SalaryConfig;
  vip_reward?: VipRewardConfig;
  text_xp?: TextXpConfig;
  voice_xp?: VoiceXpConfig;
  boosted_roles?: Record<string, number>;
  level_rewards?: Record<string, string[]>;
  xo_game?: GameConfig;
  rps_game?: GameConfig;
  connect4_game?: GameConfig;
  coinflip_game?: GameConfig;
  hunt_game?: GameConfig;
  roulette_game?: GameConfig;
  luna21_game?: GameConfig;
  steal_system?: GameConfig;
  loan_tiers?: LoanTier[];
  investment?: InvestmentConfig;
  shop_items?: ShopItem[];
}

/**
 * Extract a JSON-like object block from config source by key name.
 * Uses brace counting to find the complete block.
 */
function extractBlock(source: string, key: string): { value: string; start: number; end: number } | null {
  // Match patterns like "key": { or "key": [
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*\\{`),
    new RegExp(`"${key}"\\s*:\\s*\\[`),
    new RegExp(`${key}\\s*:\\s*\\{`),
    new RegExp(`${key}\\s*:\\s*\\[`),
  ];

  let match: RegExpExecArray | null = null;
  let openChar = '{';
  for (const pat of patterns) {
    match = pat.exec(source);
    if (match) {
      openChar = source[match.index + match[0].length - 1];
      break;
    }
  }
  if (!match) return null;

  const closeChar = openChar === '{' ? '}' : ']';
  const blockStart = match.index + match[0].length - 1; // position of { or [
  let depth = 1;
  let i = blockStart + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === openChar) depth++;
    else if (ch === closeChar) depth--;
    // Skip string contents
    if (ch === '"') {
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') i++; // skip escaped char
        i++;
      }
    }
    i++;
  }

  if (depth !== 0) return null;

  const value = source.slice(blockStart, i);
  return { value, start: blockStart, end: i };
}

/**
 * Extract a simple numeric or boolean value from config by key.
 */
function extractSimpleValue(source: string, key: string): { value: string; start: number; end: number } | null {
  const regex = new RegExp(`"${key}"\\s*:\\s*([\\d.]+|true|false)`);
  const match = regex.exec(source);
  if (!match) return null;
  const valStart = match.index + match[0].length - match[1].length;
  return { value: match[1], start: valStart, end: valStart + match[1].length };
}

/**
 * Parse Butler config sections from file content.
 */
export function parseButlerConfig(content: string): ButlerConfigSections {
  const result: ButlerConfigSections = {};

  // Parse simple object sections
  const sections: Array<{ key: string; field: keyof ButlerConfigSections }> = [
    { key: 'daily_reward', field: 'daily_reward' },
    { key: 'salary', field: 'salary' },
    { key: 'vip_reward', field: 'vip_reward' },
  ];

  for (const { key, field } of sections) {
    const block = extractBlock(content, key);
    if (block) {
      try {
        // Clean TS-specific syntax for JSON parsing
        const cleaned = cleanTsForJson(block.value);
        (result as any)[field] = JSON.parse(cleaned);
      } catch { /* skip unparseable */ }
    }
  }

  // Parse nested level_system sections
  const textXp = extractBlock(content, 'text_xp');
  if (textXp) {
    try { result.text_xp = JSON.parse(cleanTsForJson(textXp.value)); } catch {}
  }

  const voiceXp = extractBlock(content, 'voice_xp');
  if (voiceXp) {
    try { result.voice_xp = JSON.parse(cleanTsForJson(voiceXp.value)); } catch {}
  }

  const boostedRoles = extractBlock(content, 'boosted_roles');
  if (boostedRoles) {
    try { result.boosted_roles = JSON.parse(cleanTsForJson(boostedRoles.value)); } catch {}
  }

  const levelRewards = extractBlock(content, 'level_rewards');
  if (levelRewards) {
    try { result.level_rewards = JSON.parse(cleanTsForJson(levelRewards.value)); } catch {}
  }

  // Parse game configs
  const games: Array<{ key: string; field: keyof ButlerConfigSections }> = [
    { key: 'xo_game', field: 'xo_game' },
    { key: 'rps_game', field: 'rps_game' },
    { key: 'connect4_game', field: 'connect4_game' },
    { key: 'coinflip_game', field: 'coinflip_game' },
    { key: 'hunt_game', field: 'hunt_game' },
    { key: 'roulette_game', field: 'roulette_game' },
    { key: 'luna21_game', field: 'luna21_game' },
    { key: 'steal_system', field: 'steal_system' },
  ];

  for (const { key, field } of games) {
    const block = extractBlock(content, key);
    if (block) {
      try { (result as any)[field] = JSON.parse(cleanTsForJson(block.value)); } catch {}
    }
  }

  // Parse banking
  const loanTiers = extractBlock(content, 'loan_tiers');
  if (loanTiers) {
    try { result.loan_tiers = JSON.parse(cleanTsForJson(loanTiers.value)); } catch {}
  }

  const investment = extractBlock(content, 'investment');
  if (investment) {
    try { result.investment = JSON.parse(cleanTsForJson(investment.value)); } catch {}
  }

  return result;
}

/**
 * Clean TypeScript-specific syntax to make it JSON-parseable.
 */
function cleanTsForJson(ts: string): string {
  return ts
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1')
    // Remove TypeScript `as const` annotations
    .replace(/\s+as\s+\w+(\[\])?/g, '')
    // Remove single-line comments (only at line start, not :// in URLs)
    .replace(/(?<![:"'])\/\/[^\n]*/g, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Replace a config block in the source file, preserving indentation.
 */
function replaceBlock(source: string, key: string, newValue: any): string {
  const block = extractBlock(source, key);
  if (!block) return source;

  // Detect the indentation of the line where the key starts
  // Walk backward from block.start to find the key's line start
  let keyLineStart = source.lastIndexOf('\n', block.start);
  if (keyLineStart === -1) keyLineStart = 0;
  else keyLineStart += 1;
  const linePrefix = source.slice(keyLineStart, block.start);
  const indentMatch = linePrefix.match(/^(\s*)/);
  const baseIndent = indentMatch ? indentMatch[1] : '';
  const innerIndent = baseIndent + '    '; // one level deeper

  // Format the value with proper indentation
  const formatted = formatValue(newValue, baseIndent, innerIndent);
  return source.slice(0, block.start) + formatted + source.slice(block.end);
}

/**
 * Format a JS value as a TypeScript-compatible string with proper indentation.
 */
function formatValue(value: any, baseIndent: string, innerIndent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(item => {
      if (typeof item === 'object' && item !== null) {
        return innerIndent + formatValue(item, innerIndent, innerIndent + '    ');
      }
      return innerIndent + JSON.stringify(item);
    });
    return '[\n' + items.join(',\n') + '\n' + baseIndent + ']';
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v]) => {
      const valStr = typeof v === 'object' && v !== null
        ? formatValue(v, innerIndent, innerIndent + '    ')
        : JSON.stringify(v);
      return `${innerIndent}"${k}": ${valStr}`;
    });
    return '{\n' + lines.join(',\n') + '\n' + baseIndent + '}';
  }

  return JSON.stringify(value);
}

/**
 * Write a specific section to Butler config.ts
 */
export async function writeButlerConfigSection(
  section: keyof ButlerConfigSections,
  value: any
): Promise<void> {
  let content = await readButlerConfig();

  // Map section names to their keys in the config file
  const keyMap: Record<string, string> = {
    daily_reward: 'daily_reward',
    salary: 'salary',
    vip_reward: 'vip_reward',
    text_xp: 'text_xp',
    voice_xp: 'voice_xp',
    boosted_roles: 'boosted_roles',
    level_rewards: 'level_rewards',
    xo_game: 'xo_game',
    rps_game: 'rps_game',
    connect4_game: 'connect4_game',
    coinflip_game: 'coinflip_game',
    hunt_game: 'hunt_game',
    roulette_game: 'roulette_game',
    luna21_game: 'luna21_game',
    steal_system: 'steal_system',
    loan_tiers: 'loan_tiers',
    investment: 'investment',
  };

  const key = keyMap[section];
  if (!key) throw new Error(`Unknown config section: ${section}`);

  content = replaceBlock(content, key, value);
  await writeFile(`${BUTLER_PATH}/config.ts`, content, 'utf-8');
}

// ── Jester config types ──

export interface JesterGameConfig {
  enabled?: boolean;
  name?: string;
  description?: string;
  imageURL?: string;
  waiting_time?: number;
  min_players?: number;
  max_players?: number;
  allowedChannels?: string[];
  allowedRoles?: string[];
  [key: string]: any;
}

export interface JesterConfigSections {
  status?: string;
  // Game settings
  all_of_games?: { allowedChannels: string[] };
  roulette?: JesterGameConfig;
  mafia?: JesterGameConfig;
  rps?: JesterGameConfig;
  guessthecountry?: JesterGameConfig;
  bombroulette?: JesterGameConfig;
  magicbot?: JesterGameConfig;
  LunaFantasy?: JesterGameConfig;
  LunaFantasyEvent?: JesterGameConfig;
  GrandFantasy?: JesterGameConfig;
  FactionWar?: JesterGameConfig;
  // Reward settings
  points_settings?: Record<string, any>;
  // Shop settings
  ticket_shop_settings?: any;
  luckbox_boxes?: any;
}

/**
 * Parse Jester config sections from file content.
 * Strips large nested blocks (cards in LunaFantasy, factions in FactionWar)
 * to keep the response size manageable for the frontend.
 */
export function parseJesterConfig(content: string): JesterConfigSections {
  const result: JesterConfigSections = {};

  // Extract status string
  const statusMatch = content.match(/"status"\s*:\s*"([^"]*)"/);
  if (statusMatch) result.status = statusMatch[1];

  // Extract game settings - each is a block inside "game_settings"
  const gameSettingsBlock = extractBlock(content, 'game_settings');
  if (gameSettingsBlock) {
    const gs = gameSettingsBlock.value;

    const gameKeys = [
      'all_of_games', 'roulette', 'mafia', 'rps', 'guessthecountry',
      'bombroulette', 'magicbot', 'LunaFantasy', 'LunaFantasyEvent',
      'GrandFantasy', 'FactionWar'
    ];

    for (const key of gameKeys) {
      const block = extractBlock(gs, key);
      if (block) {
        try {
          let blockValue = block.value;

          // For LunaFantasy, exclude the massive nested "cards" block
          if (key === 'LunaFantasy') {
            const cardsBlock = extractBlock(blockValue, 'cards');
            if (cardsBlock) {
              const cardsKeyIdx = blockValue.indexOf('"cards"');
              blockValue = blockValue.slice(0, cardsKeyIdx) +
                blockValue.slice(cardsBlock.end);
              // Clean up double commas or trailing commas before closing brace
              blockValue = blockValue.replace(/,\s*,/g, ',').replace(/,(\s*})/g, '$1');
            }
          }

          // For FactionWar, exclude the massive "factions" block
          if (key === 'FactionWar') {
            const factionsBlock = extractBlock(blockValue, 'factions');
            if (factionsBlock) {
              const factionsKeyIdx = blockValue.indexOf('"factions"');
              blockValue = blockValue.slice(0, factionsKeyIdx) +
                blockValue.slice(factionsBlock.end);
              blockValue = blockValue.replace(/,\s*,/g, ',').replace(/,(\s*})/g, '$1');
            }
          }

          (result as any)[key] = JSON.parse(cleanTsForJson(blockValue));
        } catch { /* skip unparseable blocks */ }
      }
    }
  }

  // Extract points_settings
  const pointsBlock = extractBlock(content, 'points_settings');
  if (pointsBlock) {
    try { result.points_settings = JSON.parse(cleanTsForJson(pointsBlock.value)); } catch {}
  }

  // Extract ticket_shop_settings
  const ticketBlock = extractBlock(content, 'ticket_shop_settings');
  if (ticketBlock) {
    try { result.ticket_shop_settings = JSON.parse(cleanTsForJson(ticketBlock.value)); } catch {}
  }

  // Extract luckbox boxes
  const luckboxBlock = extractBlock(content, 'luckboxes');
  if (luckboxBlock) {
    try { result.luckbox_boxes = JSON.parse(cleanTsForJson(luckboxBlock.value)); } catch {}
  }

  return result;
}

/**
 * Write a specific section to Jester config.ts.
 * For LunaFantasy and FactionWar, preserves the large nested blocks
 * (cards and factions) that are stripped during parsing.
 */
export async function writeJesterConfigSection(
  section: string,
  value: any
): Promise<void> {
  let content = await readJesterConfig();

  // Special handling for LunaFantasy: preserve the "cards" sub-block
  // Only preserves if value.cards is not already set (i.e., Games page saving settings without cards).
  // When the Cards page sends the full object with cards included, we use the new data as-is.
  if (section === 'LunaFantasy' && !value.cards) {
    const existingBlock = extractBlock(content, 'LunaFantasy');
    if (existingBlock) {
      const cardsBlock = extractBlock(existingBlock.value, 'cards');
      if (cardsBlock) {
        try {
          value.cards = JSON.parse(cleanTsForJson(cardsBlock.value));
        } catch {
          throw new Error('Failed to preserve LunaFantasy cards data. Aborting to prevent data loss.');
        }
      }
    }
  }

  // Special handling for FactionWar: preserve the "factions" sub-block
  // Only preserves if value.factions is not already set (i.e., Games page saving settings without factions).
  // When the Cards page sends the full object with factions included, we use the new data as-is.
  if (section === 'FactionWar' && !value.factions) {
    const existingBlock = extractBlock(content, 'FactionWar');
    if (existingBlock) {
      const factionsBlock = extractBlock(existingBlock.value, 'factions');
      if (factionsBlock) {
        try {
          value.factions = JSON.parse(cleanTsForJson(factionsBlock.value));
        } catch {
          throw new Error('Failed to preserve FactionWar factions data. Aborting to prevent data loss.');
        }
      }
    }
  }

  content = replaceBlock(content, section, value);
  await writeFile(`${JESTER_PATH}/config.ts`, content, 'utf-8');
}

/**
 * Git commit and push config.ts changes for a project.
 */
export async function gitCommitAndPush(
  projectPath: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    execFileSync('git', ['add', 'config.ts'], { cwd: projectPath, timeout: 10000 });

    // Check if there are staged changes
    const status = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: projectPath, timeout: 5000 }).toString().trim();
    if (!status) {
      return { success: true }; // Nothing to commit
    }

    execFileSync('git', ['commit', '-m', message], { cwd: projectPath, timeout: 15000 });
    execFileSync('git', ['push'], { cwd: projectPath, timeout: 30000 });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
