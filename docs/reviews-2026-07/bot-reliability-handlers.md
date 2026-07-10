All investigation complete. Here are my findings for the INTERACTION/COMMAND/EVENT HANDLER ROBUSTNESS axis.

---

# AXIS: Interaction/Command/Event Handler Robustness — TOP FINDINGS

## F1 — Butler & Oracle: DB-connect failure during ready() leaves a permanent zombie bot (HIGH, effort S)
**Evidence:**
- `LunaButlerMain/index.ts:188-192` — `botInitialized = true` is set **before** `await initDatabase()`, and the ready handler has no try/catch around init.
- `LunaButlerMain/util/helpers/database_helper.ts:19-32` — `initDatabase()` retries 5x (~30s) then **throws**.
- `LunaOracle/index.ts:192-193, 372-374` — same pattern: `botInitialized = true` set first; the catch at :372 only logs `[Oracle] Init error` and keeps running.

**Failure scenario:** MongoDB Atlas hiccup at boot (e.g. Butler's 4 AM cron restart, or Oracle's frequent 256MB-cap PM2 restarts). Init throws → in Butler it becomes an unhandledRejection; in Oracle it's swallowed. All managers (`pointsManager`, `roomManager`, `challengeManager`, voice handlers via `registerVoiceHandlers`) are **never created**, and because `botInitialized` is already `true`, reconnects skip re-init. The bot shows online but every command throws TypeError (Butler users get the generic error; Oracle's VC system is silently dead — hubs won't create rooms) until a human restarts it. With the daily cron restart this can mean a full day of dead bot.
**Fix:** Set `botInitialized = true` only after init succeeds, and in the failure path `process.exit(1)` so PM2 restarts into a working state (the retry loop already provides backoff). Jester needs nothing — its `initializeMongoPool().catch()` + null-returning `getMongoCollection` degrade gracefully.

## F2 — Jester: slash-command (type 2) dispatch has zero error wrapping — throw = silent spinner (HIGH, effort S)
**Evidence:** `LunaJesterMain/index.ts:727-743` — the only try/catch in `interactionCreate` wraps the cooldown check. The entire type-2 branch (`index.ts:773-920`: `bookCommand`, `giftCommand`, `sellCardCommand`, `swapStoneCommand`, `selunaAddItem`, etc.) is called bare. Handlers are not internally top-wrapped either — e.g. `commands/trading/gift.ts:10-53` runs option parsing and manager calls before its first `try` at :94.

**Failure scenario:** Any throw in any slash handler (DB pool not ready, undefined option access, cache miss) → rejected promise → global `[UNHANDLED REJECTION]` log. The user sees the interaction spin for 3s then "The application did not respond" — no message, no retry hint. Compare Butler, where every route goes through `safeInteractionHandler` (`LunaButlerMain/index.ts:918-937`) with an Arabic apology message.
**Fix:** Port Butler's `safeInteractionHandler` pattern into Jester's `index.ts` — a wrapper that catches, logs, and sends an ephemeral error via the existing `safeRespond` from `util/helpers/interaction_helper.ts`. Reuse an existing Arabic error string (do not write new Arabic — per feedback_arabic_text.md).

## F3 — Jester `/gift` card: double-submit duplicates cards; no bot-recipient check (MED-HIGH, effort S/M)
**Evidence:** `LunaJesterMain/commands/trading/gift.ts:10-91` — no lock, no dedupe; recipient validated for existence and self-gift (:27) but **not** `recipient.bot`. `util/managers/cards.ts:112-127` — `removeCard` is read → filter → `$set` (read-modify-write, second call silently no-ops); `addCard` (:31-56) `$push`es unconditionally.

**Failure scenario:** User double-fires `/gift type:card` (lag double-click / two devices). Both invocations read the same (60s-cached) `getUserCards`, both find the card, both call `removeCard` (net effect: removed once) then `addCard` twice → recipient now owns **two copies** of a possibly UNIQUE/LEGENDARY card, giver lost one. Item duplication in a trading economy. Gifting to a bot also silently strands the card.
**Fix:** Make removal atomic: `updateOne({_id}, { $pull: { cards: { id: cardId } } })` and only proceed to `addCard` if `modifiedCount === 1` — the same atomic-guard shape already used in Jester's hardened Lunari spend paths. Add `recipient.bot` check mirroring Butler `lunari_commands.ts:514`.

