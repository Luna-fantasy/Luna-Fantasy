/**
 * Central registry for every tunable game in the Luna ecosystem.
 * Adding a new knob = one entry in GAMES — the UI doesn't change.
 *
 * Doc shapes come from:
 *   butler_games         (8 mini-games + steal_system)
 *   butler_baloot        (single { reward })
 *   jester_game_settings (lobby / PvP games + all_of_games + votegame)
 *   jester_points_settings (win rewards per Jester game)
 */

export type FieldType =
  | 'toggle'
  | 'text'
  | 'textarea'
  | 'number-int'
  | 'number-coins'
  | 'number-seconds'
  | 'number-ms-as-seconds'
  | 'number-percent'
  | 'number-multiplier'
  | 'slider-int'
  | 'slider-percent'
  | 'chips-role'
  | 'chips-channel'
  | 'single-channel'
  | 'image-url'
  | 'locked-nested';

export type FieldSection =
  | 'General'
  | 'Timing'
  | 'Cost & Reward'
  | 'Limits'
  | 'Permissions'
  | 'Rules';

export interface GameField {
  /** Dotted path within the game's value. e.g. "prizes.base" */
  key: string;
  label: string;
  help?: string;
  type: FieldType;
  section: FieldSection;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Override the default unit label for the type. */
  unit?: string;
  /** For locked-nested: where the real editor lives. */
  locked?: { where: string; href?: string; summary: string };
}

export type PointsMode =
  | 'tiers'          // [{players, points}, …] array
  | 'flat'           // single integer (solo or simple PvP reward)
  | 'flat-with-bot'  // two ints: {key} (human) + {key}_bot (vs bot)
  | 'faction-war';   // six ints: {base,bonus,double} × {human, bot}

export interface PointsSpec {
  /** bot_config _id where the points live (e.g. jester_points_settings). */
  docId: string;
  /** Path inside .data where this game's points live. For tiers/flat, keyBase is the leaf. */
  keyBase: string;
  mode: PointsMode;
  /** UI copy above the points block. */
  title: string;
  help?: string;
}

export interface GameSpec {
  id: string;
  label: string;
  bot: 'butler' | 'jester';
  /** Accent hex applied via --vendor-tone. Defaults to bot tone if omitted. */
  tone: string;
  /** One-char glyph used when no portrait image is set. */
  glyph: string;
  description: string;
  /** bot_config _id that holds this game's settings. */
  docId: string;
  /**
   * Path inside .data to this game's object. [] means "whole doc".
   * e.g. butler_games → ['xo_game']. butler_baloot → [] (whole doc = the baloot object).
   */
  docPath: string[];
  /** Optional — the key under docPath that holds the enabled flag for the hero toggle. */
  enabledKey?: string;
  /** Key under docPath for inline-edit title in the hero. */
  nameKey?: string;
  /** Key under docPath for inline-edit description. */
  descKey?: string;
  /** Key under docPath for the portrait image URL. */
  imageKey?: string;
  /** If present, the hero renders a flavor-text editor (pool + pinned). */
  flavor?: { poolKey: string; pinnedKey: string };
  /** If present, renders a points editor below the fields. */
  points?: PointsSpec;
  fields: GameField[];
}

export const BOTS = {
  butler: { label: 'Butler', tone: '#06b6d4', glyph: '☾', description: 'Mini-games, hunts, and card tables owned by Butler.' },
  jester: { label: 'Jester', tone: '#a855f7', glyph: '◈', description: 'Lobby brawls, duels, and card-fueled fantasy games.' },
} as const;

/* ─────────────────────────── Butler games ─────────────────────────── */

const xoBase: GameField[] = [
  { key: 'win_reward',  label: 'Win reward',  type: 'number-coins', section: 'Cost & Reward', help: 'Lunari paid to the winner.', min: 0, step: 50 },
  { key: 'draw_reward', label: 'Draw reward', type: 'number-coins', section: 'Cost & Reward', help: 'Lunari split when the match ends in a tie.', min: 0, step: 25 },
  { key: 'timeout',     label: 'Turn timeout', type: 'number-ms-as-seconds', section: 'Timing', help: 'Seconds before an inactive player forfeits the turn.', min: 10, max: 600, step: 5 },
];

