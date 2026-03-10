// ── Bazaar Types ──

export type LuckboxTier = 'common' | 'rare' | 'epic' | 'unique' | 'legendary' | 'secret';

export interface LuckboxTierConfig {
  tier: LuckboxTier;
  price: number;
  rarity: string;
  label: string;
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
  };
}

export interface StripeCheckoutRequest {
  packageId: string;
}

// ── Transaction Types ──

export type TransactionType =
  | 'stripe_purchase'
  | 'luckbox_spend'
  | 'stonebox_spend'
  | 'ticket_spend'
  | 'refund'
  | 'bank_daily'
  | 'bank_loan_taken'
  | 'bank_loan_repaid'
  | 'bank_loan_partial_repaid'
  | 'bank_investment_deposit'
  | 'bank_investment_withdraw'
  | 'bank_insurance'
  | 'bank_debt_paid'
  | 'marketplace_buy'
  | 'marketplace_sell'
  | 'trade_win'
  | 'trade_loss'
  | 'seluna_purchase'
  | 'brimor_purchase'
  | 'mells_purchase'
  | 'swap_received';

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
    [key: string]: unknown;
  };
  createdAt: Date;
  source: 'web';
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
