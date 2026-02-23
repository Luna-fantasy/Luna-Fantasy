# Luna Fantasy Platform Roadmap

> **Built by:** Buried Games Studio
> **Domain:** lunarian.app
> **Created:** 2026-02-14

---

## Current State

Luna Fantasy is a **static Next.js 14 site** deployed to GitHub Pages:
- No backend / API routes (static export mode)
- No database — all data lives in JSON files
- No authentication or user accounts
- No payment processing
- Bank & Cards pages are informational only — actual gameplay runs on Discord bots
- Tech: Next.js 14, TypeScript, next-intl (EN/AR), gh-pages

---

## Target State

A full-stack platform where users can:
- Sign in with Discord
- Manage their profile and view stats
- Purchase jewels (premium currency) via Stripe
- Browse, purchase, and manage cards
- Interact with the Luna Bank system (synced with Discord bots)

---

## Phase 1: Foundation — Backend Infrastructure & Discord Auth

**Goal:** Move from static site to a full-stack app with user authentication.

**Duration estimate:** This phase is the critical foundation — everything else depends on it.

### 1.1 Switch from Static Export to SSR
- Remove `output: 'export'` from `next.config.js`
- Move deployment from GitHub Pages to a hosting platform that supports SSR (Vercel, Railway, or VPS)
- Update `next.config.js` to enable API routes and server-side rendering
- Set up environment variables (`.env.local`)
- Update image config (can re-enable Next.js image optimization)

### 1.2 Database Setup
- Choose database: **PostgreSQL** (recommended for relational data: users, cards, transactions)
- Set up **Prisma** ORM
- Design initial schema:
  ```
  User (id, discordId, username, displayName, avatar, email, role, createdAt)
  ```
- Set up migrations workflow
- Seed script for initial data (migrate cards.json, bank.json to DB)

### 1.3 Discord OAuth Authentication
- Install **NextAuth.js** (Auth.js v5)
- Configure Discord OAuth2 provider
- Create Discord application at discord.com/developers
- Implement:
  - `/api/auth/[...nextauth]` route
  - Sign in / Sign out flows
  - Session management (JWT or database sessions)
  - Protected route middleware
- UI:
  - "Sign in with Discord" button in Navbar
  - Auth state displayed in Navbar (avatar + username)
  - Redirect after login

### 1.4 User Profile Page
- New route: `/[locale]/profile`
- Display:
  - Discord avatar + username
  - Account creation date
  - Linked Discord ID
  - Placeholder sections for: Jewel balance, Cards owned, Bank stats (populated in later phases)
- Profile settings:
  - Display name preference
  - Language preference (persisted to DB instead of localStorage)
  - Notification preferences

### Deliverables
- [ ] SSR-enabled Next.js app deployed to new host
- [ ] PostgreSQL database with User table
- [ ] Discord OAuth login/logout working
- [ ] User profile page with basic info
- [ ] Protected routes middleware

---

## Phase 2: Stripe Integration & Jewels System

**Goal:** Users can purchase Jewels (premium currency) using real money via Stripe.

**Depends on:** Phase 1 (auth + DB)

### 2.1 Stripe Setup
- Create Stripe account and configure:
  - API keys (test + live)
  - Webhook endpoint
  - Product catalog (Jewel packages)
- Install `stripe` and `@stripe/stripe-js` packages
- Set up webhook handler at `/api/webhooks/stripe`

### 2.2 Jewels Currency System
- Extend Prisma schema:
  ```
  JewelBalance (userId, amount, updatedAt)
  JewelTransaction (id, userId, type[purchase/spend/refund], amount, stripePaymentId, description, createdAt)
  ```
- API routes:
  - `GET /api/jewels/balance` — get current balance
  - `POST /api/jewels/purchase` — create Stripe checkout session
  - Webhook handler to credit jewels after successful payment

