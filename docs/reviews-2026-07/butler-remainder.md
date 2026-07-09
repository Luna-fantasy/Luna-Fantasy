# LunaButlerMain Review — Money Paths & Runtime Health

Verified against source at `C:\Users\Admin\Desktop\Luna Bot\LunaButlerMain`. The escrow class of bug fixed in luna21/roulette/coinflip is **still present in nearly every other money path** — banking is the worst offender.

## TOP OPPORTUNITIES (ranked)

**1. Banking button flows have zero concurrency guards — double-click = double payout**
- Evidence: `commands/banker_commands.ts` — only `trade` uses interactionLock (grep: locks at lines 1398–1478 only). Everything else is unguarded check-then-act:
  - Investment withdraw `1567–1599`: `getUserInvestment` → `addPoints(totalAmount)` → `clearInvestment`. Two rapid clicks of "سحب الايداع" both read the investment as active and both pay out (up to 125–130% of deposit, twice).
  - Loan sign `1332–1378`: `hasAnyActiveLoan` check, then `addLoan($push)` + `addPoints` at 1380. Double-click "توقيع العقد" → two active loans + two payouts (race window spans ~5 awaits: `fixOverdueLoanState`, `getLoanTiers`, `getBanking`).
  - Daily claim `977–1019`: cooldown check at 986, `setLastDaily` at 1019, with ~6 awaits between (config, profile, property breakdown) — double-click pays double daily. Monthly salary `1084–1102` identical.
  - Insurance `1486–1521`, deposit modal `2503–2528`, full/partial loan & debt repayment `1751–1773`, `1933–1957`, `2007–2017`, `2083–2096`: all balance-check → unconditional `removePoints` (no floor).
- Failure scenario: any user double-clicking a bank button on a slow DB moment mints Lunari or drives balances negative; withdraw double-payout is the direct sibling of the bug you just fixed in bets.
- Impact: HIGH (money creation, shared economy with Jester). Effort: **M**. Recommendation: reuse `deductIfSufficient` for all spends; convert withdraw/claim/loan-sign into atomic MongoDB claims (`updateOne` with state filter, like the existing `tryClaimLeaderboardUpdate` pattern at `points.ts:343`); `executeWithLock` as an interim wrapper for every `salary_/loan_/investment_/insurance_/debt_` custom_id.

**2. `/give` transfer can mint money (unguarded remove + 10s-stale balance)**
- Evidence: `commands/lunari_commands.ts:518–526` — `getPoints` (served from 10s cache, `points.ts:226–243`) then unconditional `removePoints` + `addPoints`. No interactionLock on `give`.
- Failure scenario: user with 100k fires two `/give 100k` to two alts concurrently → both pass the check, giver ends at −100k, 200k credited to alts. Attacker controls both sides — highest abuse value in the bot.
- Impact: HIGH. Effort: **S** — swap to `deductIfSufficient(giverId, amount)` and only credit the receiver when it returns non-null.

**3. Steal drives the *target* negative**
- Evidence: `commands/steal_commands.ts:123–143` — `stolenAmount` computed from cached `getPoints(targetUser)`, then unconditional `removePoints(targetUser, ...)`. The interactionLock at line 41 only guards the thief.
- Failure scenario: target places a bet (escrow deducts) between the read and the steal → target goes negative; two thieves stealing the same target in the same window compounds it. Money credited to thief is partly minted.
- Impact: MED-HIGH. Effort: **S** — `deductIfSufficient(targetUser, stolenAmount)`; abort with "target too poor" if null.

**4. `checkOverdueLoans` can destroy or mint balance via stale read + `setPoints(0)`**
- Evidence: `util/managers/points.ts:518–650` — `userBalance = await this.getPoints(userId)` (cached), then either `removePoints(totalDebt)` (line 541, negative if user spent meanwhile) or partial branch `setPoints(userId, 0)` (line 573) crediting only the stale `userBalance` against debt — anything earned between read and set is silently destroyed. Runs hourly over every loan holder plus on startup (`index.ts:315–344`).
- Impact: MED-HIGH (silent corruption, hard to trace). Effort: **M** — replace with `findOneAndUpdate` deduct-up-to-N (atomic `$inc` guarded by `$gte`, or read the returned pre-image), and reuse the deducted amount for debt math.

