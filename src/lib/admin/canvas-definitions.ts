// Canvas layout definitions — element schema + defaults extracted from bot source files.
// Both the editor UI and bot integration reference this.

export interface CanvasElementDef {
  id: string;              // e.g. "top3.1.avatar"
  label: string;           // e.g. "1st Place Avatar"
  type: 'circle' | 'text' | 'rect';
  props: string[];         // editable properties: ['x','y','size'] or ['x','y','fontSize']
  group: string;           // grouping label for element list
}

export interface ColorKeyDef {
  key: string;
  label: string;
  default: string;
}

export interface CanvasTypeDef {
  id: string;              // e.g. "leaderboard_lunari"
  label: string;           // e.g. "Leaderboard (Lunari)"
  bot: 'butler' | 'jester';
  width: number;
  height: number;
  backgroundUrl: string;
  elements: CanvasElementDef[];
  defaultLayout: Record<string, any>;
  colorKeys: ColorKeyDef[];
}

// Helper: generate leaderboard element definitions for 10 ranks
function leaderboardElements(valueLabel: string): CanvasElementDef[] {
  const elements: CanvasElementDef[] = [];

  for (let rank = 1; rank <= 3; rank++) {
    const group = `Top 3 — Rank ${rank}`;
    elements.push(
      { id: `top3.${rank}.avatar`, label: `#${rank} Avatar`, type: 'circle', props: ['x', 'y', 'size'], group },
      { id: `top3.${rank}.name`, label: `#${rank} Name`, type: 'text', props: ['x', 'y', 'fontSize'], group },
      { id: `top3.${rank}.value`, label: `#${rank} ${valueLabel}`, type: 'text', props: ['x', 'y', 'fontSize'], group },
    );
  }

  for (let rank = 4; rank <= 10; rank++) {
    const group = `List — Rank ${rank}`;
    elements.push(
      { id: `list.${rank}.avatar`, label: `#${rank} Avatar`, type: 'circle', props: ['x', 'y', 'size'], group },
      { id: `list.${rank}.name`, label: `#${rank} Name`, type: 'text', props: ['x', 'y', 'fontSize'], group },
      { id: `list.${rank}.value`, label: `#${rank} ${valueLabel}`, type: 'text', props: ['x', 'y', 'fontSize'], group },
    );
  }

  return elements;
}

// ─── Leaderboard (Lunari) — Butler ──────────────────────────────────

const leaderboardLunariLayout: Record<string, any> = {
  top3: {
    1: { avatar: { x: 768, y: 164, size: 70 }, name: { x: 768, y: 296, fontSize: 20 }, value: { x: 768, y: 341, fontSize: 22 } },
    2: { avatar: { x: 482, y: 186, size: 62 }, name: { x: 485, y: 295, fontSize: 20 }, value: { x: 485, y: 339, fontSize: 22 } },
    3: { avatar: { x: 1052, y: 186, size: 62 }, name: { x: 1049, y: 295, fontSize: 20 }, value: { x: 1049, y: 339, fontSize: 22 } },
  },
  list: {
    4: { avatar: { x: 329, y: 416, size: 29 }, name: { x: 420, y: 426, fontSize: 18 }, value: { x: 1180, y: 426, fontSize: 22 } },
    5: { avatar: { x: 329, y: 495, size: 29 }, name: { x: 420, y: 504, fontSize: 18 }, value: { x: 1180, y: 504, fontSize: 22 } },
    6: { avatar: { x: 329, y: 573, size: 29 }, name: { x: 420, y: 582, fontSize: 18 }, value: { x: 1180, y: 581, fontSize: 22 } },
    7: { avatar: { x: 329, y: 650, size: 29 }, name: { x: 420, y: 657, fontSize: 18 }, value: { x: 1180, y: 659, fontSize: 22 } },
    8: { avatar: { x: 329, y: 728, size: 29 }, name: { x: 420, y: 735, fontSize: 18 }, value: { x: 1180, y: 736, fontSize: 22 } },
    9: { avatar: { x: 329, y: 806, size: 29 }, name: { x: 420, y: 812, fontSize: 18 }, value: { x: 1180, y: 814, fontSize: 22 } },
    10: { avatar: { x: 329, y: 882, size: 29 }, name: { x: 420, y: 891, fontSize: 18 }, value: { x: 1180, y: 894, fontSize: 22 } },
  },
};

