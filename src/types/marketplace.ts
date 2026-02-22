export type ListingType = 'fixed_price' | 'auction';
export type ListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';
export type ListingSource = 'web' | 'bot';

export interface ListingCard {
  id: string;
  name: string;
  rarity: string;
  attack: number;
  weight?: number;
  imageUrl: string;
  source: string;
  game?: string;
}

export interface MarketplaceListing {
  _id?: string;
  listingId: string;
  type: ListingType;
  sellerId: string;
  sellerName: string;
  card: ListingCard;
  price: number;
  status: ListingStatus;
  buyerId?: string;
  buyerName?: string;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
  soldAt?: Date;
  cancelledAt?: Date;
  cardReturned: boolean;
  source: ListingSource;
  // Auction fields
  auctionConfig?: AuctionConfig;
  currentBid?: number;
  currentBidderId?: string;
  currentBidderName?: string;
  bidCount?: number;
  bids?: AuctionBid[];
}

export interface AuctionBid {
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: Date;
}

export interface AuctionConfig {
  startingPrice: number;
  minBidIncrement: number;
  duration: 24 | 48 | 72;
}

export interface ListingFilters {
  rarity?: string;
  game?: string;
  search?: string;
  type?: ListingType;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'ending_soon' | 'most_bids';
  page?: number;
  limit?: number;
}

export interface CreateListingInput {
  cardId: string;
  price: number;
}

export interface CreateAuctionInput {
  cardId: string;
  startingPrice: number;
  duration: 24 | 48 | 72;
}

export interface ListingsResponse {
  listings: MarketplaceListing[];
  total: number;
  page: number;
  totalPages: number;
}

// Notification types
export type NotificationType = 'outbid' | 'auction_won' | 'auction_expired' | 'card_sold' | 'swap_received';

export interface UserNotification {
  _id?: string;
  notificationId: string;
  userId: string;
  type: NotificationType;
  data: {
    listingId?: string;
    cardName?: string;
    amount?: number;
    actorName?: string;
    [key: string]: unknown;
  };
  read: boolean;
  createdAt: Date;
}

// ─── Swap Types ────────────────────────────────────────

export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'cancelled' | 'expired';

export interface SwapCard {
  id: string;
  name: string;
  rarity: string;
  attack: number;
  weight?: number;
  imageUrl: string;
  source: string;
}

export interface CardSwap {
  _id?: string;
  swapId: string;
  requesterId: string;
  requesterName: string;
  targetId: string;
  targetName: string;
  requesterCard: SwapCard;
  targetCard: SwapCard;
  status: SwapStatus;
  counterSwapId?: string;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt?: Date;
  source: 'web' | 'bot';
}

export interface CreateSwapInput {
  targetId: string;
  requesterCardId: string;
  targetCardId: string;
}

export interface PublicUserCards {
  discordId: string;
  username: string;
  cards: SwapCard[];
}
