# Luna Fantasy Platform Roadmap

> Created: 2026-02-14 | Last Updated: 2026-02-21

## Overview

Transform the Luna Fantasy static website into a full-stack platform with user authentication, payment processing, card management, and Discord bot integration (LunaButler & LunaJester).

## Tech Stack

- **Framework:** Next.js 14 (SSR mode — switch from static export)
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js + Discord OAuth2
- **Payments:** Stripe Checkout + Webhooks
- **Bot Communication:** REST API with API key authentication
- **Internationalization:** next-intl (existing)
- **Hosting:** Vercel or Railway (TBD)

---

## Phase 1: Foundation — Backend Infrastructure & Discord Auth

> **Status:** Not Started
> **Blocker for:** All other phases

### Deliverables

- [ ] Switch from static export to SSR (Server-Side Rendering)
- [ ] Set up PostgreSQL database with Prisma ORM
- [ ] Implement Discord OAuth authentication using NextAuth.js
- [ ] Create user profile pages
- [ ] Implement protected route middleware

### Details

- Remove `output: "export"` from next.config and configure for SSR
- Design initial Prisma schema: `User`, `Account`, `Session` models
- Discord OAuth flow: login via Discord, link Discord user ID to platform account
- Profile page shows Discord avatar, username, linked roles
- Middleware to protect authenticated routes (e.g., `/dashboard`, `/bank`, `/collection`)

---

## Phase 2: Stripe Integration & Jewels System

> **Status:** Not Started
> **Depends on:** Phase 1
> **Can run parallel with:** Phase 4

### Deliverables

- [ ] Set up Stripe Checkout integration
- [ ] Create Jewels (premium currency) system in database
- [ ] Build Jewels store page with package options
- [ ] Implement transaction history and purchase receipts
- [ ] Add Jewel balance display in navbar

### Details

- Stripe Checkout Sessions for one-time Jewel purchases
- Stripe Webhooks to confirm payment and credit Jewels
- Prisma models: `JewelTransaction`, `JewelBalance`
- Store page with multiple Jewel packages (pricing TBD)
- Transaction history page showing all purchases
- Navbar component showing current Jewel balance for logged-in users

---

## Phase 3: Cards Database & Purchase System

> **Status:** Not Started
> **Depends on:** Phase 2

### Deliverables

- [ ] Migrate all 158 cards from JSON to PostgreSQL with pricing
- [ ] Set pricing per rarity tier
- [ ] Create card purchase flow using Jewels
- [ ] Build user's card collection management page
- [ ] Implement card browsing with purchase UI

### Details

- Prisma models: `Card`, `UserCard`, `CardPurchase`
- Rarity tiers with pricing: Common, Rare, Epic, Unique, Legendary, Secret, Mythical
- Cards page with filtering by rarity, faction, search
- Purchase flow: select card → confirm Jewel spend → add to collection
- Collection page: view owned cards, stats, completion percentage
- Sync consideration: LunaJester already manages cards via MongoDB — need strategy for cross-system ownership

### Rarity Reference (from LunaJester)

| Rarity     | Weight | Pricing (Jewels TBD) |
|------------|--------|----------------------|
| COMMON     | High   | Low                  |
| RARE       | Medium | Medium               |
| EPIC       | Low    | High                 |
| UNIQUE     | Lower  | Higher               |
| LEGENDARY  | Very Low | Very High          |
| FORBIDDEN  | Lowest | Premium              |

---

## Phase 4: Bank Management System (Bot Integration)

> **Status:** Not Started
> **Depends on:** Phase 1 (partially Phase 2)
> **Can run parallel with:** Phase 2

### Deliverables

- [ ] Create Bank account system in database
- [ ] Implement REST API for bank operations
- [ ] Create Bot integration layer with API key authentication
- [ ] Build interactive bank dashboard on web
- [ ] Implement real-time sync between web and Discord bots

### Details

- Prisma models: `BankAccount`, `BankTransaction`, `Loan`, `Investment`, `Insurance`
- REST API endpoints:
  - `POST /api/bank/deposit` — Deposit Lunari
  - `POST /api/bank/withdraw` — Withdraw Lunari
  - `POST /api/bank/salary` — Claim salary
  - `POST /api/bank/loan` — Take/repay loans
  - `POST /api/bank/invest` — Manage investments
  - `POST /api/bank/insurance` — Purchase insurance
  - `GET /api/bank/balance` — Get account info
  - `GET /api/bank/transactions` — Transaction history
- API key auth for bot-to-web communication
- Web dashboard: view balance, loans, investments, transaction history
- Real-time sync: bots call REST API instead of direct DB writes

### Bot Integration Points

**LunaButler** (community management bot):
- Currently manages: Lunari currency, loans (10 tiers, 20% interest), VIP loans (15%), investments (30% over 30 days), insurance (500K lifetime), salary system, debt management
- Database: MongoDB via st.db — `points`, `cooldowns`, `system` collections
- Image server: port 3002

**LunaJester** (gaming & collectibles bot):
- Currently manages: Card battles, card pulls, card/stone trading, shops, Lunari spending
- Database: MongoDB via st.db — `points`, `cards`, `stones`, `tickets`, `inventory` collections
- Image server: port 3003

### Migration Strategy

- Both bots currently use MongoDB directly
- Phase 4 introduces a REST API layer between bots and the database
- Bots will be refactored to call the web API for bank/economy operations
- Card operations (Phase 3) will similarly route through the API
- Shared Lunari balance must be consistent across web + both bots

---

## Open Questions

> These need to be answered before/during implementation

1. **Hosting platform** — Vercel (easy Next.js deploy) vs Railway (more DB flexibility)?
2. **Database hosting** — Supabase, Railway PostgreSQL, or Neon?
3. **Jewel package pricing** — What packages and price points?
4. **Card scarcity model** — Unlimited supply vs limited editions?
5. **Bot codebase refactoring** — How much of LunaButler/LunaJester should be refactored to use the REST API?
6. **Card trading on web** — Should web support trading, or keep it Discord-only via LunaJester?
7. **Currency unification** — Are Jewels (paid) and Lunari (earned) separate, or convertible?
8. **Account linking** — How to link existing Discord bot users (with Lunari balances, cards, etc.) to new web accounts?

---

## Dependencies Diagram

```
Phase 1 (Foundation)
├── Phase 2 (Stripe & Jewels) ──→ Phase 3 (Cards & Purchases)
└── Phase 4 (Bank & Bot Integration)

Phase 2 and Phase 4 can run in parallel after Phase 1.
Phase 3 requires Phase 2 to be complete.
```
