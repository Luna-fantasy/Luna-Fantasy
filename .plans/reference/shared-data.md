# Shared Data Layer Reference

> Quick reference for MongoDB collections shared between LunaButler, LunaJester, and the Luna Fantasy web app.
> Database: `"Database"` (all three systems share the same database)

---

## Shared Collections

| Collection | LunaButler | LunaJester | Web App | Purpose |
|---|---|---|---|---|
| `points` | R/W | R/W | R/W | Lunari balance |
| `tickets` | R/W | R/W | R/W | Ticket balance |
| `cards` | — | R/W | R/W | Card collections |
| `stones` | — | R/W | R/W | Stone collections |
| `system` | R/W | R/W | R/W (limited) | Bank reserve, debt, loans, insurance |
| `levels` | R/W | R | R | XP/level data |
| `cooldowns` | R/W | R/W | — | Command cooldowns |

### Web-Only Collections

| Collection | Purpose |
|---|---|
| `lunari_transactions` | Web purchase audit trail |
| `card_catalog` | Card pool for web luckbox draws |

---

## Collection Schemas

### `points`
```
{ _id: "discordUserId", data: <number | string> }
```
- `data` is Lunari balance
- Can be number (new) or string (legacy st.db)
- BSON type varies per document

### `tickets`
```
{ _id: "discordUserId", data: <number | string> }
```
- Same type variance as `points`

### `cards`
```
{ _id: "discordUserId", data: <Card[] | string> }
```
- `data` is an array of card objects, or a JSON string of the array (legacy)
- Card object: `{ id, name, attack, rarity, weight, imageUrl, source, obtainedDate }`

### `stones`
```
{ _id: "discordUserId", data: <{ stones: Stone[] } | string> }
```
- `data` is an object with `stones` array, or a JSON string (legacy)
- Stone object: `{ id, name, imageUrl, acquiredAt }`

### `system`
```
{ _id: "<key>", data: <mixed> }
```
Key patterns:
- `luna_bank_reserve` → number (total bank reserve)
- `debt_<discordId>` → number (outstanding debt, >0 = has debt)
- `loans_<discordId>` → array of loan objects
- `insurances_<discordId>` → array of insurance objects
- `investment_<discordId>` → investment object

### `lunari_transactions` (web-only)
```
{
  discordId: string,
  type: "luckbox_spend" | "stonebox_spend" | "ticket_spend" | "stripe_purchase",
  amount: number,          // negative for spends, positive for credits
  balanceBefore: number,
  balanceAfter: number,
  metadata: { ... },       // vendorId, packageId, itemReceived, stripeSessionId, etc.
  createdAt: Date,
  source: "web",
  status?: "pending" | "completed"  // used by stripe webhook
}
```

### `card_catalog` (web-only)
```
{
  _id: ObjectId,
  name: string | { en: string, ar: string },
  rarity: string,
  attack: number,
  imageUrl: string,
  weight: number,
  game?: string
}
```

---

## Write Patterns

### `$inc` (Atomic Increment)
Used for: `points`, `tickets`, `system` (bank_reserve, debt)
```javascript
// Primary path — works when data is numeric
collection.findOneAndUpdate(
  { _id: discordId },
  { $inc: { data: amount } },
  { upsert: true, returnDocument: 'after' }
);
```
**Fails with error code 14 (TypeMismatch) when `data` is a string.**

### `$set` (Direct Set)
Used for: fallback on string data, `cards`, `stones`, `levels`, `system` (loans, investments)
```javascript
// Fallback after TypeMismatch — read, parse, compute, set
const doc = await collection.findOne({ _id: discordId });
const current = parseInt(doc.data, 10) || 0;
await collection.updateOne(
  { _id: discordId },
  { $set: { data: current + amount } },
  { upsert: true }
);
```

### Read-Modify-Write (Array Operations)
Used for: `cards` (push card to array), `stones` (push stone to object)
```javascript
const doc = await collection.findOne({ _id: discordId });
const cards = parseArray(doc.data);
cards.push(newCard);
await collection.updateOne(
  { _id: discordId },
  { $set: { data: cards } },
  { upsert: true }
);
```

---

## Concurrency Considerations

### Problem: `$inc` on String Data
When st.db stores a number as a string (e.g., `"1000"` instead of `1000`), MongoDB's `$inc` throws TypeMismatch (error code 14). All web write operations must catch this and fall through to a `$set` fallback.

### Problem: Read-Modify-Write Race
The `$set` fallback does read → compute → write. Two concurrent operations can both read `1000`, both compute `1500`, and the second write overwrites the first (losing 500).

**Web solution for deductions (`deductLunari`):**
```javascript
// Optimistic concurrency — exact match on old value + retry
for (let retry = 0; retry < 3; retry++) {
  const doc = await collection.findOne({ _id: discordId });
  const result = await collection.updateOne(
    { _id: discordId, data: doc.data },  // exact match
    { $set: { data: newBalance } }
  );
  if (result.modifiedCount > 0) return success;
  // Retry with jittered delay
  await sleep(50 + Math.random() * 100);
}
```

**Web solution for credits (`creditLunari`):**
Same optimistic concurrency pattern with `$setOnInsert` for new documents.

### Problem: Stripe Webhook Double-Credit
If `creditLunari` succeeds but `logTransaction` throws, Stripe retries the webhook. The idempotency check (`isStripeSessionProcessed`) finds no transaction record, so the user gets credited again.

**Web solution:** Insert a `pending` transaction record FIRST, then credit, then update to `completed`. On retry, `isStripeSessionProcessed` finds the pending record and skips.

---

## Price Comparison: Bot vs Web

All vendor prices are **identical** between bot and web:

| Item | Price |
|---|---|
| Common Luckbox | 250 |
| Rare Luckbox | 500 |
| Epic Luckbox | 750 |
| Unique Luckbox | 1,000 |
| Legendary Luckbox | 1,500 |
| Secret Luckbox | 2,000 |
| Stone Box | 2,000 |
| Ticket Pack 1 (1x) | 1,000 |
| Ticket Pack 2 (2x) | 2,000 |
| Ticket Pack 3 (3x) | 3,000 |
| Ticket Pack 4 (4x) | 4,000 |
| Ticket Pack 5 (5x) | 5,000 |

### Web-Only: Stripe Lunari Packages

| Package | Lunari | USD |
|---|---|---|
| Starter | 5,000 | $0.99 |
| Explorer | 25,000 | $3.99 |
| Champion | 60,000 | $7.99 |
| Legend | 150,000 | $14.99 |
| Mythic | 500,000 | $39.99 |

---

## Web Security Layer (Not Present in Bots)

| Feature | Details |
|---|---|
| Rate Limiting | In-memory sliding window: luckbox/stonebox/tickets 5/min, stripe 3/5min |
| CSRF | Double-submit cookie, `crypto.timingSafeEqual`, 24h maxAge, refreshed on purchase |
| Daily Spending Cap | 50,000 Lunari/day (aggregated from `lunari_transactions`) |
| Debt Blocking | Users with `debt_<id> > 0` in `system` cannot purchase |
| Optimistic Concurrency | String fallback paths use exact-match + retry for atomicity |

---

## Key Difference: Duplicate Handling

| Item | Bot Behavior | Web Behavior |
|---|---|---|
| Duplicate Card | Lunari deducted, card NOT added | Same as bot |
| Duplicate Stone | Stone IS added, 50% chance of 1,000L refund | Same as bot |