**5. Shop + Valecroft purchases: same check-then-remove race, plus a phantom argument**
- Evidence: `commands/shop.ts:326–337` — comment says "fresh read, skip cache" but `getPoints` IS the 10s cache; line 332 calls `removePoints(userId, finalPrice, 'شراء…')` — **`removePoints` takes 2 args (`points.ts:145`); the reason string is silently dropped** (bot is untyped `any`, so tsc never flagged it — same at line 357). Valecroft: `valecroft_commands.ts:1204–1207, 1231–1234, 1281–1284`; also `home_commands.ts:579`, `edit_home_commands.ts:135`.
- Failure scenario: buy an item while a game escrow settles → negative balance; buyer refund path (`shop.ts:357`) can also double-fire on retries.
- Impact: MED. Effort: **M** — `deductIfSufficient` across all six sites; type `bot.pointsManager` on `LunaBot` so phantom args become compile errors.

**6. interactionLock 3s self-expiry + cooldown-set-at-end defeats the only guard most games have**
- Evidence: `util/tracking/performance_manager.ts:11` (`lockTimeout = 3000`); hunt sets cooldown at the END (`hunt_commands.ts:107`), steal at `steal_commands.ts:144`. `unlock()` also has no ownership token — it can release a newer holder's lock.
- Failure scenario: a DB/REST hiccup makes a hunt take >3s; second click acquires the "expired" lock and the entire payout re-runs before the cooldown lands → cooldown farming. This is the only guard for hunt/steal/coinflip entry.
- Impact: MED. Effort: **S** — per-action timeout (e.g. 15–30s for money ops), token-based unlock, and set cooldowns *before* the payout (refund on failure), mirroring the escrow discipline.

**7. `/rank` and `/level` load the entire levels collection per invocation**
- Evidence: `util/managers/levels.ts:251–266` (`find({}).toArray()` + JS sort) called from `level_commands.ts:48` and `:142`, `lunari_commands.ts:185`; `points.getAllPoints()` (`points.ts:302–317`) same pattern for the money leaderboard (`functions.ts:519`, `badge_manager.ts:234`).
- Failure scenario: every `/rank` pulls N user docs over the wire just to compute one index — latency and heap grow linearly with membership; a burst of rank commands stacks full scans.
- Impact: MED (scales badly, it's the bot's top latency hazard). Effort: **M** — rank position = `countDocuments({ xp: { $gt: userXp } }) + 1` with an index on `xp`/`balance`; cache the top-10 slice for leaderboards; leave full scans to the daily scheduler only.

**8. Bank reserve is a lossy read-modify-write**
- Evidence: `util/managers/points.ts:377–383` — `getBankReserve()` then `sysSet(current + amount)`. Called concurrently from hunt losses (`hunt_commands.ts:90`), trade losses (1469), shop (`shop.ts:335`), valecroft (3 sites), loan interest (1780, 2104).
- Failure scenario: two simultaneous sinks → one increment lost; the public bank panel (updated every 5 min, `index.ts:358`) drifts from reality permanently.
- Impact: LOW-MED (stat drift, no user-facing money loss). Effort: **S** — one-time migrate `luna_bank_reserve` to numeric and use `$inc`.

## HEALTHY (keep as-is)

- `deductIfSufficient` (`points.ts:180–224`) is genuinely well built: atomic `$gte` filter, guarded legacy string-balance migration, escrow-aware `syncProfile` opts.
- Escrow usage in coinflip/roulette/luna21 is correct (deduct-first, refund with `syncProfile:false`).
- `tryClaimLeaderboardUpdate` (`points.ts:343–365`) — the atomic-claim pattern the bank flows should copy already exists in-repo.
- `index.ts` reconnect hygiene: `botInitialized` guard, tracked intervals cleared before re-set, graceful shutdown, non-fatal `bulkEditCommands`.
- Loan flow input hardening: spoofed `custom_id` tier rejection (`banker_commands.ts:1142`), investor status re-verification at signing (1358–1364), passport-gated tiers.
- Passport fee (`application_commands.ts:644–736`) deducts first and has explicit refund paths on every failure branch.
- Hunt clamps losses to balance (`Math.min`, `hunt_commands.ts:85`) — the one legacy money path that can't go negative.
- `config_reader.ts` 30s TTL with config.ts fallback and negative caching is a clean live-config layer.
- `checkMaturedInvestments` defensive `startDate` validation (`points.ts:727–732`); `!devbank` not clobbering production `bank_message_data` (`banker_commands.ts:2568`).

Minor notes (not top-8): 15-min matured-investment sweep can race a manual withdraw (same fix as #1 covers it); `handleLoanModal` logs full loan/balance data to console (`banker_commands.ts:2049–2084`); the 10s loan countdown issues 10 sequential REST edits per preview; ~37 empty catch blocks across commands swallow diagnostics.