// ─── Leaderboard (Levels) — Butler ──────────────────────────────────

const leaderboardLevelsLayout: Record<string, any> = {
  top3: {
    1: { avatar: { x: 4893, y: 1072, size: 395 }, name: { x: 4850, y: 1860, fontSize: 120 }, value: { x: 4850, y: 2140, fontSize: 140 } },
    2: { avatar: { x: 3057, y: 1127, size: 365 }, name: { x: 3070, y: 1860, fontSize: 120 }, value: { x: 3070, y: 2140, fontSize: 140 } },
    3: { avatar: { x: 6620, y: 1127, size: 365 }, name: { x: 6641, y: 1860, fontSize: 120 }, value: { x: 6641, y: 2140, fontSize: 140 } },
  },
  list: {
    4: { avatar: { x: 1710, y: 2540, size: 190 }, name: { x: 2300, y: 2595, fontSize: 117 }, value: { x: 4750, y: 2600, fontSize: 156 } },
    5: { avatar: { x: 1710, y: 3015, size: 190 }, name: { x: 2300, y: 3050, fontSize: 117 }, value: { x: 4750, y: 3065, fontSize: 156 } },
    6: { avatar: { x: 1720, y: 3500, size: 190 }, name: { x: 2300, y: 3525, fontSize: 117 }, value: { x: 4750, y: 3540, fontSize: 156 } },
    7: { avatar: { x: 1710, y: 3950, size: 190 }, name: { x: 2300, y: 3965, fontSize: 117 }, value: { x: 4750, y: 3990, fontSize: 156 } },
    8: { avatar: { x: 1715, y: 4400, size: 190 }, name: { x: 2300, y: 4440, fontSize: 117 }, value: { x: 4750, y: 4450, fontSize: 156 } },
    9: { avatar: { x: 1710, y: 4850, size: 190 }, name: { x: 2300, y: 4900, fontSize: 117 }, value: { x: 4750, y: 4910, fontSize: 156 } },
    10: { avatar: { x: 1715, y: 5325, size: 190 }, name: { x: 2300, y: 5355, fontSize: 117 }, value: { x: 4750, y: 5390, fontSize: 156 } },
  },
};

// ─── Fantasy Leaderboard — Jester ───────────────────────────────────

const fantasyLeaderboardLayout: Record<string, any> = {
  top3: {
    1: { avatar: { x: 1920, y: 410, size: 168 }, name: { x: 1800, y: 740, fontSize: 37 }, value: { x: 1910, y: 855, fontSize: 60 } },
    2: { avatar: { x: 1213, y: 466, size: 150 }, name: { x: 1100, y: 738, fontSize: 37 }, value: { x: 1212, y: 848, fontSize: 60 } },
    3: { avatar: { x: 2623, y: 465, size: 150 }, name: { x: 2520, y: 736, fontSize: 37 }, value: { x: 2613, y: 848, fontSize: 60 } },
  },
  list: {
    4: { avatar: { x: 821, y: 1044, size: 73 }, name: { x: 1050, y: 1064, fontSize: 45 }, value: { x: 2800, y: 1064, fontSize: 60 } },
    5: { avatar: { x: 821, y: 1239, size: 73 }, name: { x: 1050, y: 1259, fontSize: 45 }, value: { x: 2800, y: 1259, fontSize: 60 } },
    6: { avatar: { x: 821, y: 1432, size: 73 }, name: { x: 1050, y: 1454, fontSize: 45 }, value: { x: 2800, y: 1452, fontSize: 60 } },
    7: { avatar: { x: 821, y: 1625, size: 73 }, name: { x: 1050, y: 1642, fontSize: 45 }, value: { x: 2800, y: 1647, fontSize: 60 } },
    8: { avatar: { x: 821, y: 1820, size: 73 }, name: { x: 1050, y: 1837, fontSize: 45 }, value: { x: 2800, y: 1840, fontSize: 60 } },
    9: { avatar: { x: 821, y: 2017, size: 73 }, name: { x: 1050, y: 2031, fontSize: 45 }, value: { x: 2800, y: 2036, fontSize: 60 } },
    10: { avatar: { x: 821, y: 2214, size: 73 }, name: { x: 1050, y: 2228, fontSize: 45 }, value: { x: 2800, y: 2235, fontSize: 60 } },
  },
};