const butlerXO: GameSpec = {
  id: 'xo_game', label: 'Tic-Tac-Toe', bot: 'butler',
  tone: '#06b6d4', glyph: '✕',
  description: 'Classic three-in-a-row match between two Lunarians.',
  docId: 'butler_games', docPath: ['xo_game'],
  enabledKey: 'enabled',
  fields: xoBase,
};

const butlerRPS: GameSpec = {
  id: 'rps_game', label: 'Rock Paper Scissors', bot: 'butler',
  tone: '#06b6d4', glyph: '✊',
  description: 'Three gestures, one winner — snap duels between two players.',
  docId: 'butler_games', docPath: ['rps_game'],
  enabledKey: 'enabled',
  fields: xoBase,
};

const butlerConnect4: GameSpec = {
  id: 'connect4_game', label: 'Connect Four', bot: 'butler',
  tone: '#06b6d4', glyph: '◎',
  description: 'Stack four tokens in a row to win.',
  docId: 'butler_games', docPath: ['connect4_game'],
  enabledKey: 'enabled',
  fields: xoBase,
};

const butlerCoinflip: GameSpec = {
  id: 'coinflip_game', label: 'Coinflip', bot: 'butler',
  tone: '#06b6d4', glyph: '⊙',
  description: 'Heads or tails — bet Lunari and double (or lose) it.',
  docId: 'butler_games', docPath: ['coinflip_game'],
  enabledKey: 'enabled',
  fields: [
    { key: 'min_bet', label: 'Minimum bet',  type: 'number-coins', section: 'Cost & Reward', help: 'Smallest wager a player is allowed to place.', min: 1, step: 1 },
    { key: 'max_bet', label: 'Maximum bet',  type: 'number-coins', section: 'Cost & Reward', help: 'Upper cap per flip.', min: 1, step: 10 },
    { key: 'win_multiplier', label: 'Payout multiplier', type: 'number-multiplier', section: 'Cost & Reward', help: '2 = double the bet on a win.', min: 1, step: 0.1 },
    { key: 'cooldown', label: 'Cooldown', type: 'number-ms-as-seconds', section: 'Timing', help: 'Minimum seconds between flips per player.', min: 0, max: 86400, step: 5 },
  ],
};

const butlerHunt: GameSpec = {
  id: 'hunt_game', label: 'Hunt', bot: 'butler',
  tone: '#06b6d4', glyph: '⌘',
  description: 'Solo hunting expedition — random beasts, random ambushes.',
  docId: 'butler_games', docPath: ['hunt_game'],
  enabledKey: 'enabled',
  fields: [
    { key: 'success_chance', label: 'Success chance', type: 'slider-percent', section: 'Rules', help: 'Percent chance the player catches something.', min: 0, max: 100, step: 1 },
    { key: 'min_reward', label: 'Minimum reward', type: 'number-coins', section: 'Cost & Reward', help: 'Smallest Lunari payout on a catch.', min: 0, step: 10 },
    { key: 'max_reward', label: 'Maximum reward', type: 'number-coins', section: 'Cost & Reward', help: 'Largest Lunari payout on a catch.', min: 0, step: 10 },
    { key: 'min_loss',   label: 'Minimum loss',   type: 'number-coins', section: 'Cost & Reward', help: 'Smallest Lunari penalty on a miss.', min: 0, step: 10 },
    { key: 'max_loss',   label: 'Maximum loss',   type: 'number-coins', section: 'Cost & Reward', help: 'Largest Lunari penalty on a miss.', min: 0, step: 10 },
    { key: 'cooldown', label: 'Cooldown', type: 'number-ms-as-seconds', section: 'Timing', help: 'Minimum seconds between hunts per player.', min: 0, max: 86400, step: 5 },
    { key: 'animals',  label: 'Animals', type: 'locked-nested', section: 'Rules',
      locked: { where: 'Animal list', summary: 'Edit the beasts & emoji lineup in Advanced — nested list.' } },
    { key: 'failures', label: 'Failures', type: 'locked-nested', section: 'Rules',
      locked: { where: 'Failure list', summary: 'Edit the "you missed because…" lines in Advanced.' } },
  ],
};

