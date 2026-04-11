export interface UserCard {
  name: string;
  attack: number;
  imageUrl: string;
  rarity: string;
  source: string;
  obtainedDate: string;
  id: string;
  weight?: number;
  isDuplicate?: boolean;
}

export interface UserStone {
  id: string;
  name: string;
  imageUrl: string;
  acquiredAt: string;
}

export interface LevelData {
  xp: number;
  level: number;
  messages: number;
  voiceTime: number;
}

export interface GameWins {
  magic_cards?: number;
  luna_pairs?: number;
  grand_fantasy?: number;
  bot_wins?: number;
}

export interface PvpRecord {
  wins: number;
  losses: number;
  nemesis?: {
    discordId: string;
    name: string;
    avatar: string | null;
    winsAgainst: number;
    lossesAgainst: number;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  roleId: string;
  description: string;
  shopId: string;
  purchaseDate: string;
}

export interface CardsByGame {
  lunaFantasy: UserCard[];
}

export interface ChatActivity {
  messagesToday: number;
  voiceMinutesToday: number;
}

export interface CatalogCard {
  id: string;
  name: string;
  rarity: string;
  imageUrl: string;
  attack?: number;
  weight?: number;
}

export interface BadgeData {
  [badgeId: string]: number; // badge_id → unix timestamp (0 or absent = not earned)
}

export interface Passport {
  number: string;        // "LUNA-11031700001"
  faction: string;       // one of the 11 Faction War factions
  fullName: string;      // user's guild display name at issue time
  dateOfBirth: string;   // "DD/MM" — no year for privacy
  issuedAt: number;      // unix ms
  issuedBy: string;      // discordId of the admin who accepted
}

// Canvas-editor-driven layout for the passport card. Pixel coordinates on a
// 1004x762 template — keep in sync with PASSPORT_DEFAULTS in Butler's
// util/canvas/profile_card.ts so the bot canvas and website overlay match.
export interface PassportLayout {
  avatar?:   { x: number; y: number; radiusX: number; radiusY: number };
  number?:   { x: number; y: number; fontSize: number };
  name?:     { x: number; y: number; fontSize: number };
  dob?:      { x: number; y: number; fontSize: number };
  issuedAt?: { x: number; y: number; fontSize: number };
  faction?:  { x: number; y: number; fontSize: number };
  [key: string]: any;
}

export interface ProfileData {
  active_background: string;      // e.g. "bg_calm_bath" or "default"
  active_rank_background: string;  // e.g. "rank_calm_bath" or "default"
  passport: Passport | null;       // Luna Passport, nullable
}

export interface PublicUserInfo {
  name: string;
  image: string | null;
  discordId: string;
}

export interface GameDataResponse {
  cardsByGame: CardsByGame;
  totalCards: number;
  stones: UserStone[];
  lunari: number;
  level: LevelData | null;
  gameWins: GameWins | null;
  pvp: PvpRecord;
  inventory: InventoryItem[];
  tickets: number;
  chatActivity: ChatActivity | null;
  cardCatalog: CatalogCard[];
  badges: BadgeData | null;
  profile: ProfileData | null;
  passportLayout: PassportLayout | null;
  passportVipLayout: PassportLayout | null;
  hasVipPassport: boolean;
  publicUser?: PublicUserInfo;
}
