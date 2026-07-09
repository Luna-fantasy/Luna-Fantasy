I have a complete picture of Jester's money flows. Here is the audit.

---

# LunaJesterMain — Money-Flow & Exploit Audit

**Root theme:** Butler just got atomic bet escrow + `deductIfSufficient` (an atomic `$gte`-guarded deduct). **Jester never received any of that.** Every Lunari/ticket movement in Jester is non-atomic check-then-deduct, and the deduct itself is an unconditional `$inc`. This is the same exploit class Butler just closed, and it is systemic here.

## TOP OPPORTUNITIES (ranked)

### 1. `removePoints` / `removeTickets` are unconditional `$inc` — balances go negative, no atomic guard
`util/managers/points.ts:160-164` and `util/managers/tickets.ts:63-68`.
```
$inc: { balance: -(+amount) }   // no {balance: {$gte: amount}} filter, no floor at 0
```
Every purchase and game payment first reads balance (often cached), then calls this in a separate `await`. Two actions that both pass the check both deduct.
- **Exploit:** User with 1,000 Lunari opens two shops (or double-clicks buy on an item without a lock, or bids/gifts concurrently) each costing 1,000. Both `getPoints`/`getPointsFresh` checks pass, both `removePoints` run → balance = **-1,000**. Negative balance then blocks nothing (no `$gte`), and can be "filled" by legit earnings, effectively free purchases.
- **Impact:** Direct money creation / negative-balance drift across the entire economy.
- **Effort:** M — port Butler's `deductIfSufficient` (atomic `findOneAndUpdate` with `{balance:{$gte:amount}}`, legacy string/`data` migration) into Jester's PointsManager + a `removeTicketsIfSufficient`, then switch every purchase/game-payment call site to check the return value instead of read-then-deduct.
- **Rec:** Add `deductIfSufficient` to Jester PointsManager/TicketsManager and route all spend paths through it.

### 2. Meluna "sell duplicates" has no purchase lock — double-click double-pays
`commands/shops/meluna_vendor.ts:519-567`. The confirm handler has **no `activePurchases` guard** (unlike the buy handler). `stonesManager.removeDuplicates` is read-filter-write (`stones.ts:120-135`), and `addPoints` is unconditional.
- **Exploit:** User owns 5 of a stone (sell price 10k). Double-click "تأكيد البيع". Both handlers read count=5, both compute `actualToSell=4`, both `addPoints(40k)`. The two removeDuplicates writes both leave "1 copy," but the user is paid **80k for 4 stones**. Repeatable.
- **Impact:** Money printing + duplicate stone loss mismatch.
- **Effort:** S — wrap the confirm branch in the same `activePurchases` lock used elsewhere; ideally make `removeDuplicates` return the actually-removed count from an atomic pull and pay on that.
- **Rec:** Add per-user lock to the sell-confirm path and pay strictly on rows actually removed.