const butlerRoulette: GameSpec = {
  id: 'roulette_game', label: 'Russian Roulette', bot: 'butler',
  tone: '#06b6d4', glyph: '⚉',
  description: 'Bet, pull the trigger, hope the chamber is empty.',
  docId: 'butler_games', docPath: ['roulette_game'],
  enabledKey: 'enabled',
  fields: [
    { key: 'chambers', label: 'Chambers', type: 'slider-int', section: 'Rules', help: 'Number of chambers in the revolver (1 is always loaded).', min: 2, max: 10, step: 1 },
    { key: 'min_bet', label: 'Minimum bet', type: 'number-coins', section: 'Cost & Reward', help: 'Smallest wager allowed.', min: 1, step: 1 },
    { key: 'max_bet', label: 'Maximum bet', type: 'number-coins', section: 'Cost & Reward', help: 'Upper cap per round.', min: 1, step: 10 },
    { key: 'reward_multiplier', label: 'Payout multiplier', type: 'number-multiplier', section: 'Cost & Reward', help: 'Bet × multiplier is the survivor payout.', min: 0, step: 0.1 },
    { key: 'cooldown', label: 'Cooldown', type: 'number-ms-as-seconds', section: 'Timing', help: 'Minimum seconds between pulls per player.', min: 0, max: 86400, step: 5 },
  ],
};

const butlerLuna21: GameSpec = {
  id: 'luna21_game', label: 'Luna 21', bot: 'butler',
  tone: '#06b6d4', glyph: '♤',
  description: 'Blackjack-style card game — hit, stand, bust.',
  docId: 'butler_games', docPath: ['luna21_game'],
  enabledKey: 'enabled',
  fields: [
    { key: 'min_bet', label: 'Minimum bet', type: 'number-coins', section: 'Cost & Reward', help: 'Smallest wager allowed.', min: 1, step: 10 },
    { key: 'max_bet', label: 'Maximum bet', type: 'number-coins', section: 'Cost & Reward', help: 'Upper cap per hand.', min: 1, step: 50 },
    { key: 'cooldown', label: 'Cooldown', type: 'number-ms-as-seconds', section: 'Timing', help: 'Minimum seconds between hands per player.', min: 0, max: 86400, step: 5 },
    { key: 'cards', label: 'Card art', type: 'locked-nested', section: 'Rules',
      locked: { where: 'Canvas Editor', summary: 'The Luna 21 deck (52 card images) is managed in the Canvas Editor — edit there to avoid breaking rendering.' } },
  ],
};

const butlerSteal: GameSpec = {
  id: 'steal_system', label: 'Steal', bot: 'butler',
  tone: '#06b6d4', glyph: '✧',
  description: 'Pickpocket another player — higher risk, higher reward.',
  docId: 'butler_games', docPath: ['steal_system'],
  enabledKey: 'enabled',
  fields: [
    { key: 'min_percentage', label: 'Minimum steal %', type: 'slider-percent', section: 'Rules', help: 'Smallest fraction of the target balance that can be stolen.', min: 0, max: 100, step: 1 },
    { key: 'max_percentage', label: 'Maximum steal %', type: 'slider-percent', section: 'Rules', help: 'Largest fraction — keep this low or wallets vanish.', min: 0, max: 100, step: 1 },
    { key: 'cooldown', label: 'Cooldown', type: 'number-ms-as-seconds', section: 'Timing', help: 'Seconds between attempts per thief.', min: 0, max: 86400 * 7, step: 60 },
    { key: 'required_roles', label: 'Required roles', type: 'chips-role', section: 'Permissions', help: 'Players need at least one of these roles to attempt a steal. Empty = anyone.' },
    { key: 'success_image', label: 'Success image', type: 'image-url', section: 'Rules', help: 'Shown when the steal succeeds.' },
    { key: 'fail_image',    label: 'Failure image', type: 'image-url', section: 'Rules', help: 'Shown when the thief is caught.' },
  ],
};

const butlerBaloot: GameSpec = {
  id: 'baloot', label: 'Baloot', bot: 'butler',
  tone: '#06b6d4', glyph: '♠',
  description: 'Four-player trick-taking card game — the classic.',
  docId: 'butler_baloot', docPath: [],
  fields: [
    { key: 'reward', label: 'Winning team reward', type: 'number-coins', section: 'Cost & Reward', help: 'Total Lunari split between the winning pair at game end.', min: 0, step: 1000 },
  ],
};

