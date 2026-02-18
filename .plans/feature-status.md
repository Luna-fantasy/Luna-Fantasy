# Luna Platform — Feature Status

> **Updated:** 2026-02-18
> **Stack:** Next.js 14, MongoDB, NextAuth.js (Discord), next-intl (EN/AR)

---

## Completed

### 1. Discord Auth
- NextAuth v5 with Discord OAuth + MongoDBAdapter
- Database session strategy
- Sign-in/sign-out flows, protected routes via middleware
- Session includes Discord ID, username, global_name

### 2. User Profile (Read-Only)
- Displays: Discord info, level/XP, cards by game, stones, lunari, PvP record, game wins
- Data fetched from `/api/profile/game-data` (reads 7 MongoDB collections)
- Lightbox previews for cards/stones
- No editing capabilities

### 3. Cards Integration with DB
- `card_catalog` MongoDB collection with 158 cards
- `game` field on each card: `lunaFantasy` (93), `grandFantasy` (64), `bumper` (1)
- Indexed on `id` (unique), `rarity`, `game`
- `getCardCatalog(game?)` server-side fetch with in-memory cache
- 3 game pages (`/luna-fantasy`, `/grand-fantasy`, `/bumper`) each showing only their own cards
- Dynamic filter tabs based on actual rarity data

### 4. Games Navigation
- Navbar dropdown "Luna Games" with 3 sub-links
- Desktop: hover/click dropdown, mobile: expandable section
- Active state, click-outside close, RTL support

---

## Remaining

### 5. Stripe Integration — NOT STARTED
- No Stripe dependency, no API routes, no webhooks
- **Needs:**
  - Stripe account + API keys
  - `stripe` and `@stripe/stripe-js` packages
  - Webhook handler at `/api/webhooks/stripe`
  - Jewel packages (premium currency) with pricing

### 6. Jewels Purchasing System — NOT STARTED
- `InventoryItem` type exists but no shop UI
- **Needs:**
  - Store/shop page (`/store` or `/jewels`)
  - Jewel packages display with Stripe Checkout
  - `JewelBalance` + `JewelTransaction` collections in MongoDB
  - Balance display in navbar/profile
  - Purchase receipts + transaction history
  - Post-purchase confirmation

### 7. Cards Purchase — NOT STARTED
- Card catalog exists but no purchase flow
- **Needs:**
  - Pricing per card/rarity
  - Buy button on card gallery pages
  - Jewel deduction on purchase
  - `CardOwnership` tracking in MongoDB
  - "My Cards" / "Available" filters
  - Purchase confirmation modal + success animation

### 8. User's Cards Management — PARTIAL (display only)
- Profile shows collected cards grouped by game
- **Needs:**
  - Trading system between users
  - Selling/listing cards
  - Duplicate management (isDuplicate field exists, unused)
  - Card detail page

### 9. Bank Management System — INFO PAGE ONLY
- `/bank` page shows salary, loans, trading, VIP info from `bank.json`
- All action buttons redirect to Discord channel
- **Needs:**
  - Real DB operations (salary claim, loan request/repay, trading)
  - Shared API between web + Discord bot
  - Balance sync: bot action → API → DB → web reflects instantly
  - Interactive dashboard replacing static info
  - Bot updated to use Luna API as single source of truth