## F4 — Butler: interactionLock's 3s self-expiry defeats hunt/steal/coinflip/roulette guards under DB latency (MED, effort S)
**Evidence:** `util/tracking/performance_manager.ts:11` — `lockTimeout = 3000`. `commands/hunt_commands.ts:50-107` — after the lock, the handler awaits `getLastHunt` → `addPoints` → `logTransaction` → `getPoints` and only writes `setLastHunt(userId, now)` at :107, **after** all payout I/O. Same shape in `steal_commands.ts` (setLastSteal at end), `coinflip_commands.ts:28-46`, `roulette_commands.ts:28-98`.

**Failure scenario:** Atlas latency spike makes the first `/hunt` take >3s. The lock self-expires mid-handler; a second `/hunt` passes both `isLocked` and the stale `lastHunt` cooldown read → two full hunts execute, double reward/loss, and interleaved `unlock()` calls release the other invocation's lock. Luna21 is already immune — it has a real guard (`luna21_commands.ts:40-46` `hasActiveGame`, with a code comment admitting "the lock above self-expires after 3s").
**Fix (two small moves, no new infra):** (1) write the cooldown timestamp immediately after the cooldown check passes, before payout I/O — the DB cooldown then becomes the durable guard; (2) raise `lockTimeout` to ~15-30s — every caller already unlocks in `finally`, so the expiry is purely a leak backstop and doesn't need to be 3s.

## F5 — Both bots: buttons on finished/restarted games are never acked — guaranteed "This interaction failed" (MED, effort S)
**Evidence:**
- `LunaJesterMain/index.ts:980-984` — any `hasOwnCollector` prefix (`magic_`, `rps_`, `mafia_`, `roulette_`, `fw_`…) is `return`ed untouched, on the assumption a live collector will ack it. After a restart (rps/mafia/roulette have no persistence) or after a game ends, no collector exists → never acked.
- `LunaButlerMain/index.ts:1076-1151` — type-3 router has no fallback branch; unmatched custom_ids (e.g. `bj_hit_*` Luna21 buttons after a restart, since Luna21 games are in-memory only) fall through silently.
- Bonus: Jester classifies all `meluna_*` as self-deferring (`index.ts:963`) but only routes `meluna_buy|confirm|cancel|buyagain|sell` (:1345-1354) — any other meluna id spins.

**Failure scenario:** Daily 4 AM restarts leave live button rows on the last game messages in every game channel. Users click → 3s spinner → "This interaction failed", repeatedly, and report the bot as broken.
**Fix:** Add a terminal fallback in both routers: for known game prefixes with no matching active game/collector, `deferUpdate` then ephemeral "انتهت هذه اللعبة" style message (reuse an existing expired-game string) — Jester can reuse `immediateAck` + `safeRespond`; Butler can reuse `safeDeferUpdate` + `safeCreateMessage`. Optionally disable components on restore-failure using the existing `disabledAllComponentsBtns` helper.

## F6 — Jester: cooldown rate-limit silently drops interactions instead of acking (MED, effort S)
**Evidence:** `LunaJesterMain/index.ts:735-739` — `if (!cooldownCheck.allowed) { console.log(...); return; }` with no ack. Shop/fantasy cooldown is a full 1000ms (`index.ts:163-171`).

**Failure scenario:** A normal user clicking two shop buttons within 1s (extremely common when browsing pages) gets their second click eaten → spinner → "This interaction failed." This punishes legitimate navigation and looks like instability, on the highest-traffic surface (shops).
**Fix:** Before the `return`, fire `interaction.deferUpdate().catch(() => {})` (or the existing `immediateAck`) so the click resolves as a no-op instead of an error.

## F7 — Oracle: router catch gives users nothing, and custom_id parsing trusts format (LOW-MED, effort S)
**Evidence:** `LunaOracle/index.ts:565-567` — the single outer catch logs `[Interaction] Error` and ends; the user's panel click spins out. Also `index.ts:492-516` — `parseInt(parts[parts.length-1])` for boss/trivia answers with no NaN guard, and `handleBossAnswer` is invoked even if `bot.challengeManager` failed to init (would throw, land in the silent catch).