// ─── Rank Card — Butler ─────────────────────────────────────────────

const rankCardLayout: Record<string, any> = {
  avatar:      { x: 140, y: 141, size: 80 },
  username:    { x: 250, y: 90, fontSize: 36 },
  level:       { x: 250, y: 130, fontSize: 24 },
  xpText:      { x: 890, y: 165, fontSize: 20 },
  progressBar: { x: 250, y: 180, width: 640, height: 30 },
  rank:        { x: 250, y: 245, fontSize: 28 },
  rankLabel:   { x: 310, y: 245, fontSize: 20 },
};

const rankCardElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Avatar', type: 'circle', props: ['x', 'y', 'size'], group: 'Header' },
  { id: 'username', label: 'Username', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'level', label: 'Level Text', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'xpText', label: 'XP Text', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Progress' },
  { id: 'progressBar', label: 'Progress Bar', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Progress' },
  { id: 'rank', label: 'Rank Number', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Footer' },
  { id: 'rankLabel', label: 'Rank Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Footer' },
];

// ─── Profile Card — Butler ──────────────────────────────────────────

const profileCardLayout: Record<string, any> = {
  avatar:       { x: 512, y: 180, size: 100 },
  displayName:  { x: 512, y: 325, fontSize: 36 },
  username:     { x: 512, y: 358, fontSize: 18 },
  levelPill:    { x: 512, y: 388, fontSize: 18 },
  xpBar:        { x: 362, y: 430, width: 300, height: 12 },
  xpLabel:      { x: 512, y: 472, fontSize: 14 },
  separator:    { x: 50, y: 490, width: 924, height: 2 },
};

const profileCardElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Avatar', type: 'circle', props: ['x', 'y', 'size'], group: 'Header' },
  { id: 'displayName', label: 'Display Name', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'username', label: '@Username', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'levelPill', label: 'Level Pill', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'xpBar', label: 'XP Bar', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Progress' },
  { id: 'xpLabel', label: 'XP Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Progress' },
  { id: 'separator', label: 'Separator Line', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Layout' },
];

// ─── Level Up Card — Butler ──────────────────────────────────────────

const levelUpCardLayout: Record<string, any> = {
  avatar: { x: 394, y: 334, size: 218 },
};

const levelUpCardElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Avatar', type: 'circle', props: ['x', 'y', 'size'], group: 'Content' },
];

// ─── Luna 21 Card — Butler ──────────────────────────────────────────

const luna21Layout: Record<string, any> = {
  playerAvatar: { x: 180, y: 100, size: 55 },
  playerName:   { x: 180, y: 230, fontSize: 26 },
  playerLabel:  { x: 180, y: 258, fontSize: 19 },
  playerCards:  { x: 70, y: 295, fontSize: 0 },
  playerTotal:  { x: 180, y: 545, fontSize: 50 },
  dealerAvatar: { x: 844, y: 100, size: 55 },
  dealerName:   { x: 844, y: 230, fontSize: 26 },
  dealerLabel:  { x: 844, y: 258, fontSize: 19 },
  dealerCards:  { x: 734, y: 295, fontSize: 0 },
  dealerTotal:  { x: 844, y: 545, fontSize: 50 },
  result:       { x: 512, y: 400, fontSize: 43 },
};

const luna21Elements: CanvasElementDef[] = [
  { id: 'playerAvatar', label: 'Player Avatar', type: 'circle', props: ['x', 'y', 'size'], group: 'Player' },
  { id: 'playerName', label: 'Player Name', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Player' },
  { id: 'playerLabel', label: 'Player Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Player' },
  { id: 'playerCards', label: 'Player Cards Area', type: 'rect', props: ['x', 'y'], group: 'Player' },
  { id: 'playerTotal', label: 'Player Total', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Player' },
  { id: 'dealerAvatar', label: 'Dealer Avatar', type: 'circle', props: ['x', 'y', 'size'], group: 'Dealer' },
  { id: 'dealerName', label: 'Dealer Name', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Dealer' },
  { id: 'dealerLabel', label: 'Dealer Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Dealer' },
  { id: 'dealerCards', label: 'Dealer Cards Area', type: 'rect', props: ['x', 'y'], group: 'Dealer' },
  { id: 'dealerTotal', label: 'Dealer Total', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Dealer' },
  { id: 'result', label: 'Result Text', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Result' },
];

// ─── Winner Image — Jester ──────────────────────────────────────────

const winnerLayout: Record<string, any> = {
  avatar: { x: 569, y: 420, size: 138 },
};

const winnerElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Winner Avatar', type: 'circle', props: ['x', 'y', 'size'], group: 'Content' },
];

// ─── Book Image — Jester ────────────────────────────────────────────

const bookLayout: Record<string, any> = {
  leftArea:  { x: 82, y: 98, width: 930, height: 1327 },
  rightArea: { x: 1305, y: 98, width: 893, height: 1327 },
};

const bookElements: CanvasElementDef[] = [
  { id: 'leftArea', label: 'Left Page Area', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Pages' },
  { id: 'rightArea', label: 'Right Page Area', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Pages' },
];

// ─── Chest Image — Jester ───────────────────────────────────────────

const chestLayout: Record<string, any> = {
  stone1: { x: 250, y: 530, size: 100 },
  stone2: { x: 610, y: 530, size: 100 },
  stone3: { x: 960, y: 530, size: 100 },
};

const chestElements: CanvasElementDef[] = [
  { id: 'stone1', label: 'Stone 1 (Left)', type: 'circle', props: ['x', 'y', 'size'], group: 'Stones' },
  { id: 'stone2', label: 'Stone 2 (Center)', type: 'circle', props: ['x', 'y', 'size'], group: 'Stones' },
  { id: 'stone3', label: 'Stone 3 (Right)', type: 'circle', props: ['x', 'y', 'size'], group: 'Stones' },
];

// ─── All Canvas Definitions ─────────────────────────────────────────

export const CANVAS_DEFINITIONS: CanvasTypeDef[] = [
  {
    id: 'leaderboard_lunari',
    label: 'Leaderboard (Lunari)',
    bot: 'butler',
    width: 1536,
    height: 1024,
    backgroundUrl: 'https://assets.lunarian.app/butler/leaderboard/Leaderboard-for-Money.png',
    elements: leaderboardElements('Lunari'),
    defaultLayout: leaderboardLunariLayout,
    colorKeys: [
      { key: 'name', label: 'Name Color', default: '#F5E6CC' },
      { key: 'lunari', label: 'Lunari Color', default: '#ccffc2ff' },
    ],
  },
  {
    id: 'leaderboard_levels',
    label: 'Leaderboard (Levels)',
    bot: 'butler',
    width: 10000,
    height: 6706,
    backgroundUrl: 'https://assets.lunarian.app/butler/leaderboard/Leaderboard-for-Level.png',
    elements: leaderboardElements('Level'),
    defaultLayout: leaderboardLevelsLayout,
    colorKeys: [
      { key: 'name', label: 'Name Color', default: '#313844ff' },
      { key: 'levels', label: 'Level Color', default: '#363c55ff' },
    ],
  },
  {
    id: 'fantasy_leaderboard',
    label: 'Fantasy Leaderboard',
    bot: 'jester',
    width: 3840,
    height: 2560,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/jester/fantasy_leaderboard.png',
    elements: leaderboardElements('Wins'),
    defaultLayout: fantasyLeaderboardLayout,
    colorKeys: [
      { key: 'name', label: 'Name Color', default: '#FFFFFF' },
      { key: 'wins', label: 'Wins Color', default: '#a6e6ffff' },
    ],
  },
  {
    id: 'rank_card',
    label: 'Rank Card',
    bot: 'butler',
    width: 934,
    height: 282,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/butler/rank_card.png',
    elements: rankCardElements,
    defaultLayout: rankCardLayout,
    colorKeys: [
      { key: 'username', label: 'Username Color', default: '#FFFFFF' },
      { key: 'level', label: 'Level Color', default: '#D0D4D8' },
      { key: 'xp', label: 'XP Text Color', default: '#D0D4D8' },
      { key: 'rank', label: 'Rank Color', default: '#FFFFFF' },
      { key: 'barBg', label: 'Bar Background', default: '#40444B' },
      { key: 'barFill', label: 'Bar Fill', default: '#D0D0D0' },
      { key: 'barBorder', label: 'Bar Border', default: '#B0B0B0' },
    ],
  },
  {
    id: 'profile_card',
    label: 'Profile Card',
    bot: 'butler',
    width: 1024,
    height: 1792,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/butler/profile_card.png',
    elements: profileCardElements,
    defaultLayout: profileCardLayout,
    colorKeys: [
      { key: 'accent', label: 'Accent', default: '#58a6ff' },
      { key: 'text', label: 'Text', default: '#e6edf3' },
      { key: 'textDim', label: 'Text Dim', default: '#8b949e' },
      { key: 'green', label: 'Green', default: '#3fb950' },
      { key: 'red', label: 'Red', default: '#f85149' },
      { key: 'purple', label: 'Purple', default: '#bc8cff' },
      { key: 'xpBar', label: 'XP Bar', default: '#238636' },
      { key: 'xpBarBg', label: 'XP Bar Bg', default: '#21262d' },
    ],
  },
  // ── Phase 4 Canvas Types ──
  {
    id: 'level_up_card',
    label: 'Level Up Card',
    bot: 'butler',
    width: 1584,
    height: 672,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/butler/level_up_card.png',
    elements: levelUpCardElements,
    defaultLayout: levelUpCardLayout,
    colorKeys: [],
  },
  {
    id: 'luna21_card',
    label: 'Luna 21 Card',
    bot: 'butler',
    width: 1024,
    height: 614,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/butler/luna21_card.png',
    elements: luna21Elements,
    defaultLayout: luna21Layout,
    colorKeys: [
      { key: 'name', label: 'Name Color', default: '#6FB3E0' },
      { key: 'label', label: 'Label Color', default: '#8AB4D5' },
      { key: 'total', label: 'Total Color', default: '#6FB3E0' },
      { key: 'win', label: 'Win Color', default: '#6FB3E0' },
      { key: 'lose', label: 'Lose Color', default: '#ED4245' },
      { key: 'push', label: 'Push Color', default: '#FEE75C' },
    ],
  },
  {
    id: 'winner_image',
    label: 'Winner Image',
    bot: 'jester',
    width: 1152,
    height: 768,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/jester/winner_image.png',
    elements: winnerElements,
    defaultLayout: winnerLayout,
    colorKeys: [],
  },
  {
    id: 'book_image',
    label: 'Card Book',
    bot: 'jester',
    width: 2304,
    height: 1536,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/jester/book_image.png',
    elements: bookElements,
    defaultLayout: bookLayout,
    colorKeys: [],
  },
  {
    id: 'chest_image',
    label: 'Stone Chest',
    bot: 'jester',
    width: 1200,
    height: 800,
    backgroundUrl: 'https://assets.lunarian.app/canvas-backgrounds/jester/chest_image.png',
    elements: chestElements,
    defaultLayout: chestLayout,
    colorKeys: [],
  },
];

export function getCanvasDefinition(id: string): CanvasTypeDef | undefined {
  return CANVAS_DEFINITIONS.find(d => d.id === id);
}

export function getCanvasDefinitionsForBot(bot: 'butler' | 'jester'): CanvasTypeDef[] {
  return CANVAS_DEFINITIONS.filter(d => d.bot === bot);
}
