# Luna Platform — Feature Status

> **Updated:** 2026-02-22
> **Stack:** Next.js 14, MongoDB, NextAuth.js (Discord), next-intl (EN/AR), Stripe

---

## Phase 1: Foundation — COMPLETE

### 1. Discord Auth ✅
- NextAuth v5 with Discord OAuth + MongoDBAdapter
- Database session strategy
- Sign-in/sign-out flows, protected routes via middleware
- Session includes Discord ID, username, global_name

### 2. User Profile ✅
- Displays: Discord info, level/XP, cards by game (card book), stones (tier system), lunari, tickets, PvP record, game wins, activity
- Treasury (Lunari + Tickets) integrated into hero card
- Data fetched from `/api/profile/game-data` (reads 7 MongoDB collections)
- Transaction history with pagination
- Account details section
- **Public profiles** — `/profile?discordId=...` shows any user's profile without auth
  - Private sections hidden (transactions, inventory, activity, email, sign out)
  - Public user info from `users` collection (name, avatar, discordId)
- Profile button navigates directly to `/profile` (no sign-out dropdown)
- **Player Stats redesign** — Level Orb (SVG ring + animated XP arc), Game Wins tiles (per-game color glow), PvP Arena (win-rate ring + W/L counters)

### 3. Cards Integration with DB ✅
- `card_catalog` MongoDB collection with 161 cards
- `game` field on each card: `lunaFantasy` (93), `grandFantasy` (64), `bumper` (3 + 1 original)
- Indexed on `id` (unique), `rarity`, `game`
- `getCardCatalog(game?)` server-side fetch with in-memory cache
- 3 game pages (`/luna-fantasy`, `/grand-fantasy`, `/bumper`) each showing only their own cards
- Dynamic filter tabs based on actual rarity data

### 4. Navigation ✅
- Navbar consolidated to 4 items: Home, Luna Games, World, Economy
- Luna Games dropdown: Luna Fantasy, Grand Fantasy, Bumper
- World dropdown: Story, Characters, Partners
- Economy dropdown: Bank, Bazaar (+ Marketplace when feature flag enabled)
- Desktop: hover/click dropdowns (mutual-exclusive), mobile: expandable sections
- Active state, click-outside close, RTL support

---

## Phase 2: Stripe + Bazaar + Economy — COMPLETE

### 5. Stripe Integration ✅
- `stripe` and `@stripe/stripe-js` packages installed
- 5 Lunari packages: Starter (5K/$0.99) → Mythic (500K/$39.99)
- `POST /api/stripe/checkout` — creates Stripe Checkout sessions
- `POST /api/webhooks/stripe` — handles webhook events with idempotency
- CSRF protection on purchase routes

### 6. Bazaar / Vendor System ✅
- `/bazaar` page with tabbed merchants + Lunari store
- **Kael Vandar** — Card luckboxes (6 tiers, 250–2,000L)
- **Meluna** — Moon stone mystery boxes (2,000L, 50% duplicate refund)
- **Zoldar** — Ticket broker (5 packages, 1K–5KL)
- **Support Luna** — Stripe Lunari purchases
- Balance display bar with real-time updates
- Debt blocking (users with loans cannot purchase)
- Mystery box reveal animation (3.5s sequence)
- Luckbox generates proper random ATK/weight per rarity range (matches bot behavior)
- Card names prefixed with "Luna " for lunaFantasy game, rarity stored UPPERCASE

### 7. Lunari Operations ✅
- Atomic `deductLunari()` with string-data fallback
- `creditLunari()` with upsert + optimistic concurrency
- `addToBankReserve()` for system reserve
- `checkDebt()` blocks indebted users
- Weighted random algorithm matching Discord bot exactly

### 8. Balance Sync ✅
- Browser CustomEvent system (`lunari-balance-update`)
- Navbar balance updates in real-time after bazaar purchases
- Profile displays live Lunari balance

### 9. Transaction History ✅
- `/api/profile/transactions` — last 20 transactions from `lunari_transactions`
- Paginated display (5 per page) in profile
- Lunari icon on amounts, clean header with count badge
- Supports: stripe_purchase, luckbox_spend, stonebox_spend, ticket_spend, refund

### 10. Bot Reference Documentation ✅
- `.plans/reference/luna-butler.md` — Economy, banking, XP/levels
- `.plans/reference/luna-jester.md` — Cards, stones, vendors, games
- `.plans/reference/shared-data.md` — Collection schemas, write patterns

---

