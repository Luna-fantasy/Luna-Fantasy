export interface AuditEntry {
  _id?: string;
  adminDiscordId: string;
  adminUsername: string;
  action: string;
  targetDiscordId?: string;
  before: unknown;
  after: unknown;
  metadata: {
    reason?: string;
    amount?: number;
    [key: string]: unknown;
  };
  timestamp: Date;
  ip: string;
}

export interface EconomyOverview {
  totalUsers: number;
  totalLunariCirculation: number;
  activeHolders: number;
  bankReserve: number;
  activeLoans: number;
  activeLoanValue: number;
  totalDebt: number;
  recentTransactions: RecentTransaction[];
}

export interface RecentTransaction {
  _id: string;
  discordId: string;
  username?: string;
  avatar?: string;
  type: string;
  amount: number;
  description?: string;
  timestamp: Date;
}

export interface AdminSession {
  discordId: string;
  username: string;
  globalName: string;
  image: string;
  isMastermind: true;
}

export interface AdminUserSearchResult {
  discordId: string;
  username?: string;
  globalName?: string;
  image?: string;
  balance: number;
  level?: number;
  cardCount: number;
}

export interface AdminUserProfile {
  discordId: string;
  username?: string;
  globalName?: string;
  image?: string;
  balance: number;
  tickets: number;
  level?: number;
  xp?: number;
  messages?: number;
  voiceTime?: number;
  cards: any[];
  stones: any[];
  inventory: any[];
  cooldowns: Record<string, any>;
  debt: number;
  loans: any[];
  transactions: any[];
}