**Failure scenario:** Any throw in `handlePanelInteraction` (room doc missing after a manual channel delete, config poll mid-swap) → user presses Lock/Rename on the VC panel, nothing happens, no feedback — they hammer the button, multiplying load. Oracle is already the most crash-prone bot; silent failures compound the perceived flakiness.
**Fix:** In the catch, attempt an ephemeral `createMessage` fallback exactly like Butler's `safeInteractionHandler` (:929-932 pattern); add `Number.isNaN(answerIndex)` early-returns on the challenge branches.

## F8 — Butler: autocomplete (type 4) handlers unwrapped (LOW, effort S)
**Evidence:** `LunaButlerMain/index.ts:1060-1074` — `handleBackgroundAutocomplete`, `handleEditAutocomplete`, `handleAdminPropertyAutocomplete`, `handleAdminItemAutocomplete` are returned bare; every other interaction type goes through `safeInteractionHandler`.
**Failure scenario:** A throw (DB blip while listing properties) → unhandledRejection noise and the user's autocomplete dropdown hangs empty with no acknowledgment; Discord shows "Loading options failed."
**Fix:** Wrap in try/catch returning `interaction.result([])` — exactly Jester's pattern at `LunaJesterMain/index.ts:764-770`.

---

# ALREADY SOLID (do not touch)

**Butler**
- `safeInteractionHandler` (`index.ts:918-937`) wraps every type 2/3/5 route with logging + Arabic fallback error — this is the reference pattern for the ecosystem.
- `util/helpers/functions.ts:73-85` — error-code classification (40060 already-acked, 10062 unknown-interaction, 10008 deleted-message) inside `safeDefer`/`safeCreateMessage`/`safeEditOriginalMessage`; used consistently in commands.
- `configReader.get` (`util/helpers/config_reader.ts:27-47`) catches DB errors and returns null → all `live_config` getters fall back to `config.ts` defaults, so `messageCreate` can't die from config reads; `getCommandConfig` even has an explicit defaults fallback (`index.ts:562-567`).
- `/give` validation (`lunari_commands.ts:488-516`): `Number.isInteger`, `> 0`, self-target, bot-target, REST user existence. Admin `add/remove/giveall` all gate on `owners_roles_ids`.
- Luna21: real concurrency guard `hasActiveGame` + settle-once + refund-on-payout-failure (`luna21_commands.ts:40-46, 108-165`) — the model for F4's fix.
- Interval-stacking prevention on reconnect (`index.ts:133-140, 274-280`), `!clear4` operator recovery command, uncaughtException triage (:151-163), graceful shutdown.

**Jester**
- `withTimeout` on every component route (30s/15s/10s, `index.ts:1326-1397`) — a hung shop handler can't wedge the router.
- Autocomplete fully wrapped with `interaction.result([])` fallback (:764-770); friendly "no match" placeholder options.
- `ackTracker` duplicate-interaction block (:925-928); per-round `processingLock` debounce inside LunaFantasy (:505-512).
- `gameGateCheck` (:84-119): uniform enabled/role/active-room/channel gates for all prefix games; `!stop` master unstick command (:1556-1583); periodic stale-game sweep (:275-310) and LunaFantasy stale-lock cleanup — zombies self-heal within ~30min.
- `messageCreate` wrapped end-to-end in try/catch (:1418, 1779-1781); admin card/stone/ticket commands all check `owners_roles_ids` inside handlers; command-config defaults are admin/owner-locked (`game_config.ts:259-267`).
- Graceful shutdown persists LunaFantasy/FactionWar/GrandFantasy games, notifies channels, restores on boot with per-game try/catch and state removal on restore failure (:539-581).

**Oracle**
- Single top-level try/catch means one bad handler can't crash the process (:381-567); reaction handler wrapped (:641-653).
- Hub cleanup 3-strike retry budget (:279-339), orphan-channel sweep, dashboard pending-actions loop with per-action swallow, welcome dedupe set, grace-period race handling, graceful shutdown that preserves music state.