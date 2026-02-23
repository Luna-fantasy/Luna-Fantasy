# Phase 2: Stripe + Lunari + Web Bazaar

## Context

The original roadmap assumed a "Jewels" premium currency bought with real money. After deep-diving into LunaJester and LunaButler, the actual economy uses **Lunari** (in-game currency) with **no real-money integration**. The Discord bots have 6 NPC shops including **mystery boxes** (card luckboxes and moon stone boxes). Phase 2 brings the full commerce loop to the web: Stripe to buy Lunari with real money + a web Bazaar to spend it.

**Deferred to Phase 2B:** Brimor/Broker role shops (need Discord bot token for role assignment) and Seluna limited vendor (time-gated stock management with limited supply).

---

## Critical: MongoDB Data Format (st.db)

All bot data uses st.db format: `{ _id: key, data: value }`.

| Collection | `data` type | Read pattern | Write pattern |
|---|---|---|---|
| `points` | **number** (via `$inc`) | `db.get(userId)` → number or string | `db.add(userId, amount)` → MongoDB `$inc` (atomic) |
| `cards` | **JSON array** | `db.get(userId)` → CardRecord[] | `db.push(userId, cardObj)` → appends to array |
| `stones` | **JSON object** `{stones:[]}` | `db.get(userId)` → `{stones: StoneData[]}` | `db.set(userId, {stones: [...]})` → overwrites entire object |
| `tickets` | **number** (via `$inc`) | `db.get(userId)` → number | `db.add(userId, amount)` → MongoDB `$inc` (atomic) |
| `system` (`luna_bank_reserve`) | **number** | `db.get('luna_bank_reserve')` → number | `db.add('luna_bank_reserve', amount)` → `$inc` |
| `system` (`debt_{userId}`) | **number** | `db.get('debt_{userId}')` → number or undefined | set by LunaButler banking |

