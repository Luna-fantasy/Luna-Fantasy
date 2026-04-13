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
      { id: `top3.${rank}.avatar`, label: `#${rank} Avatar`, type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group },
      { id: `top3.${rank}.name`, label: `#${rank} Name`, type: 'text', props: ['x', 'y', 'fontSize'], group },
      { id: `top3.${rank}.value`, label: `#${rank} ${valueLabel}`, type: 'text', props: ['x', 'y', 'fontSize'], group },
    );
  }

  for (let rank = 4; rank <= 10; rank++) {
    const group = `List — Rank ${rank}`;
    elements.push(
      { id: `list.${rank}.avatar`, label: `#${rank} Avatar`, type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group },
      { id: `list.${rank}.name`, label: `#${rank} Name`, type: 'text', props: ['x', 'y', 'fontSize'], group },
      { id: `list.${rank}.value`, label: `#${rank} ${valueLabel}`, type: 'text', props: ['x', 'y', 'fontSize'], group },
    );
  }

  return elements;
}

// ─── Leaderboard (Lunari) — Butler ──────────────────────────────────

const leaderboardLunariLayout: Record<string, any> = {
  top3: {
    1: { avatar: { x: 768, y: 164, radiusX: 70, radiusY: 70 }, name: { x: 768, y: 296, fontSize: 20 }, value: { x: 768, y: 341, fontSize: 22 } },
    2: { avatar: { x: 482, y: 186, radiusX: 62, radiusY: 62 }, name: { x: 485, y: 295, fontSize: 20 }, value: { x: 485, y: 339, fontSize: 22 } },
    3: { avatar: { x: 1052, y: 186, radiusX: 62, radiusY: 62 }, name: { x: 1049, y: 295, fontSize: 20 }, value: { x: 1049, y: 339, fontSize: 22 } },
  },
  list: {
    4: { avatar: { x: 329, y: 416, radiusX: 29, radiusY: 29 }, name: { x: 420, y: 426, fontSize: 18 }, value: { x: 1180, y: 426, fontSize: 22 } },
    5: { avatar: { x: 329, y: 495, radiusX: 29, radiusY: 29 }, name: { x: 420, y: 504, fontSize: 18 }, value: { x: 1180, y: 504, fontSize: 22 } },
    6: { avatar: { x: 329, y: 573, radiusX: 29, radiusY: 29 }, name: { x: 420, y: 582, fontSize: 18 }, value: { x: 1180, y: 581, fontSize: 22 } },
    7: { avatar: { x: 329, y: 650, radiusX: 29, radiusY: 29 }, name: { x: 420, y: 657, fontSize: 18 }, value: { x: 1180, y: 659, fontSize: 22 } },
    8: { avatar: { x: 329, y: 728, radiusX: 29, radiusY: 29 }, name: { x: 420, y: 735, fontSize: 18 }, value: { x: 1180, y: 736, fontSize: 22 } },
    9: { avatar: { x: 329, y: 806, radiusX: 29, radiusY: 29 }, name: { x: 420, y: 812, fontSize: 18 }, value: { x: 1180, y: 814, fontSize: 22 } },
    10: { avatar: { x: 329, y: 882, radiusX: 29, radiusY: 29 }, name: { x: 420, y: 891, fontSize: 18 }, value: { x: 1180, y: 894, fontSize: 22 } },
  },
};

// ─── Leaderboard (Levels) — Butler ──────────────────────────────────