/* ─────────────────────────── Jester games ─────────────────────────── */

// Shared field-sets for the lobby-style games (Roulette / Mafia / RPS / BombRoulette / Mines)
// Flavor editing for these games lives in the hero (see GameSpec.flavor), not in the fields list.
const jesterLobbyFields = (): GameField[] => [
  { key: 'waiting_time', label: 'Lobby wait time', type: 'number-seconds', section: 'Timing', help: 'Seconds players have to join before the game auto-starts.', min: 10, max: 300, step: 5 },
  { key: 'min_players', label: 'Minimum players', type: 'slider-int', section: 'Limits', help: 'Round won\'t start below this count.', min: 2, max: 40, step: 1 },
  { key: 'max_players', label: 'Maximum players', type: 'slider-int', section: 'Limits', help: 'No more players can join once this cap is reached.', min: 2, max: 40, step: 1 },
  { key: 'allowedRoles',    label: 'Allowed roles',    type: 'chips-role',    section: 'Permissions', help: 'Leave empty to let anyone play. Add a role ID to restrict.' },
  { key: 'allowedChannels', label: 'Allowed channels', type: 'chips-channel', section: 'Permissions', help: 'Leave empty to allow every channel. Add channel IDs to scope the game.' },
];

const jesterLobbyFlavor = { poolKey: 'flavor_pool', pinnedKey: 'flavor_pinned' } as const;

const jesterRoulette: GameSpec = {
  id: 'roulette', label: 'Luna Roulette', bot: 'jester',
  tone: '#a855f7', glyph: '◉',
  description: 'Big-lobby wheel spin. Last one standing wins the pot.',
  docId: 'jester_game_settings', docPath: ['roulette'],
  enabledKey: 'enabled', descKey: 'description', imageKey: 'imageURL',
  flavor: jesterLobbyFlavor,
  points: { docId: 'jester_points_settings', keyBase: 'roulette', mode: 'tiers',
            title: 'Win rewards by player count', help: 'Each tier applies when the lobby hits that player count. Highest qualifying tier wins.' },
  fields: [
    ...jesterLobbyFields(),
  ],
};

const jesterMafia: GameSpec = {
  id: 'mafia', label: 'Blood Moon (Mafia)', bot: 'jester',
  tone: '#a855f7', glyph: '☾',
  description: 'Who is good? Who is bad? Survive the night and find out.',
  docId: 'jester_game_settings', docPath: ['mafia'],
  enabledKey: 'enabled', descKey: 'description', imageKey: 'imageURL',
  flavor: jesterLobbyFlavor,
  points: { docId: 'jester_points_settings', keyBase: 'mafia', mode: 'tiers', title: 'Win rewards by player count' },
  fields: jesterLobbyFields(),
};

const jesterRPS: GameSpec = {
  id: 'rps', label: 'Luna RPS', bot: 'jester',
  tone: '#a855f7', glyph: '✊',
  description: 'Group rock-paper-scissors brawl — last player standing takes the pot.',
  docId: 'jester_game_settings', docPath: ['rps'],
  enabledKey: 'enabled', descKey: 'description', imageKey: 'imageURL',
  flavor: jesterLobbyFlavor,
  points: { docId: 'jester_points_settings', keyBase: 'rps', mode: 'tiers', title: 'Win rewards by player count' },
  fields: jesterLobbyFields(),
};

const jesterBombRoulette: GameSpec = {
  id: 'bombroulette', label: 'Luna Bomber', bot: 'jester',
  tone: '#a855f7', glyph: '⚛',
  description: 'A bomb is passed around. When it drops, someone loses.',
  docId: 'jester_game_settings', docPath: ['bombroulette'],
  enabledKey: 'enabled', descKey: 'description', imageKey: 'imageURL',
  flavor: jesterLobbyFlavor,
  points: { docId: 'jester_points_settings', keyBase: 'bombroulette', mode: 'tiers', title: 'Win rewards by player count' },
  fields: jesterLobbyFields(),
};

