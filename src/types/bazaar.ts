// ── Bazaar Types ──

export type LuckboxTier = 'common' | 'rare' | 'epic' | 'unique' | 'legendary' | 'secret';

export interface LuckboxTierConfig {
  tier: LuckboxTier;
  price: number;
  rarity: string;
  label: string;
}

/** Multi-rarity luckbox: a single box that can contain cards from different rarities */
export interface RaritySlot {
  rarity: string;
  percentage: number;
}

export interface CardOverride {
  name: string;
  weight: number;
}

export interface LuckboxBoxConfig {
  id: string;
  label: string;
  price: number;
  rarities: RaritySlot[];
  enabled: boolean;
  order: number;
  cardOverrides?: Record<string, CardOverride[]>;
}

/** DB-stored shop configs */
export interface LuckboxShopConfig {
  tiers: LuckboxBoxConfig[];
}

export interface StoneShopConfig {
  price: number;
  refundAmount: number;
  stones: StoneConfig[];
}

export interface TicketShopConfig {
  packages: TicketPackage[];
}

export interface StoneConfig {
  name: string;
  weight: number;
  imageUrl: string;
  sell_price: number;
}

export interface TicketPackage {
  id: string;
  name: string;
  tickets: number;
  price: number;
}

export interface LunariPackage {
  id: string;
  name: string;
  lunari: number;
  usd: number;
  stripePriceId: string;
}

// ── API Request/Response Types ──

export interface LuckboxRequest {
  tier: LuckboxTier;
}

export interface LuckboxResponse {
  card: {
    name: string;
    rarity: string;
    imageUrl: string;
    attack: number;
  };
  isDuplicate: boolean;
  newBalance: number;
}

export interface StoneboxResponse {
  gotStone: boolean;
  stone?: {
    name: string;
    imageUrl: string;
  };
  isDuplicate?: boolean;
  sellPrice?: number;
  refundAmount: number;
  newBalance: number;
}

export interface TicketPurchaseRequest {
  packageId: string;
}

export interface TicketPurchaseResponse {
  ticketsAdded: number;
  newBalance: number;
  totalTickets: number;
}

export interface CatalogResponse {
  luckboxTiers: (LuckboxTierConfig & { cardCount: number })[];
  stoneBox: {
    price: number;
    stones: { name: string; weight: number; dropPercent: number }[];
  };
  ticketPackages: TicketPackage[];
  lunariPackages: LunariPackage[];
  user?: {
    balance: number;
    tickets: number;
    hasDebt: boolean;
    hasPassport?: boolean;
  };
}

export interface StripeCheckoutRequest {
  packageId: string;
}

// ── Transaction Types ──

export type TransactionType =
  // Website Lunari
  | 'stripe_purchase'
  | 'luckbox_spend'
  | 'stonebox_spend'
  | 'ticket_spend'
  | 'refund'
  // Banking
  | 'bank_daily'
  | 'bank_loan_taken'
  | 'bank_loan_repaid'
  | 'bank_loan_partial_repaid'
  | 'bank_investment_deposit'
  | 'bank_investment_withdraw'
  | 'bank_insurance'
  | 'bank_debt_paid'
  // Marketplace
  | 'marketplace_buy'
  | 'marketplace_sell'
  | 'trade_win'
  | 'trade_loss'
  | 'swap_received'
  // Web vendors
  | 'seluna_purchase'
  | 'brimor_purchase'
  | 'mells_purchase'
  // Card transactions (from Discord bots)
  | 'card_pull'
  | 'card_luckbox'
  | 'card_seluna'
  | 'card_sell'
  | 'card_buy'
  | 'card_auction'
  | 'card_swap'
  | 'card_gift'
  // Stone transactions (from Discord bots)
  | 'stone_chest'
  | 'stone_seluna'
  | 'stone_sell'
  | 'stone_buy'
  | 'stone_auction'
  | 'stone_swap'
  | 'stone_gift'
  | 'stone_forbidden_gift'
  // Bot Lunari transactions
  | 'lunari_added'
  | 'lunari_spent'
  | 'game_win'
  | 'game_loss'
  // Admin
  | 'admin_reversal'
  | 'admin_refund'
  | 'admin_credit'
  | 'admin_debit'
  | 'reserve_withdrawal';

export interface TransactionRecord {
  _id?: string;
  discordId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  metadata: {
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    packageId?: string;
    vendorId?: string;
    itemReceived?: string;
    itemRarity?: string;
    isDuplicate?: boolean;
    refundAmount?: number;
    cardName?: string;
    stoneName?: string;
    buyerId?: string;
    sellerId?: string;
    winnerId?: string;
    swapperId?: string;
    otherItem?: string;
    reason?: string;
    [key: string]: unknown;
  };
  createdAt: Date;
  source: 'web' | 'discord' | 'admin';
  status?: 'pending' | 'completed';
}

// ── Reveal Modal Types ──

export type RevealType = 'card' | 'stone';

export interface RevealData {
  type: RevealType;
  gotStone?: boolean;
  item: {
    name: string;
    imageUrl: string;
    rarity?: string;
    attack?: number;
  };
  isDuplicate: boolean;
  sellPrice?: number;
  refundAmount?: number;
  newBalance: number;
  price?: number;
}