const leaderboardLevelsLayout: Record<string, any> = {
  top3: {
    1: { avatar: { x: 4893, y: 1072, radiusX: 395, radiusY: 395 }, name: { x: 4850, y: 1860, fontSize: 120 }, value: { x: 4850, y: 2140, fontSize: 140 } },
    2: { avatar: { x: 3057, y: 1127, radiusX: 365, radiusY: 365 }, name: { x: 3070, y: 1860, fontSize: 120 }, value: { x: 3070, y: 2140, fontSize: 140 } },
    3: { avatar: { x: 6620, y: 1127, radiusX: 365, radiusY: 365 }, name: { x: 6641, y: 1860, fontSize: 120 }, value: { x: 6641, y: 2140, fontSize: 140 } },
  },
  list: {
    4: { avatar: { x: 1710, y: 2540, radiusX: 190, radiusY: 190 }, name: { x: 2300, y: 2595, fontSize: 117 }, value: { x: 4750, y: 2600, fontSize: 156 } },
    5: { avatar: { x: 1710, y: 3015, radiusX: 190, radiusY: 190 }, name: { x: 2300, y: 3050, fontSize: 117 }, value: { x: 4750, y: 3065, fontSize: 156 } },
    6: { avatar: { x: 1720, y: 3500, radiusX: 190, radiusY: 190 }, name: { x: 2300, y: 3525, fontSize: 117 }, value: { x: 4750, y: 3540, fontSize: 156 } },
    7: { avatar: { x: 1710, y: 3950, radiusX: 190, radiusY: 190 }, name: { x: 2300, y: 3965, fontSize: 117 }, value: { x: 4750, y: 3990, fontSize: 156 } },
    8: { avatar: { x: 1715, y: 4400, radiusX: 190, radiusY: 190 }, name: { x: 2300, y: 4440, fontSize: 117 }, value: { x: 4750, y: 4450, fontSize: 156 } },
    9: { avatar: { x: 1710, y: 4850, radiusX: 190, radiusY: 190 }, name: { x: 2300, y: 4900, fontSize: 117 }, value: { x: 4750, y: 4910, fontSize: 156 } },
    10: { avatar: { x: 1715, y: 5325, radiusX: 190, radiusY: 190 }, name: { x: 2300, y: 5355, fontSize: 117 }, value: { x: 4750, y: 5390, fontSize: 156 } },
  },
};

// ─── Fantasy Leaderboard — Jester ───────────────────────────────────

const fantasyLeaderboardLayout: Record<string, any> = {
  top3: {
    1: { avatar: { x: 1920, y: 410, radiusX: 168, radiusY: 168 }, name: { x: 1800, y: 740, fontSize: 37 }, value: { x: 1910, y: 855, fontSize: 60 } },
    2: { avatar: { x: 1213, y: 466, radiusX: 150, radiusY: 150 }, name: { x: 1100, y: 738, fontSize: 37 }, value: { x: 1212, y: 848, fontSize: 60 } },
    3: { avatar: { x: 2623, y: 465, radiusX: 150, radiusY: 150 }, name: { x: 2520, y: 736, fontSize: 37 }, value: { x: 2613, y: 848, fontSize: 60 } },
  },
  list: {
    4: { avatar: { x: 821, y: 1044, radiusX: 73, radiusY: 73 }, name: { x: 1050, y: 1064, fontSize: 45 }, value: { x: 2800, y: 1064, fontSize: 60 } },
    5: { avatar: { x: 821, y: 1239, radiusX: 73, radiusY: 73 }, name: { x: 1050, y: 1259, fontSize: 45 }, value: { x: 2800, y: 1259, fontSize: 60 } },
    6: { avatar: { x: 821, y: 1432, radiusX: 73, radiusY: 73 }, name: { x: 1050, y: 1454, fontSize: 45 }, value: { x: 2800, y: 1452, fontSize: 60 } },
    7: { avatar: { x: 821, y: 1625, radiusX: 73, radiusY: 73 }, name: { x: 1050, y: 1642, fontSize: 45 }, value: { x: 2800, y: 1647, fontSize: 60 } },
    8: { avatar: { x: 821, y: 1820, radiusX: 73, radiusY: 73 }, name: { x: 1050, y: 1837, fontSize: 45 }, value: { x: 2800, y: 1840, fontSize: 60 } },
    9: { avatar: { x: 821, y: 2017, radiusX: 73, radiusY: 73 }, name: { x: 1050, y: 2031, fontSize: 45 }, value: { x: 2800, y: 2036, fontSize: 60 } },
    10: { avatar: { x: 821, y: 2214, radiusX: 73, radiusY: 73 }, name: { x: 1050, y: 2228, fontSize: 45 }, value: { x: 2800, y: 2235, fontSize: 60 } },
  },
};