const jesterMines: GameSpec = {
  id: 'mines', label: 'Underworld Traps', bot: 'jester',
  tone: '#a855f7', glyph: '☗',
  description: 'Skulls buried in the dark — pick wisely or bust.',
  docId: 'jester_game_settings', docPath: ['mines'],
  enabledKey: 'enabled', descKey: 'description', imageKey: 'imageURL',
  flavor: jesterLobbyFlavor,
  points: { docId: 'jester_points_settings', keyBase: 'mines', mode: 'tiers', title: 'Win rewards by player count' },
  fields: jesterLobbyFields(),
};

const jesterGuessCountry: GameSpec = {
  id: 'guessthecountry', label: 'Guess The Country', bot: 'jester',
  tone: '#a855f7', glyph: '⌖',
  description: 'Name the country from a hint — points for the sharpest eyes.',
  docId: 'jester_game_settings', docPath: ['guessthecountry'],
  enabledKey: 'enabled', nameKey: 'name',
  points: { docId: 'jester_points_settings', keyBase: 'guessthecountry', mode: 'flat',
            title: 'Win reward', help: 'Paid to the player with the most correct answers at the end.' },
  fields: [
    { key: 'rounds',     label: 'Rounds',      type: 'slider-int',     section: 'Rules',  min: 1, max: 20, step: 1, help: 'How many countries to guess per game.' },
    { key: 'guess_time', label: 'Guess time',  type: 'number-seconds', section: 'Timing', min: 5, max: 120, step: 1, help: 'Seconds each player has to answer a round.' },
    { key: 'waiting_time', label: 'Lobby wait time', type: 'number-seconds', section: 'Timing', min: 10, max: 300, step: 5, help: 'Seconds players have to join before the game auto-starts.' },
    { key: 'allowedRoles',    label: 'Allowed roles',    type: 'chips-role',    section: 'Permissions', help: 'Leave empty to let anyone play.' },
    { key: 'allowedChannels', label: 'Allowed channels', type: 'chips-channel', section: 'Permissions', help: 'Leave empty to allow every channel.' },
  ],
};

const jesterLunaFantasy: GameSpec = {
  id: 'LunaFantasy', label: 'Luna Fantasy', bot: 'jester',
  tone: '#a855f7', glyph: '❂',
  description: '1-vs-1 card duel — five rounds, sharpest deck wins.',
  docId: 'jester_game_settings', docPath: ['LunaFantasy'],
  enabledKey: 'enabled', nameKey: 'name', descKey: 'description',
  points: { docId: 'jester_points_settings', keyBase: 'LunaFantasy', mode: 'flat-with-bot',
            title: 'Win rewards', help: 'Paid when the human wins. Bot variant applies when the AI wins instead.' },
  fields: [
    { key: 'ticket_cost',     label: 'Ticket cost',     type: 'number-int',     section: 'Cost & Reward', help: 'Tickets spent to enter a duel.', min: 0, step: 1 },
    { key: 'pvp_invite_time', label: 'PvP invite time', type: 'number-seconds', section: 'Timing', help: 'Seconds the challenger has to accept.', min: 10, max: 600, step: 5 },
    { key: 'round_time',      label: 'Round time',      type: 'number-seconds', section: 'Timing', help: 'Seconds per round.', min: 10, max: 600, step: 5 },
    { key: 'allowedRoles',    label: 'Allowed roles',    type: 'chips-role',    section: 'Permissions', help: 'Leave empty to let anyone duel.' },
    { key: 'allowedChannels', label: 'Allowed channels', type: 'chips-channel', section: 'Permissions', help: 'Restrict duels to specific channels.' },
    { key: 'cards', label: 'Card pool', type: 'locked-nested', section: 'Rules',
      locked: { where: 'Cards page', href: '/admin/cards',
                summary: 'Luna Fantasy draws from the card pool — edit cards in /admin/cards to avoid breaking pulls.' } },
  ],
};