### 2.3 Jewels Purchase Flow (UI)
- New route: `/[locale]/store` (or `/jewels`)
- Display Jewel packages with pricing (e.g., 100 Jewels = $0.99, 500 = $3.99, etc.)
- Stripe Checkout integration (redirect or embedded)
- Post-purchase confirmation page
- Transaction history in user profile
- Jewel balance displayed in Navbar (for logged-in users)

### 2.4 Purchase Receipts
- Generate receipt after each purchase
- Store in DB: amount, date, Stripe payment ID, Jewel amount credited
- Viewable in profile under "Purchase History"
- Email receipt via Stripe (built-in)

### Deliverables
- [ ] Stripe Checkout integration (test mode)
- [ ] Jewel packages store page
- [ ] Jewel balance tracking in DB
- [ ] Transaction history & receipts
- [ ] Webhook handling for payment confirmation
- [ ] Balance display in Navbar + Profile

---

## Phase 3: Cards Database & Purchase System

**Goal:** Migrate cards from static JSON to database. Allow users to purchase cards with Jewels.

**Depends on:** Phase 2 (Jewels system)

### 3.1 Cards Database Migration
- Extend Prisma schema:
  ```
  Card (id, nameEn, nameAr, rarity, imageUrl, characterId, price, totalSupply, currentSupply, createdAt)
  CardOwnership (id, userId, cardId, acquiredAt, acquiredVia[purchase/trade/reward])
  ```
- Migration script: import all 158 cards from `cards.json` into DB
- Set pricing per rarity tier:
  - Common: X Jewels
  - Rare: X Jewels
  - Epic: X Jewels
  - Unique / Legendary / Secret / Mythical: X Jewels (TBD)
- Optional: limited supply per card (scarcity)

### 3.2 Cards API
- API routes:
  - `GET /api/cards` — list all cards (with filters: rarity, owned, available)
  - `GET /api/cards/[id]` — single card details + ownership info
  - `POST /api/cards/[id]/purchase` — buy card with Jewels
  - `GET /api/user/cards` — list user's owned cards

### 3.3 Cards Purchase Flow (UI)
- Update existing `/cards` page:
  - Show price on each card
  - "Buy" button (requires login)
  - Jewel cost + confirmation modal
  - Success animation on purchase
- New filter: "My Cards" / "Available" / "Sold Out"
- Card detail modal: owner count, rarity, price, purchase button

### 3.4 User's Card Collection
- New route: `/[locale]/profile/cards` (or tab in profile)
- Grid display of all owned cards
- Filter by rarity
- Stats: total cards owned, completion percentage per rarity
- Trade-ready flag (for future trading feature)

### Deliverables
- [ ] All 158 cards migrated to database with pricing
- [ ] Card purchase flow with Jewel deduction
- [ ] User card collection page
- [ ] Updated cards browsing page with purchase UI
- [ ] Card ownership tracking

---

## Phase 4: Bank Management System (Bot Integration)

**Goal:** Connect the web bank system with the Discord bots for real-time balance sync.

**Depends on:** Phase 1 (auth + DB), partially Phase 2

### 4.1 Bank Database Schema
- Extend Prisma schema:
  ```
  BankAccount (id, userId, balance, isVip, vipSince, lastDailyClaim, lastMonthlyClaim, createdAt)
  BankTransaction (id, accountId, type[deposit/withdrawal/salary/loan/trade/insurance], amount, description, createdAt)
  Loan (id, accountId, amount, interestRate, dueDate, status[active/paid/defaulted], createdAt)
  Insurance (id, accountId, type, purchasedAt, active)
  ```

### 4.2 Bot Integration API
- Shared API layer between web app and Discord bot:
  - `GET /api/bank/account` — get user's bank account
  - `POST /api/bank/deposit` / `POST /api/bank/withdraw`
  - `POST /api/bank/claim-salary` — daily/monthly salary claim
  - `POST /api/bank/loan/request` — request loan
  - `POST /api/bank/loan/repay` — repay loan
  - `POST /api/bank/trade` — execute trade
  - `POST /api/bank/insurance/purchase` — buy insurance