// ─── Rank Card — Butler ─────────────────────────────────────────────

const rankCardLayout: Record<string, any> = {
  avatar:      { x: 140, y: 141, radiusX: 80, radiusY: 80 },
  username:    { x: 250, y: 90, fontSize: 36 },
  level:       { x: 250, y: 130, fontSize: 24 },
  xpText:      { x: 890, y: 165, fontSize: 20 },
  progressBar: { x: 250, y: 180, width: 640, height: 30 },
  rank:        { x: 250, y: 245, fontSize: 28 },
  rankLabel:   { x: 310, y: 245, fontSize: 20 },
};

const rankCardElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Avatar', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Header' },
  { id: 'username', label: 'Username', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'level', label: 'Level Text', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'xpText', label: 'XP Text', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Progress' },
  { id: 'progressBar', label: 'Progress Bar', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Progress' },
  { id: 'rank', label: 'Rank Number', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Footer' },
  { id: 'rankLabel', label: 'Rank Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Footer' },
];

// ─── Profile Card — Butler ──────────────────────────────────────────

const profileCardLayout: Record<string, any> = {
  avatar:       { x: 512, y: 180, radiusX: 100, radiusY: 100 },
  displayName:  { x: 512, y: 325, fontSize: 36 },
  username:     { x: 512, y: 358, fontSize: 18 },
  levelPill:    { x: 512, y: 388, fontSize: 18 },
  xpBar:        { x: 362, y: 430, width: 300, height: 12 },
  xpLabel:      { x: 512, y: 472, fontSize: 14 },
  separator:    { x: 50, y: 490, width: 924, height: 2 },
};

const profileCardElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Avatar', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Header' },
  { id: 'displayName', label: 'Display Name', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'username', label: '@Username', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'levelPill', label: 'Level Pill', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Header' },
  { id: 'xpBar', label: 'XP Bar', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Progress' },
  { id: 'xpLabel', label: 'XP Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Progress' },
  { id: 'separator', label: 'Separator Line', type: 'rect', props: ['x', 'y', 'width', 'height'], group: 'Layout' },
];

// ─── Level Up Card — Butler ──────────────────────────────────────────

const levelUpCardLayout: Record<string, any> = {
  avatar: { x: 394, y: 334, radiusX: 218, radiusY: 218 },
};

const levelUpCardElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Avatar', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Content' },
];

// ─── Winner Image — Jester ──────────────────────────────────────────

const winnerLayout: Record<string, any> = {
  avatar: { x: 569, y: 420, radiusX: 138, radiusY: 138 },
};