**Key: `points` and `tickets` use `$inc` (atomic).** No need for optimistic concurrency on these — we can use `findOneAndUpdate` with `$inc` and a `$gte` condition for atomic check-and-deduct.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/[locale]/bazaar/page.tsx` | Bazaar page (server component, metadata) |
| `src/app/[locale]/bazaar/BazaarContent.tsx` | Main client component (tabs, vendor switching, balance) |
| `src/app/[locale]/bazaar/VendorKael.tsx` | Card luckbox shop (6 rarity tiers) |
| `src/app/[locale]/bazaar/VendorMeluna.tsx` | Moon stone mystery box shop |
| `src/app/[locale]/bazaar/VendorZoldar.tsx` | Ticket package shop |
| `src/app/[locale]/bazaar/LunariStore.tsx` | Stripe Lunari purchase packages |
| `src/app/[locale]/bazaar/RevealModal.tsx` | Animated mystery box reveal |
| `src/app/api/stripe/checkout/route.ts` | Create Stripe Checkout session |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook (credit Lunari) |
| `src/app/api/bazaar/luckbox/route.ts` | Buy card luckbox |
| `src/app/api/bazaar/stonebox/route.ts` | Buy moon stone box |
| `src/app/api/bazaar/tickets/route.ts` | Buy ticket package |
| `src/app/api/bazaar/catalog/route.ts` | Get shop catalog + user balance |
| `src/app/api/profile/transactions/route.ts` | Transaction history |
| `src/lib/stripe.ts` | Stripe client singleton + package config |
| `src/lib/bazaar/weighted-random.ts` | Weighted random selection (matches bot exactly) |
| `src/lib/bazaar/luckbox-config.ts` | Luckbox tier config (prices, rarities) |
| `src/lib/bazaar/stone-config.ts` | Stone weights + box config |
| `src/lib/bazaar/lunari-ops.ts` | Atomic Lunari credit/debit via `$inc` |
| `src/lib/bazaar/card-ops.ts` | Card collection read/write (push to array) |
| `src/lib/bazaar/stone-ops.ts` | Stone collection read/write (set entire object) |
| `src/lib/bazaar/ticket-ops.ts` | Ticket read/write (atomic `$inc`) |
| `src/types/bazaar.ts` | Bazaar TypeScript types |
| `src/styles/bazaar.css` | Bazaar page + vendor styles |
| `src/styles/bazaar-reveal.css` | Mystery box reveal animations |

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `stripe`, `@stripe/stripe-js` |
| `messages/en.json` | Add `bazaarPage` namespace |
| `messages/ar.json` | Add `bazaarPage` namespace (Arabic) |
| `src/components/Navbar.tsx` | Add "Bazaar" nav link |
| `middleware.ts` | Add `/bazaar` to protected routes |
| `src/app/[locale]/profile/ProfileContent.tsx` | Add transaction history section |
| `src/styles/profile-game.css` | Transaction history styles |

---

## Step 1: Stripe Infrastructure

### Dependencies
```bash
pnpm add stripe @stripe/stripe-js
```

### Environment Variables (`.env.local`)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Lunari Packages

| Package | Lunari | USD | Context |
|---------|--------|-----|---------|
| Starter | 5,000 | $0.99 | ~2 days of daily rewards |
| Explorer | 25,000 | $3.99 | ~12 Secret luckboxes |
| Champion | 60,000 | $7.99 | ~30 stone boxes |
| Legend | 150,000 | $14.99 | ~Brimor shop items |
| Mythic | 500,000 | $39.99 | ~Diamond role tier |

Create as Products + Prices in Stripe Dashboard. Store Price IDs in `src/lib/stripe.ts`.

### `POST /api/stripe/checkout`
- Auth required (session with discordId)
- Body: `{ packageId: "starter" | "explorer" | ... }`
- Creates Stripe Checkout Session with `metadata: { discordId, packageId, lunariAmount }`
- `success_url: /bazaar?purchase=success&session_id={CHECKOUT_SESSION_ID}`
- `cancel_url: /bazaar?purchase=cancelled`
- Returns `{ url }` for redirect

### `POST /api/webhooks/stripe`
- **No auth** (Stripe-signed payload — middleware must NOT protect `/api/webhooks/stripe`)
- Use `request.text()` for raw body (App Router)
- Verify with `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`
- Handle `checkout.session.completed` event
- **Idempotency**: check `lunari_transactions` for existing `stripeSessionId` before crediting
- Credit Lunari via `$inc` on `points` collection
- Add to bank reserve via `$inc` on `system` collection
- Create `lunari_transactions` record
- Return 200 OK

---

## Step 2: Atomic Lunari Operations (`src/lib/bazaar/lunari-ops.ts`)

The `points` collection stores balance as a number (via st.db `$inc` ops). We use MongoDB atomic operations.

### `deductLunari(discordId, amount)` — Atomic check-and-deduct
```typescript
// Single atomic operation: only deducts if balance >= amount
const result = await collection.findOneAndUpdate(
  { _id: discordId, data: { $gte: amount } },
  { $inc: { data: -amount } },
  { returnDocument: 'after' }
);
if (!result) {
  // Either user doesn't exist or insufficient balance
  return { success: false, ... };
}
return { success: true, balanceAfter: result.data };
```

**Edge case**: If `data` is stored as a string (legacy), the `$gte` check won't work. Add a fallback that reads, parses, and uses optimistic concurrency:
```typescript
// Fallback for string data:
const doc = await collection.findOne({ _id: discordId });
const balance = typeof doc.data === 'string' ? parseInt(doc.data, 10) : (doc.data || 0);
if (balance < amount) return { success: false };
const result = await collection.updateOne(
  { _id: discordId, data: doc.data },  // Exact match on old value
  { $set: { data: balance - amount } }
);
if (result.modifiedCount === 0) retry; // Up to 3 retries
```

### `creditLunari(discordId, amount)` — For Stripe webhook
```typescript
await collection.findOneAndUpdate(
  { _id: discordId },
  { $inc: { data: amount } },
  { upsert: true, returnDocument: 'after' }
);
```

### `addToBankReserve(amount)` — Must call on every purchase
```typescript
await systemCollection.findOneAndUpdate(
  { _id: 'luna_bank_reserve' },
  { $inc: { data: amount } },
  { upsert: true }
);
```

### `checkDebt(discordId)` — Block purchases for users with debt
```typescript
const debtDoc = await systemCollection.findOne({ _id: `debt_${discordId}` });
const debt = debtDoc?.data || 0;
return debt > 0;
```

---

## Step 3: Weighted Random Algorithm (`src/lib/bazaar/weighted-random.ts`)

**Must match bot exactly.** The bot uses a pool-based approach:

```typescript
function weightedRandomDraw<T extends { weight: number }>(items: T[]): T {
  // Filter out weight-0 items (admin-only)
  const eligible = items.filter(i => i.weight > 0);

  // Build pool: each item gets Math.max(1, Math.round(weight * 1000)) entries
  const pool: T[] = [];
  for (const item of eligible) {
    const entries = Math.max(1, Math.round(item.weight * 1000));
    for (let i = 0; i < entries; i++) {
      pool.push(item);
    }
  }

  // Random selection
  return pool[Math.floor(Math.random() * pool.length)];
}
```

**Weight examples:**
- weight 20 → 20,000 entries (most common)
- weight 0.05 → 50 entries (very rare)
- weight 0.001 → 1 entry (ultra rare)
- weight 0 → excluded (admin-only)

---

## Step 4: Bazaar API Routes

### Shared: Validation Sequence (matches bot order)
```
1. Auth check (session with discordId)
2. Debt check (query system DB for debt_{discordId})
3. Input validation (tier, count, etc.)
4. Fresh balance read
5. Balance check (>= price)
6. Draw random item (for mystery boxes)
7. Atomic Lunari deduction (findOneAndUpdate with $gte)
8. Add to bank reserve
9. Grant item (card/stone/tickets)
10. Log transaction to lunari_transactions
11. Return result
12. On error after step 7: REFUND Lunari via creditLunari()
```

### `POST /api/bazaar/luckbox` — Card Mystery Box (Kael Vandar)

**Config:**
| Tier | Price | Rarity filter |
|------|-------|---------------|
| common | 250 | `common` |
| rare | 500 | `rare` |
| epic | 750 | `epic` |
| unique | 1000 | `unique` |
| legendary | 1500 | `legendary` |
| secret | 2000 | `secret` |

**Flow:**
1. Validate `tier` is one of the 6 valid values
2. Check debt → check balance
3. Query `card_catalog` collection for cards matching rarity (these have `weight` field)
4. Run `weightedRandomDraw()` on filtered cards
5. Check if user already owns card: read `cards` doc, check `Set(cards.map(c => c.name)).has(drawnCard.name)`
6. Atomic deduct Lunari
7. Add to bank reserve
8. **If NOT duplicate**: push card to user's `cards` collection with this exact format:
   ```typescript
   {
     name: card.name,
     rarity: card.rarity,
     attack: card.attack,
     imageUrl: card.imageUrl,
     weight: card.weight,
     source: tierName,              // e.g., "Common", "Legendary"
     obtainedDate: new Date().toISOString(),
     id: `${card.name}_${Date.now()}_${counter++}`
   }
   ```
   **Writing to cards collection:** The `data` field is a JSON array. Read current array, push new card, write back:
   ```typescript
   const doc = await cardsCollection.findOne({ _id: discordId });
   const cards = doc?.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : [];
   cards.push(newCardRecord);
   await cardsCollection.updateOne(
     { _id: discordId },
     { $set: { data: cards } },
     { upsert: true }
   );
   ```
9. **If duplicate**: Lunari is STILL deducted, card is NOT added. User is warned.
10. Log to `lunari_transactions`
11. **On error after deduction**: Refund Lunari

**Returns:** `{ card: { name, rarity, imageUrl, attack }, isDuplicate, newBalance }`

### `POST /api/bazaar/stonebox` — Moon Stone Box (Meluna)

**Config:** Fixed price 2,000 Lunari. Stones with weights:

| Stone | Weight | Drop % |
|-------|--------|--------|
| Lunar Stone | 20 | 37.1% |
| Silver Beach Gem | 15 | 27.8% |
| Wishmaster Broken Cube | 10 | 18.6% |
| Dragon's Tear | 5 | 9.3% |
| Solar Stone | 3 | 5.6% |
| Galaxy Stone | 1 | 1.9% |
| Stone of Wisdom | 0.5 | 0.93% |
| Astral Prism | 0.2 | 0.37% |
| Eternal Stone | 0.1 | 0.19% |
| Mastermind Stone | 0.05 | 0.09% |
| Luna Moon Stone | 0 | admin-only |
| Moonbound Emerald | 0 | admin-only |

**Flow:**
1. Check debt → check balance >= 2000
2. Run `weightedRandomDraw()` on stones (excludes weight-0)
3. Check if user already owns this stone: read stones doc, check names
4. Atomic deduct 2,000 Lunari
5. **If duplicate**: 50% chance (`Math.random() < 0.5`) of 1,000L refund
   - If refund: credit 1,000 Lunari back, bank reserve gets net 1,000 (not 2,000)
   - If no refund: bank reserve gets full 2,000
6. **Stone is ALWAYS added** (even if duplicate — unlike cards!)
   Writing to stones collection:
   ```typescript
   const doc = await stonesCollection.findOne({ _id: discordId });
   const data = doc?.data ? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) : { stones: [] };
   data.stones.push({
     id: Date.now() + Math.random(),
     name: stone.name,
     imageUrl: stone.imageUrl,
     acquiredAt: new Date().toISOString()
   });
   await stonesCollection.updateOne(
     { _id: discordId },
     { $set: { data: data } },
     { upsert: true }
   );
   ```
7. Add to bank reserve (full price minus any refund)
8. Log transaction
9. **On error after deduction**: Refund Lunari

**Returns:** `{ stone: { name, imageUrl }, isDuplicate, refundAmount, newBalance }`

### `POST /api/bazaar/tickets` — Ticket Shop (Zoldar)

**Config:** 5 packages matching bot:

| Package | Name | Tickets | Price |
|---------|------|---------|-------|
| pack1 | Moon Dust | 1 | 1,000 |
| pack2 | Luna Potion | 2 | 2,000 |
| pack3 | Lunar Orb | 3 | 3,000 |
| pack4 | Pegasus Thigh | 4 | 4,000 |
| pack5 | Dragon Eyes | 5 | 5,000 |

**Flow:**
1. Validate `packageId` is pack1-pack5
2. Check debt → check balance >= price
3. Atomic deduct Lunari
4. Add to bank reserve
5. Add tickets via `$inc`:
   ```typescript
   await ticketsCollection.findOneAndUpdate(
     { _id: discordId },
     { $inc: { data: ticketCount } },
     { upsert: true }
   );
   ```
6. Log transaction

**Returns:** `{ ticketsAdded, newBalance, totalTickets }`

### `GET /api/bazaar/catalog` — Shop Data
- Optional auth (shows user balance + debt status if logged in)
- Returns: luckbox tiers with card counts per rarity, stone box config, ticket packages, user balance

---

## Step 5: Bazaar Page UI

### Layout: One page (`/bazaar`) with tabbed vendors
```
┌─────────────────────────────────────────┐
│  BAZAAR HERO (banner, title, subtitle)  │
├─────────────────────────────────────────┤
│  Balance: 12,500 Lunari    [Buy Lunari] │
├─────────────────────────────────────────┤
│  [Kael Vandar] [Meluna] [Zoldar] [Store]│
├─────────────────────────────────────────┤
│  ACTIVE VENDOR CONTENT                  │
│  (renders selected vendor component)    │
└─────────────────────────────────────────┘
```

### VendorKael — 6 luckbox tier cards in a 2×3 grid
Each card: rarity-colored border/glow (using existing `--common`, `--rare`, etc. CSS vars), price in Lunari, card count badge, "Open Luckbox" button (disabled if insufficient balance or in debt)

### VendorMeluna — Single box + expandable drop rate table
Box card with price (2,000L) + "Open Box" button. Expandable section showing drop percentage for each stone (calculated from weights). Duplicate refund info: "50% chance of 1,000L refund on duplicates".

### VendorZoldar — 5 ticket packages in a grid
Package cards with thematic names (Moon Dust, Luna Potion, etc.), ticket count, price, buy button. Shows current ticket balance.

### LunariStore — 5 Stripe packages
Grid of package cards with Lunari amount, USD price, "Buy Now" button. Stripe badge for trust. Redirects to Stripe Checkout on click.

---

## Step 6: Mystery Box Reveal Animation (`RevealModal.tsx`)

Modal overlay with phased CSS animation (~3.5 seconds):

**Card reveal:**
1. (0-0.8s) Box appears, shakes with rarity-colored glow
2. (0.8-1.5s) Box opens, particle burst in rarity color
3. (1.5-2.5s) Card slides up and flips to reveal face
4. (2.5-3.5s) Name + rarity badge + attack power appear, glow settles
5. If duplicate: "Already in your collection!" overlay with dimmed card

**Stone reveal:**
1. Box cracks with purple energy
2. Stone floats up with rotating glow
3. Name revealed with shimmer
4. If duplicate + refund: "Duplicate! 1,000L refunded" with coin animation
5. If duplicate + no refund: "Duplicate! No refund this time"

All CSS `@keyframes`, no JS animation libraries. Phase transitions via `useState` + `setTimeout`.

After reveal: "Close" and "Buy Another" buttons.

---

## Step 7: Navigation + Profile Integration

### Navbar
Add "Bazaar" link between Bank and Partners (desktop nav + mobile sidebar). Follow existing `nav-link` + `isActive()` pattern in `src/components/Navbar.tsx`.

### Middleware
Add `/bazaar` to protected routes in `middleware.ts`. **Do NOT protect `/api/webhooks/stripe`** — Stripe calls this without auth (already skipped since middleware skips `/api` routes).

### Profile — Transaction History
New `.profile-card` section in ProfileContent below Treasury showing recent web purchases. Fetched from `GET /api/profile/transactions` (reads `lunari_transactions` collection, last 20, sorted by `createdAt` desc).

---

## Step 8: Translations

Add `bazaarPage` namespace to both `messages/en.json` and `messages/ar.json`:
- `title`, `subtitle` — page hero
- `balance`, `buyLunari`, `insufficientBalance`, `inDebt` — balance bar
- `tabs.*` — vendor tab names
- `kael.*` — Kael Vandar vendor text (name, title, desc, openBox, cards)
- `meluna.*` — Meluna vendor text (name, title, desc, openBox, dropRates, duplicateInfo)
- `zoldar.*` — Zoldar vendor text (name, title, desc, buyTickets, currentTickets, package names)
- `store.*` — Lunari store text (title, desc, securePayment, buy)
- `reveal.*` — mystery box reveal (opening, youGot, duplicate, refund, noRefund, close, buyAnother, alreadyOwned)
- `purchase.*` — Stripe status (success, credited, cancelled, error)
- `transactions.*` — history labels (title, empty, type names)

---

## Database: New Collections

### `lunari_transactions`
```typescript
{
  _id: ObjectId,
  discordId: string,
  type: "stripe_purchase" | "luckbox_spend" | "stonebox_spend" | "ticket_spend" | "refund",
  amount: number,            // positive = credit, negative = debit
  balanceBefore: number,
  balanceAfter: number,
  metadata: {
    stripeSessionId?: string,
    stripePaymentIntentId?: string,
    packageId?: string,
    vendorId?: string,
    itemReceived?: string,
    itemRarity?: string,
    isDuplicate?: boolean,
    refundAmount?: number,
  },
  createdAt: Date,
  source: "web",
}
```
Index: `{ discordId: 1, createdAt: -1 }` + unique index on `metadata.stripeSessionId` (for webhook idempotency)

### Existing collections written to:
- `points` — Lunari balance (atomic `$inc`, `findOneAndUpdate` with `$gte` guard)
- `cards` — append card record to user's data array (read → push → write)
- `stones` — append stone to `data.stones` array (read → push → set entire object)
- `tickets` — increment ticket count (atomic `$inc`)
- `system` (`luna_bank_reserve`) — increment reserve (atomic `$inc`)
- `system` (`debt_{userId}`) — read-only check for debt blocking

---

## Error Handling & Refund Pattern

**Matching bot behavior:** If Lunari is deducted but item grant fails:

```typescript
try {
  // 1. Deduct Lunari (atomic)
  const deductResult = await deductLunari(discordId, price);
  if (!deductResult.success) return { error: "Insufficient balance" };

  // 2. Add to bank reserve
  await addToBankReserve(price);

  // 3. Grant item (card/stone/tickets)
  await grantItem(...);

  // 4. Log transaction
  await logTransaction(...);

} catch (error) {
  // REFUND: add Lunari back
  await creditLunari(discordId, price).catch(() => {});
  // Note: bank reserve is NOT reversed (matches bot behavior)
  return { error: "Purchase failed. Lunari refunded." };
}
```

---

## Implementation Order

1. **Types** — `src/types/bazaar.ts`
2. **Stripe infra** — `src/lib/stripe.ts`, env vars, `POST /api/stripe/checkout`, `POST /api/webhooks/stripe`
3. **Lunari ops** — `src/lib/bazaar/lunari-ops.ts` (deduct, credit, bank reserve, debt check)
4. **Weighted random** — `src/lib/bazaar/weighted-random.ts`
5. **Shop configs** — `luckbox-config.ts`, `stone-config.ts`
6. **Item ops** — `card-ops.ts`, `stone-ops.ts`, `ticket-ops.ts`
7. **Bazaar API routes** — luckbox, stonebox, tickets, catalog
8. **Translations** — en.json, ar.json
9. **Bazaar page UI** — page.tsx, BazaarContent, 4 vendor components
10. **Reveal modal** — RevealModal + CSS animations
11. **Navbar + middleware** — add Bazaar link, protect route
12. **LunariStore purchase flow** — Stripe redirect + success handling
13. **Profile integration** — transaction history section + API
14. **CSS** — bazaar.css, bazaar-reveal.css
15. **Testing** — full flows, concurrency, RTL, mobile, error states

---

## Verification

1. **Stripe flow**: Buy Starter Pack → Stripe Checkout → test card 4242... → webhook → 5,000L credited → bank reserve +5,000 → success page → balance updated
2. **Card luckbox**: Open Rare box (500L) → animated card reveal → card in collection → balance -500 → bank reserve +500
3. **Card duplicate**: Open box → get card already owned → Lunari deducted → card NOT added → "Already in collection" message
4. **Stone box**: Open box (2,000L) → stone reveal → stone added to collection
5. **Stone duplicate**: Open box → get owned stone → 50% chance: refund 1,000L or no refund → stone still added
6. **Tickets**: Buy 3-pack (3,000L) → tickets +3 → balance -3,000 → bank reserve +3,000
7. **Debt block**: User with debt → all shop buttons disabled → "Pay your debts" message
8. **Insufficient balance**: Try to buy with not enough Lunari → clear error, no deduction
9. **Concurrency**: Two rapid purchases → atomic `$inc` prevents negative balance or double-spend
10. **Stripe webhook idempotency**: Same webhook delivered twice → Lunari only credited once
11. **Error recovery**: If card grant fails after deduction → Lunari refunded automatically
12. **Arabic/RTL**: All bazaar text + layout correct in Arabic
13. **Mobile**: Fully responsive, vendor tabs scrollable
14. **Stripe CLI test**: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## Key Reference Files

- MongoDB connection: `src/lib/mongodb.ts`
- Existing API pattern: `src/app/api/profile/game-data/route.ts`
- Card catalog fetch: `src/lib/cards.ts` (`getCardCatalog()`)
- Existing types: `src/types/gameData.ts`
- Navbar: `src/components/Navbar.tsx`
- Profile: `src/app/[locale]/profile/ProfileContent.tsx`
- Bank page pattern: `src/app/[locale]/bank/BankContent.tsx`
- Middleware: `middleware.ts`
- Styles: `src/styles/profile-game.css`, `src/styles/globals.css`
