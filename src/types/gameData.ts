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
  grandFantasy: UserCard[];
  bumper: UserCard[];
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
}