const winnerElements: CanvasElementDef[] = [
  { id: 'avatar', label: 'Winner Avatar', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Content' },
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
  stone1: { x: 250, y: 530, radiusX: 100, radiusY: 100 },
  stone2: { x: 610, y: 530, radiusX: 100, radiusY: 100 },
  stone3: { x: 960, y: 530, radiusX: 100, radiusY: 100 },
};

const chestElements: CanvasElementDef[] = [
  { id: 'stone1', label: 'Stone 1 (Left)', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Stones' },
  { id: 'stone2', label: 'Stone 2 (Center)', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Stones' },
  { id: 'stone3', label: 'Stone 3 (Right)', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Stones' },
];

// ─── Passport — Butler bot (Discord canvas render) ─────────────────
// 1004x762 Passport.jpeg template — user avatar + 5 text values drawn via
// @napi-rs/canvas on the VPS. The template already prints [PASSPORT ID]
// [NAME] [BIRTHDAY] [DATE ISSUED] [FACTION], so the bot only draws the raw
// value at each coordinate (no label prefix).
// Keep these coords in sync with PASSPORT_DEFAULTS in Butler's profile_card.ts

const passportLayout: Record<string, any> = {
  avatar:   { x: 170, y: 390, radiusX: 110, radiusY: 110 },
  number:   { x: 620, y: 270, fontSize: 24 },
  name:     { x: 620, y: 335, fontSize: 24 },
  dob:      { x: 620, y: 400, fontSize: 24 },
  issuedAt: { x: 620, y: 465, fontSize: 24 },
  faction:  { x: 620, y: 530, fontSize: 24 },
};

const passportElements: CanvasElementDef[] = [
  { id: 'avatar',   label: 'User Avatar',     type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Photo' },
  { id: 'number',   label: 'Passport ID',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'name',     label: 'Full Name',       type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'dob',      label: 'Birthday',        type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'issuedAt', label: 'Date Issued',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'faction',  label: 'Faction',         type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
];

// ─── Passport — Website (HTML/CSS overlay on the public profile page) ─
// Same 1004x762 base template, but the website uses browser fallback fonts
// (Inter/system-ui) whose metrics differ from Alexandria on the canvas side.
// Coordinates are stored separately so admins can tune each independently.
// Read by game-data API → rendered as inline styles on ProfileContent.

const passportWebLayout: Record<string, any> = {
  avatar:   { x: 170, y: 390, radiusX: 110, radiusY: 110 },
  number:   { x: 620, y: 270, fontSize: 24 },
  name:     { x: 620, y: 335, fontSize: 24 },
  dob:      { x: 620, y: 400, fontSize: 24 },
  issuedAt: { x: 620, y: 465, fontSize: 24 },
  faction:  { x: 620, y: 530, fontSize: 24 },
};

const passportWebElements: CanvasElementDef[] = [
  { id: 'avatar',   label: 'User Avatar',     type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Photo' },
  { id: 'number',   label: 'Passport ID',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'name',     label: 'Full Name',       type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'dob',      label: 'Birthday',        type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'issuedAt', label: 'Date Issued',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'faction',  label: 'Faction',         type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
];

// ─── Passport VIP — cosmetic variant (bot + website) ─────────────────
// Automatically applied when the viewing user holds any role in
// applications_system.passport_vip_roles. Uses a different background
// template (PassportVIPFinal.png) but the same data fields as the normal
// passport. Layouts are stored separately so admins can drag the photo
// and field positions independently for the VIP art.
// Matches PASSPORT_VIP_BACKGROUND_URL in Butler's image_config.ts.
// Native VIP template dimensions: 1518 x 1018 — kept in sync with
// PASSPORT_VIP_W/H + PASSPORT_VIP_DEFAULTS in Butler's profile_card.ts.

const passportVipLayout: Record<string, any> = {
  avatar:   { x: 257, y: 521, radiusX: 166, radiusY: 147 },
  number:   { x: 937, y: 361, fontSize: 36 },
  name:     { x: 937, y: 448, fontSize: 36 },
  dob:      { x: 937, y: 534, fontSize: 36 },
  issuedAt: { x: 937, y: 621, fontSize: 36 },
  faction:  { x: 937, y: 708, fontSize: 36 },
};

const passportVipElements: CanvasElementDef[] = [
  { id: 'avatar',   label: 'User Avatar',     type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Photo' },
  { id: 'number',   label: 'Passport ID',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'name',     label: 'Full Name',       type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'dob',      label: 'Birthday',        type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'issuedAt', label: 'Date Issued',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'faction',  label: 'Faction',         type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
];

const PASSPORT_VIP_BG_URL = 'https://assets.lunarian.app/butler/backgrounds/PassportVIPFinal.png';

// ─── Staff Passport variants (Guardian / Sentinel / Mastermind — 1536x1024) ──
// Auto-applied when the user's passport.staffRole is set. Same 5 text fields
// as normal passport but at the staff template's native 1536x1024 resolution.
// Each staff role has its own layout key so admins can tune independently.

const passportStaffLayout: Record<string, any> = {
  avatar:   { x: 380, y: 480, radiusX: 175, radiusY: 170 },
  number:   { x: 950, y: 385, fontSize: 30 },
  name:     { x: 950, y: 460, fontSize: 30 },
  dob:      { x: 950, y: 540, fontSize: 30 },
  issuedAt: { x: 950, y: 615, fontSize: 30 },
  faction:  { x: 950, y: 695, fontSize: 30 },
};

const passportStaffElements: CanvasElementDef[] = [
  { id: 'avatar',   label: 'User Avatar',     type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Photo' },
  { id: 'number',   label: 'Passport ID',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'name',     label: 'Full Name',       type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'dob',      label: 'Birthday',        type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'issuedAt', label: 'Date Issued',     type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
  { id: 'faction',  label: 'Faction',         type: 'text',   props: ['x', 'y', 'fontSize'], group: 'Fields' },
];

const PASSPORT_GUARDIAN_BG_URL = 'https://assets.lunarian.app/butler/backgrounds/PassportGuardian.png';
const PASSPORT_SENTINEL_BG_URL = 'https://assets.lunarian.app/butler/backgrounds/PassportSentinel.png';
const PASSPORT_MASTERMIND_BG_URL = 'https://assets.lunarian.app/butler/backgrounds/PassportMastermind.png';

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
  {
    id: 'passport',
    label: 'Luna Passport (Discord bot)',
    bot: 'butler',
    width: 1004,
    height: 762,
    backgroundUrl: 'https://assets.lunarian.app/butler/backgrounds/Passport.jpeg',
    elements: passportElements,
    defaultLayout: passportLayout,
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_web',
    label: 'Luna Passport (Website profile)',
    bot: 'butler',
    width: 1004,
    height: 762,
    backgroundUrl: 'https://assets.lunarian.app/butler/backgrounds/Passport.jpeg',
    elements: passportWebElements,
    defaultLayout: passportWebLayout,
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_vip',
    label: 'Luna Passport VIP (Discord bot)',
    bot: 'butler',
    // Native VIP template resolution — matches PASSPORT_VIP_W/H in
    // Butler's profile_card.ts so the canvas editor preview and the
    // actual rendered output line up pixel-for-pixel.
    width: 1518,
    height: 1018,
    backgroundUrl: PASSPORT_VIP_BG_URL,
    elements: passportVipElements,
    defaultLayout: passportVipLayout,
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_vip_web',
    label: 'Luna Passport VIP (Website profile)',
    bot: 'butler',
    // VIP template native dimensions — matches PassportVIPFinal.png on R2.
    // Different from the normal passport (1004x762) because the VIP art is
    // wider. The website CSS wrap and ProfileContent coordinate math use
    // these same numbers so the overlay positions map 1:1 onto the template.
    width: 1518,
    height: 1018,
    backgroundUrl: PASSPORT_VIP_BG_URL,
    elements: passportVipElements,
    defaultLayout: passportVipLayout,
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  // ─── Staff Passports (Guardian / Sentinel / Mastermind — 1536x1024) ──
  {
    id: 'passport_guardian',
    label: 'Guardian Passport (Discord bot)',
    bot: 'butler',
    width: 1536,
    height: 1024,
    backgroundUrl: PASSPORT_GUARDIAN_BG_URL,
    elements: passportStaffElements,
    defaultLayout: { ...passportStaffLayout },
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_guardian_web',
    label: 'Guardian Passport (Website profile)',
    bot: 'butler',
    width: 1536,
    height: 1024,
    backgroundUrl: PASSPORT_GUARDIAN_BG_URL,
    elements: passportStaffElements,
    defaultLayout: { ...passportStaffLayout },
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_sentinel',
    label: 'Sentinel Passport (Discord bot)',
    bot: 'butler',
    width: 1536,
    height: 1024,
    backgroundUrl: PASSPORT_SENTINEL_BG_URL,
    elements: passportStaffElements,
    defaultLayout: { ...passportStaffLayout },
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_sentinel_web',
    label: 'Sentinel Passport (Website profile)',
    bot: 'butler',
    width: 1536,
    height: 1024,
    backgroundUrl: PASSPORT_SENTINEL_BG_URL,
    elements: passportStaffElements,
    defaultLayout: { ...passportStaffLayout },
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_mastermind',
    label: 'Mastermind Passport (Discord bot)',
    bot: 'butler',
    width: 1536,
    height: 1024,
    backgroundUrl: PASSPORT_MASTERMIND_BG_URL,
    elements: passportStaffElements,
    defaultLayout: { ...passportStaffLayout },
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  {
    id: 'passport_mastermind_web',
    label: 'Mastermind Passport (Website profile)',
    bot: 'butler',
    width: 1536,
    height: 1024,
    backgroundUrl: PASSPORT_MASTERMIND_BG_URL,
    elements: passportStaffElements,
    defaultLayout: { ...passportStaffLayout },
    colorKeys: [
      { key: 'value', label: 'Text Color', default: '#1a1208' },
    ],
  },
  // ─── Luna 21 (Blackjack) — Butler ────────────────────────────────────
  {
    id: 'luna21_card',
    label: 'Luna 21',
    bot: 'butler',
    width: 1619,
    height: 971,
    backgroundUrl: 'https://assets.lunarian.app/butler/misc/Luna-21.png',
    elements: [
      // Player (left side)
      { id: 'playerAvatar', label: 'Player Avatar', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Player' },
      { id: 'playerName', label: 'Player Name', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Player' },
      { id: 'playerLabel', label: 'Player Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Player' },
      { id: 'playerCards', label: 'Player Cards', type: 'rect', props: ['startX', 'startY', 'spacing'], group: 'Player' },
      { id: 'playerTotal', label: 'Player Total', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Player' },
      // Dealer (right side)
      { id: 'dealerAvatar', label: 'Dealer Avatar', type: 'circle', props: ['x', 'y', 'radiusX', 'radiusY'], group: 'Dealer' },
      { id: 'dealerName', label: 'Dealer Name', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Dealer' },
      { id: 'dealerLabel', label: 'Dealer Label', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Dealer' },
      { id: 'dealerCards', label: 'Dealer Cards', type: 'rect', props: ['startX', 'startY', 'spacing'], group: 'Dealer' },
      { id: 'dealerTotal', label: 'Dealer Total', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Dealer' },
      // Result (center)
      { id: 'result', label: 'Result Text', type: 'text', props: ['x', 'y', 'fontSize'], group: 'Result' },
    ],
    defaultLayout: {
      playerAvatar: { x: 128, y: 115, radiusX: 60, radiusY: 60 },
      playerName: { x: 128, y: 258, fontSize: 20 },
      playerLabel: { x: 128, y: 280, fontSize: 14 },
      playerCards: { startX: 250, startY: 330, spacing: 155 },
      playerTotal: { x: 185, y: 885, fontSize: 36 },
      dealerAvatar: { x: 1491, y: 115, radiusX: 60, radiusY: 60 },
      dealerName: { x: 1491, y: 258, fontSize: 20 },
      dealerLabel: { x: 1491, y: 280, fontSize: 14 },
      dealerCards: { startX: 960, startY: 330, spacing: 155 },
      dealerTotal: { x: 1435, y: 885, fontSize: 36 },
      result: { x: 810, y: 500, fontSize: 68 },
    },
    colorKeys: [
      { key: 'name', label: 'Name Color', default: '#6FB3E0' },
      { key: 'label', label: 'Label Color', default: '#8AB4D5' },
      { key: 'total', label: 'Score Color', default: '#6FB3E0' },
      { key: 'win', label: 'Win Color', default: '#6FB3E0' },
      { key: 'lose', label: 'Lose Color', default: '#ED4245' },
      { key: 'push', label: 'Push Color', default: '#FEE75C' },
    ],
  },
];

export function getCanvasDefinition(id: string): CanvasTypeDef | undefined {
  return CANVAS_DEFINITIONS.find(d => d.id === id);
}

export function getCanvasDefinitionsForBot(bot: 'butler' | 'jester'): CanvasTypeDef[] {
  return CANVAS_DEFINITIONS.filter(d => d.bot === bot);
}
