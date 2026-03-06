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
  magic_bot?: number;
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

export interface ProfileData {
  active_background: string;      // e.g. "bg_calm_bath" or "default"
  active_rank_background: string;  // e.g. "rank_calm_bath" or "default"
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
  publicUser?: PublicUserInfo;
}
