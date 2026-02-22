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
- Lightbox previews for cards/stones
- Account details section

### 3. Cards Integration with DB ✅
- `card_catalog` MongoDB collection with 158 cards
- `game` field on each card: `lunaFantasy` (93), `grandFantasy` (64), `bumper` (1)
- Indexed on `id` (unique), `rarity`, `game`
- `getCardCatalog(game?)` server-side fetch with in-memory cache
- 3 game pages (`/luna-fantasy`, `/grand-fantasy`, `/bumper`) each showing only their own cards
- Dynamic filter tabs based on actual rarity data

### 4. Navigation ✅
- Navbar consolidated to 4 items: Home, Luna Games, World, Economy
- Luna Games dropdown: Luna Fantasy, Grand Fantasy, Bumper
- World dropdown: Story, Characters, Partners
- Economy dropdown: Bank, Bazaar
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

## Remaining

### 11. User Cards Management — PARTIAL (display only)
- Profile shows collected cards in card book grouped by game
- **Needs:**
  - Trading system between users
  - Selling/listing cards
  - Duplicate management
  - Card detail page

### 12. Bank Management System — INFO PAGE ONLY
- `/bank` page shows salary, loans, trading, VIP info statically
- All action buttons redirect to Discord channel
- **Needs:**
  - Real DB operations (salary claim, loan request/repay, trading)
  - Shared API between web + Discord bot
  - Balance sync: bot action → API → DB → web reflects instantly
  - Interactive dashboard replacing static info

### 13. Partners Page ✅
- Partner data stored in MongoDB `partners` collection (4 partners)
- Partner images hosted on R2 CDN (`assets.lunarian.app/partners/`)
- Client-side fetch from `/api/partners` route (force-dynamic, no caching)
- Bilingual (EN/AR) names, types, descriptions, social links
- Seed script: `scripts/seed-partners.js`

---

## Architecture Notes

- **Database:** MongoDB (shared with Discord bots, not Prisma/PostgreSQL as originally planned)
- **Currency:** Lunari (single currency, no separate "Jewels" — Stripe purchases credit Lunari directly)
- **Assets:** R2 CDN at `assets.lunarian.app` (card images, stone images, merchant portraits, partner logos)
- **Hosting:** Vercel (SSR mode)