const jesterLunaFantasyEvent: GameSpec = {
  id: 'LunaFantasyEvent', label: 'Luna Fantasy — Event', bot: 'jester',
  tone: '#a855f7', glyph: '❃',
  description: 'Free event mode — play the bot, no ticket cost.',
  docId: 'jester_game_settings', docPath: ['LunaFantasyEvent'],
  enabledKey: 'enabled', nameKey: 'name', descKey: 'description',
  fields: [
    { key: 'ticket_cost',     label: 'Ticket cost',     type: 'number-int',     section: 'Cost & Reward', help: 'Keep at 0 for the event — changing costs breaks the "free" framing.', min: 0, step: 1 },
    { key: 'lunari_reward',   label: 'Event win reward', type: 'number-coins',  section: 'Cost & Reward', help: 'Lunari paid on a win during the event.', min: 0, step: 50 },
    { key: 'pvp_invite_time', label: 'PvP invite time', type: 'number-seconds', section: 'Timing', help: 'Seconds the challenger has to accept.', min: 10, max: 600, step: 5 },
    { key: 'round_time',      label: 'Round time',      type: 'number-seconds', section: 'Timing', help: 'Seconds per round.', min: 10, max: 600, step: 5 },
    { key: 'allowedRoles',    label: 'Allowed roles',    type: 'chips-role',    section: 'Permissions', help: 'Leave empty to let anyone play the event.' },
    { key: 'allowedChannels', label: 'Allowed channels', type: 'chips-channel', section: 'Permissions', help: 'Restrict the event to specific channels.' },
  ],
};

const jesterGrandFantasy: GameSpec = {
  id: 'GrandFantasy', label: 'Grand Fantasy', bot: 'jester',
  tone: '#a855f7', glyph: '✦',
  description: 'Full card-hand battle — cards from your collection fight.',
  docId: 'jester_game_settings', docPath: ['GrandFantasy'],
  enabledKey: 'enabled', nameKey: 'name', descKey: 'description',
  points: { docId: 'jester_points_settings', keyBase: 'GrandFantasy', mode: 'flat-with-bot',
            title: 'Win rewards', help: 'Paid when the human wins. Bot variant applies when the AI wins.' },
  fields: [
    { key: 'ticket_cost',      label: 'Ticket cost',        type: 'number-int',     section: 'Cost & Reward', help: 'Tickets spent per human match.', min: 0, step: 1 },
    { key: 'ticket_cost_bot',  label: 'Ticket cost vs bot', type: 'number-int',     section: 'Cost & Reward', help: 'Tickets spent when challenging the AI.', min: 0, step: 1 },
    { key: 'prize',            label: 'Prize',              type: 'number-coins',   section: 'Cost & Reward', help: 'Lunari paid to the human winner.', min: 0, step: 500 },
    { key: 'prize_bot',        label: 'Prize vs bot',       type: 'number-coins',   section: 'Cost & Reward', help: 'Lunari paid when the player beats the AI.', min: 0, step: 500 },
    { key: 'mercenary_cost',   label: 'Mercenary cost',     type: 'number-coins',   section: 'Rules', help: 'Lunari the player spends to summon a mercenary unit.', min: 0, step: 100 },
    { key: 'imp_penalty',      label: 'Imp penalty',        type: 'number-coins',   section: 'Rules', help: 'Lunari docked when an imp eats the player\'s card.', min: 0, step: 50 },
    { key: 'guardian_split_amount', label: 'Guardian split', type: 'number-coins',  section: 'Rules', help: 'Lunari split between both players when a Guardian intervenes.', min: 0, step: 100 },
    { key: 'pvp_invite_time',  label: 'PvP invite time',    type: 'number-seconds', section: 'Timing', help: 'Seconds the challenger has to accept.', min: 10, max: 600, step: 5 },
    { key: 'round_time',       label: 'Round time',         type: 'number-seconds', section: 'Timing', help: 'Seconds per round.', min: 10, max: 600, step: 5 },
    { key: 'channel_id',       label: 'Primary channel',    type: 'single-channel', section: 'Permissions', help: 'Featured channel for Grand Fantasy.' },
    { key: 'allowedChannels',  label: 'Allowed channels',   type: 'chips-channel',  section: 'Permissions', help: 'Leave empty to allow any channel.' },
    { key: 'allowedRoles',     label: 'Allowed roles',      type: 'chips-role',     section: 'Permissions', help: 'Leave empty to let anyone play.' },
  ],
};