### 3. Trade/gift balance checks read the *cached* balance (`getPoints`), not fresh
`commands/trading/cards_trade.ts:1543`, `commands/trading/stones_trade.ts:1543`, `commands/trading/gift.ts:210` all gate on `getPoints` (3-min `pointsCache`, `cache_manager.ts:128`). Butler writes the **same** `points` doc, and Jester's own deducts only refresh the local cache — the other bot's writes don't invalidate Jester's cache.
- **Exploit / failure:** Buyer spends down in Butler (or another Jester shop) but Jester still sees the cached higher balance → trade accepted → `removePoints` drives them negative (compounds #1). Conversely a real buyer can be wrongly rejected.
- **Impact:** Cross-bot balance drift; enables the negative-balance path even without double-clicking.
- **Effort:** S — switch these gates to `getPointsFresh`; the real fix is folding the check into the atomic deduct (#1).
- **Rec:** Use `getPointsFresh` at every money gate, or better, let the atomic deduct be the check.

### 4. `shop.ts` (Mells Selvair) buy path has **no** in-flight purchase lock
`commands/shops/shop.ts:213-245`. Unlike luckboxes/meluna/tickets/seluna, the `buy` case has no `activePurchases` map. `getPointsFresh` → `removePoints` → `addItem` across three awaits.
- **Exploit:** Concurrent buys of a pricey ability/emoji both pass the fresh check and both deduct (negative balance), or race the `hasItem` gate to grant twice.
- **Impact:** Negative balance / double-grant.
- **Effort:** S — add the same per-user lock pattern used in the other shops.
- **Rec:** Introduce an `activePurchases` guard here and settle via atomic deduct.

### 5. Card/stone auctions have **no bid escrow** — funds aren't held, settle silently voids
`cards_trade.ts:1755-1784` (bid only validates, never reserves) and the 24h/accept settle at `:1056-1102`, `:1382-1436`, `:1914-1925`. At settle, if the winner has spent the money, the entire transfer block is skipped — card stays with seller, no funds move, and in the timer path there's often no notification.
- **Exploit / failure:** A bidder can place a huge bid with funds they don't hold to snipe/block real bidders (griefing), then spend the money elsewhere; auction dies with no sale. Also mirrors #1: settle uses `removePoints` with no atomic guard, so a partially-funded winner can still be driven negative.
- **Impact:** Broken auctions, seller griefing, drift.
- **Effort:** M — escrow the bid delta on bid (atomic deduct into a hold), refund the previous bidder on outbid, pay seller from the hold on settle. This is the auction analogue of Butler's game escrow.
- **Rec:** Reserve funds at bid time; refund-on-outbid; settle from the reserve.

### 6. Seluna stock + per-user caps are a single-doc read-modify-write (lost updates / oversell)
`commands/shops/seluna_vendor.ts:626-629` (`stockData[itemId] = remainingStock - 1; selunaSet('shop_stocks', …)`) and `bumpSelunaPurchase` (`:22-30`), both `selunaGet`→mutate→`selunaSet` on one JSON doc.
- **Exploit:** Two users race the last unit: both read `remainingStock=1`, both write `0` → **two cards sold, one unit of stock**; or a user races two confirms to exceed the 1-stone / 3-ticket per-rotation cap (the cap tally is the same lost-update pattern, and the stone branch pays before/around the bump).
- **Impact:** Oversold limited items, cap bypass on rare Seluna stock.
- **Effort:** M — move stock/caps to atomic per-field Mongo operators (`$inc` with a `$gte` guard on the specific item field) instead of whole-doc rewrites.
- **Rec:** Store stock/caps as Mongo counters and decrement atomically under the existing lock.

### 7. Gift Lunari: non-atomic transfer with no rollback on partial failure
`commands/trading/gift.ts:210-219`. `getPoints` (cached, see #3) → `removePoints(giver)` → `addPoints(recipient)`, no try/catch. If `addPoints` throws after `removePoints` succeeds, the giver's Lunari is **destroyed** (recipient never credited).
- **Impact:** Money loss on the giver side under transient DB error; negative balance under concurrency.
- **Effort:** S — gate on atomic deduct (#1); on credit failure, refund the giver.
- **Rec:** Deduct atomically, credit, and refund on failure — same pattern the trade handlers already use in their `catch`.

### 8. Batch writer advertises a points buffer that is **dead code** (misleading + latent risk)
`util/infra/batch_writer.ts`. `index.ts:519` only calls `setPointsManager` and `:1872` `shutdown`; **`queuePointsUpdate` has zero live callers** (only the definition and COPILOT docs). CLAUDE.md/README claim "high-frequency point ops go through the batch writer" — they don't; every path hits PointsManager directly. Worse, if someone *does* wire it later, its retry re-queues by re-adding `data.amount` (`:114-129`) with no idempotency — a partially-applied `$inc` that "failed" on timeout would be double-applied on retry.
- **Impact:** No money bug today, but a documented-but-fake safety layer and a foot-gun if adopted.
- **Effort:** S — either delete the queue path or add an idempotency key before anyone uses it; fix the docs.
- **Rec:** Remove the unused points-queue (or mark clearly disabled) so the atomic-deduct work in #1 is the single source of truth.

---

## Healthy / checked out clean

- **Shop, tickets, luckbox, meluna, seluna buy paths** all correctly use `getPointsFresh` before deducting and wrap the grant in try/catch with a **refund on failure** (`shop.ts:246-251`, `tickets_shop.ts:124-136`, `meluna_vendor.ts:366-373`, `luckboxes.ts:601-609`). The refund-on-error discipline is consistent and good — the gap is atomicity, not error handling.
- **In-flight `activePurchases` locks** exist and are correctly `finally`-released on luckbox, meluna-buy, tickets, and seluna (just missing on `shop.ts` buy and meluna-sell — see #2/#4).
- **Bank reserve accounting** (`addToBankReserve`, `points.ts:42-50`) is a clean atomic `$inc` with `$unset:{data}` legacy cleanup — no issue.
- **Game *winnings*** (`addPoints`) are all `$inc`-based and monotonic; roulette/rps correctly skip `fake_`/bot IDs (`roulette.ts:76,172,486`, `rps.ts:74`). Games are **payout-only** (no player wagering pool in Jester), so there's no abandon-a-losing-bet vector like Butler had — the GrandFantasy merc/imp/broker payments correctly re-check `getPoints` and only charge if funds exist (`GrandFantasy.ts:1413-1417`).
- **Card/stone trade completion** properly re-verifies ownership (`cardStillExists`/`stoneStillExists`) before transfer and refunds the buyer on error (`cards_trade.ts:1551-1607`, `stones_trade.ts:1552-1611`).
- **Legacy `data`/`value`/`balance` field migration** in points and tickets managers is consistent and defensive.

**Bottom line:** Jester's economy is honest on the happy path and disciplined about refunds, but it is missing the one primitive Butler just gained — an atomic, `$gte`-guarded deduct — plus a couple of missing locks (shop buy, meluna sell) and no auction escrow. Fixing #1 (port `deductIfSufficient`) neutralizes the negative-balance/double-spend surface behind #3, #4, #5, #7 in one move; #2 and #6 are independent lost-update bugs worth their own small fixes.