## Phase 3: Cards Management + Profile — COMPLETE

### 11. Card Detail Modal ✅
- Reusable modal for any card (profile, catalog, marketplace)
- Shows: large image, name (Cinzel), rarity badge, ATK, weight, source, obtained date
- Duplicate count badge, grayscale overlay for unowned cards
- Actions slot for context buttons
- Escape key and overlay click to close

### 12. Card Book Enhancements ✅
- Duplicate indicator badges (`x{count}`) on cards with multiples
- Collection milestones per rarity with progress bars and completion glow
- Empty placeholder slots fill the 3×3 grid
- **3D page-fold animation** — perspective rotateY with shadow, two-layer system (incoming cards visible underneath folding page)
- Owned cards without catalog match still appear (robust merge logic)
- Bumper cards fixed (Bumper 1/2/3 added to catalog, matching bot data)

### 13. Card Data Fixes ✅
- Fixed ATK/weight showing 0 for web luckbox cards — `generateCardStats()` with rarity ranges
- Migrated bad cards in DB to proper stats
- Safety net in game-data API backfills attack/weight on the fly
- Fixed card name prefix and rarity casing mismatches

### 14. Partners Page ✅
- Partner data stored in MongoDB `partners` collection (4 partners)
- Partner images hosted on R2 CDN (`assets.lunarian.app/partners/`)
- Client-side fetch from `/api/partners` route (force-dynamic, no caching)
- Bilingual (EN/AR) names, types, descriptions, social links

---

## Phase 4: Marketplace System — BUILT (feature-flagged OFF)

> All code exists and is wired up. Gated behind `FEATURE_FLAGS.marketplace = false` in `src/lib/feature-flags.ts`. Needs testing and TS error fixes before enabling.

### 15. Card Marketplace (Buy/Sell)
- `card_marketplace` MongoDB collection with proper schema (not st.db envelope)
- Escrow model: card removed from seller on listing, returned on cancel/expire
- API routes: `listings`, `my-listings`, `list`, `buy`, `cancel`, `edit-price`
- Marketplace page with tabs: Browse, My Listings, Sell a Card
- Listing cards with rarity badge, price, seller, time remaining
- Atomic buy flow via `findOneAndUpdate`
- Rate limiting on marketplace actions

### 16. Auctions
- Extends marketplace with `type: "auction"` listings
- API routes: `auction/create`, `auction/bid`, `auction/resolve`, `auction/auto-resolve`
- Bidding UI with countdown timer, min bid increment
- Auto-resolve cron endpoint for expired auctions

### 17. Notifications
- `user_notifications` collection
- API routes: `GET /api/notifications`, `POST /api/notifications/read`
- `NotificationBell` component in Navbar with unread count badge
- Types: outbid, auction_won, auction_expired, card_sold, swap_received

### 18. Swaps & Trade Offers
- `card_swaps` collection with escrow model
- API routes: `propose`, `accept`, `decline`, `cancel`, `counter`, `incoming`, `outgoing`, `history`
- Public cards API: `GET /api/users/[discordId]/cards`
- Swap UI: incoming/outgoing offers, card-vs-card comparison, counter-offer flow

---

## Remaining

### 19. Bank Management System — INFO PAGE ONLY
- `/bank` page shows salary, loans, trading, VIP info statically
- All action buttons redirect to Discord channel
- **Needs:**
  - Real DB operations (salary claim, loan request/repay, trading)
  - Shared API between web + Discord bot
  - Balance sync: bot action → API → DB → web reflects instantly
  - Interactive dashboard replacing static info

### 20. Enable Marketplace — BLOCKED ON TESTING
- Fix 3 TS errors in marketplace/auction routes
- Add MongoDB indexes on `card_marketplace` and `card_swaps` collections
- End-to-end testing of all flows (list/buy/cancel/expire, auctions, swaps)
- Verify EN/AR translations for all marketplace screens
- Security review on new API routes
- Flip `FEATURE_FLAGS.marketplace` to `true`

---

## Architecture Notes

- **Database:** MongoDB (shared with Discord bots, not Prisma/PostgreSQL as originally planned)
- **Currency:** Lunari (single currency, no separate "Jewels" — Stripe purchases credit Lunari directly)
- **Assets:** R2 CDN at `assets.lunarian.app` (card images, stone images, merchant portraits, partner logos)
- **Hosting:** Vercel (SSR mode)
- **Feature Flags:** `src/lib/feature-flags.ts` gates unreleased features (marketplace)