const jesterFactionWar: GameSpec = {
  id: 'FactionWar', label: 'Faction War', bot: 'jester',
  tone: '#a855f7', glyph: '⚔',
  description: 'Match cards by faction — collect three sets of three to win.',
  docId: 'jester_game_settings', docPath: ['FactionWar'],
  enabledKey: 'enabled', nameKey: 'name', descKey: 'description',
  points: { docId: 'jester_points_settings', keyBase: 'FactionWar', mode: 'faction-war',
            title: 'Win rewards by outcome', help: 'Base = standard win, Bonus = first-faction win, Double = rare perfect win. Each has a human and a vs-bot variant.' },
  fields: [
    { key: 'ticket_cost',      label: 'Ticket cost',        type: 'number-int',     section: 'Cost & Reward', help: 'Tickets spent per human match.', min: 0, step: 1 },
    { key: 'ticket_cost_bot',  label: 'Ticket cost vs bot', type: 'number-int',     section: 'Cost & Reward', help: 'Tickets spent when challenging the AI.', min: 0, step: 1 },
    { key: 'prizes.base',      label: 'Base prize',         type: 'number-coins',   section: 'Cost & Reward', help: 'Standard win payout.', min: 0, step: 500 },
    { key: 'prizes.bonus',     label: 'Bonus prize',        type: 'number-coins',   section: 'Cost & Reward', help: 'Bonus-outcome payout.', min: 0, step: 500 },
    { key: 'prizes.double',    label: 'Double prize',       type: 'number-coins',   section: 'Cost & Reward', help: 'Perfect-win payout.', min: 0, step: 500 },
    { key: 'pvp_invite_time',  label: 'PvP invite time',    type: 'number-seconds', section: 'Timing', help: 'Seconds the challenger has to accept.', min: 10, max: 600, step: 5 },
    { key: 'turn_time',        label: 'Turn time',          type: 'number-seconds', section: 'Timing', help: 'Seconds per turn.', min: 10, max: 600, step: 5 },
    { key: 'allowedRoles',     label: 'Allowed roles',      type: 'chips-role',     section: 'Permissions', help: 'Leave empty to let anyone play.' },
    { key: 'allowedChannels',  label: 'Allowed channels',   type: 'chips-channel',  section: 'Permissions', help: 'Leave empty to allow any channel.' },
    { key: 'factions',         label: 'Factions',           type: 'locked-nested',  section: 'Rules',
      locked: { where: 'Cards page', href: '/admin/cards',
                summary: 'Faction rosters share the card pool — edit them alongside cards to keep artwork and balance aligned.' } },
  ],
};

/* ─────────────────────────── Master list ─────────────────────────── */

export const GAMES: GameSpec[] = [
  // Butler
  butlerXO,
  butlerRPS,
  butlerConnect4,
  butlerCoinflip,
  butlerHunt,
  butlerRoulette,
  butlerLuna21,
  butlerSteal,
  butlerBaloot,
  // Jester
  jesterRoulette,
  jesterMafia,
  jesterRPS,
  jesterBombRoulette,
  jesterMines,
  jesterGuessCountry,
  jesterLunaFantasy,
  jesterLunaFantasyEvent,
  jesterGrandFantasy,
  jesterFactionWar,
];

/* ─────────────────────────── Helpers ─────────────────────────── */

/** Read a nested value by dotted-path segments, with a fallback. */
export function getAtPath(obj: any, path: string[]): any {
  let cur = obj;
  for (const seg of path) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/** Return a new object with the path set to the given value. Creates objects on the way down. */
export function setAtPath(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const base = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? { ...obj } : {};
  base[head] = setAtPath(base?.[head], rest, value);
  return base;
}

/** Resolve a dotted field.key (e.g. "prizes.base") into path segments. */
export function fieldPath(field: GameField): string[] {
  return field.key.split('.');
}

/** Human unit for a FieldType when no explicit `unit` is set. */
export function defaultUnit(type: FieldType): string | null {
  switch (type) {
    case 'number-coins':          return 'Lunari';
    case 'number-seconds':        return 'seconds';
    case 'number-ms-as-seconds':  return 'seconds';
    case 'number-percent':        return '%';
    case 'slider-percent':        return '%';
    case 'number-multiplier':     return '×';
    case 'number-int':            return null;
    case 'slider-int':            return null;
    default:                      return null;
  }
}