- Authentication: API key for bot, JWT for web users
- Both bot and web app hit the same API = single source of truth

### 4.3 Bank Dashboard (UI)
- Update existing `/bank` page from informational to interactive:
  - Real balance display
  - Transaction history (paginated)
  - Salary claim button (with cooldown timer)
  - Loan management: request, view active, repay
  - Trading interface
  - VIP status & benefits
  - Insurance purchase

### 4.4 Bot Sync Protocol
- Discord bot updated to use Luna API instead of its own database
- Webhook/event system for real-time sync:
  - Bot action -> API call -> DB update -> web reflects instantly
  - Web action -> API call -> DB update -> bot reflects on next query
- Error handling for when API is unreachable from bot

### Deliverables
- [ ] Bank account system in database
- [ ] REST API for all bank operations
- [ ] Bot integration layer (API key auth)
- [ ] Interactive bank dashboard on web
- [ ] Real-time balance sync between web and Discord bot
- [ ] Salary, loans, trading, insurance all functional

---

## Technical Architecture (Target)

```
                    +------------------+
                    |   Discord Bot    |
                    | (existing bots)  |
                    +--------+---------+
                             |
                         API calls
                         (API key)
                             |
+------------+     +---------v---------+     +-------------+
|  Frontend  +----->   Next.js API     +----->  PostgreSQL  |
| (Next.js)  |     |   Routes (/api)   |     |  (Prisma)   |
+------+-----+     +---------+---------+     +-------------+
       |                     |
       |              +------v------+
       |              |   Stripe    |
       |              |  Webhooks   |
       |              +-------------+
       |
  +----v-----+
  | NextAuth  |
  | (Discord  |
  |  OAuth)   |
  +-----------+
```

### Key Technology Choices
| Layer          | Technology                  |
|----------------|-----------------------------|
| Framework      | Next.js 14 (SSR mode)       |
| Database       | PostgreSQL                  |
| ORM            | Prisma                      |
| Auth           | NextAuth.js + Discord OAuth |
| Payments       | Stripe Checkout + Webhooks  |
| Hosting        | Vercel or Railway           |
| Bot Comms      | REST API with API key auth  |
| i18n           | next-intl (existing)        |

### Database Schema Overview

```
User
  ├── JewelBalance
  ├── JewelTransaction[]
  ├── CardOwnership[]
  ├── BankAccount
  │     ├── BankTransaction[]
  │     ├── Loan[]
  │     └── Insurance[]
  └── Profile settings
```

---

## Priority & Dependencies

```
Phase 1 (Foundation)
  │
  ├──> Phase 2 (Stripe & Jewels)
  │       │
  │       └──> Phase 3 (Cards DB & Purchase)
  │
  └──> Phase 4 (Bank + Bot Integration)
```

- Phase 1 is a **hard blocker** for everything else
- Phase 2 and Phase 4 can run **in parallel** after Phase 1
- Phase 3 depends on Phase 2 (needs Jewels for purchasing)

---

## Open Questions (To Decide Before Starting)

1. **Hosting:** Where to deploy the SSR app? (Vercel recommended for Next.js)
2. **Database hosting:** Managed PostgreSQL provider? (Supabase, Neon, Railway, or self-hosted)
3. **Jewel pricing:** What are the Jewel package prices and card costs?
4. **Card scarcity:** Should cards have limited supply or unlimited?
5. **Bot codebase:** Where does the Discord bot code live? What language/framework? How does it currently store data?
6. **Card trading:** Should users be able to trade cards with each other? (Future phase?)
7. **Currency:** Is the bank currency (Luna coins) separate from Jewels, or the same?
8. **Existing bot users:** How to link existing Discord bot users with new web accounts?
