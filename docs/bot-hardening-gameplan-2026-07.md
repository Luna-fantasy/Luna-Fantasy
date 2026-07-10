# Luna Premium Bot Hardening Gameplan

> Read-only reliability audit of 3 bots (6 axes), synthesized. Evidence with exact file:line lists in docs/reviews-2026-07/bot-reliability-*.md. Phases 1-3 executed 2026-07-10.

**Scope:** Butler, Jester, Oracle (Sage excluded). Goal: premium-grade reliability — sturdy, self-healing, high uptime. Money integrity already done; not re-covered here.
**Ranking method:** (uptime impact × likelihood) ÷ effort. Crash-prevention and memory first (they drive the 354/237 restart counts and the Oracle voice drops), then outage resilience, then handler robustness, then observability.

---

## PREMIUM DEFINITION — what separates these from hobby bots

| # | Property | Delivered by |
|---|----------|--------------|
| P1 | **Never a zombie** — any fatal boot/init failure exits fast so PM2 heals it; "online in PM2" always means "actually working" | Phase 1, 2 |
| P2 | **Survives an Atlas blip** — DB outages fail fast (seconds, not minutes), never wipe data, and the bot recovers without a human | Phase 1, 5 |
| P3 | **Survives Discord trouble** — no self-inflicted shard disconnects; voice reconnects itself; a 5xx blip never permanently freezes a panel | Phase 3, 6 |
| P4 | **Bounded memory, self-repairing pools** — caches are byte-bounded, workers respawn, every in-memory map has a sweeper | Phase 3, 4 |
| P5 | **Restarts are lossless** — graceful shutdown flushes trackers/games; boot restores or cleanly retires stale state (including old buttons) | Phase 2, 4, 7 |
| P6 | **No silent data corruption** — every shared-collection write is atomic; concurrent Butler+Jester writes can't clobber each other | Phase 6 |
| P7 | **Users never see a raw failure** — every interaction path acks; worst case is a polite Arabic error, never an eternal spinner | Phase 7 |
| P8 | **Operator sees the truth** — heartbeat health doc, greppable logs, memory stats that name the leaking map | Phase 8 |

---

## CROSS-BOT ROOT CAUSES (fix once, adopt per bot)

Because Butler is compiled/st.db, Jester is tsx/raw-driver, and Oracle is tsx/voice, each "shared pattern" is a small per-bot copy of the same shape — never a shared package.

**RC1 — Zombie-on-init: `botInitialized = true` set BEFORE the async init, failure only logged.**
All six axis reviews independently flagged this as the #1 defect. Butler `index.ts:188-192` (no try/catch at all; `initDatabase()` throws after ~45s of Atlas trouble → unhandledRejection → bot online with zero managers until 4 AM cron). Oracle `index.ts:192-193` + catch at `:372-374` (VC system silently dead, announce half-works so it looks up).
*Pattern:* set the flag only after init succeeds; on failure `console.error` + `process.exit(1)` — PM2's restart loop IS the retry mechanism. Reuse Oracle's own fail-fast posture (`LunaOracle/index.ts:16-19`).
*Adopters:* Butler, Oracle. **Jester is immune** (lazy self-healing `getMongoClient()`, background pool init) — it's the reference, don't touch it.

**RC2 — Swallowed fatal exceptions: process limps on in undefined state.**
Butler `index.ts:151-163` (exit commented out), Jester `index.ts:1787-1791` (logs `err.message` only — **no stack**, 3 AM crashes undiagnosable), Oracle `index.ts:742-748`.
*Pattern:* log full `err.stack`; keep Butler's ECONNRESET/ETIMEDOUT whitelist; for everything else run the existing `gracefulShutdown()` then `process.exit(1)`. Restarts are cheap — Jester saves/restores games, Oracle reconciles rooms.
*Adopters:* all three (whitelist copied from Butler).

**RC3 — Whole-array/whole-doc `$set` sourced from fallible cached reads → silent wipes and cross-bot lost updates.**
Jester `cards.ts:112-119` + `stones.ts:73-118` (read returns `[]` on ANY error → `$set cards: []` = **collection wipe**; concurrent trade+pull = dupes), Butler `inventory.ts:69-98` (same wipe path on purchase), Butler `profiles.ts:203-214` (`$set` whole doc from 15s cache **erases Jester's `$inc` writes** — the `b`-field recovery code is a scar from exactly this), Butler `levels.ts:107-172` (double sequential `$set` loses XP for anyone chatting while in voice), Seluna `seluna_vendor.ts:558-629` (whole-doc stock write → oversell).
*Pattern:* atomic `$inc` dot-paths / `$push` / `$pull` / guarded conditional updates. **The reference implementations already exist in Jester**: `profiles.ts:171-179`, `inventory.ts:36-53`, `game_wins.ts:64-72`. Make read errors in write paths rethrow instead of returning `[]`.
*Adopters:* Jester (cards, stones, seluna, gift), Butler (profiles, inventory, levels).

**RC4 — Unswept in-memory game maps → bricked channels and heap creep.**
Jester: `activeRoomGames` never swept (`index.ts:275-310` sweeper skips it; a single orphan bricks a channel for all 8 prefix games), `activeFactionWarGames`/`activeGrandFantasyGames` in no sweeper at all, event games never match the `startTime` guard.
*Pattern:* one sweeper owns ALL maps; stamp `startTime` at every gameData creation; cross-check `activeRoomGames` against the live maps.
*Adopters:* Jester (Butler's 30s central sweep at `index.ts:284-302` is already solid).

**RC5 — Silent handler failure: throw = eternal spinner.**
Jester type-2 slash dispatch has **zero** error wrapping (`index.ts:773-920`), Oracle's router catch logs and gives the user nothing (`index.ts:565-567`), Butler autocomplete unwrapped (`index.ts:1060-1074`).
*Pattern:* Butler's `safeInteractionHandler` (`index.ts:918-937`) is the ecosystem reference — port its shape per bot, reusing existing Arabic error strings (never write new Arabic).
*Adopters:* Jester, Oracle, Butler-autocomplete.

**RC6 — `eris-collects` leaks: constructor timer never cleared on `stop()`, `interactions[]` accrues every click.**
`node_modules/eris-collects/src/InteractionCollector.js:16,21-25`. Both bots create collectors constantly (roulette 1-4/round, Butler's four board games).
*Pattern:* vendor the 60-line library as `util/helpers/collector.ts` per bot: store the timer handle, `clearTimeout` in `stop()`, emit-only (drop the push). One-line import change per site.
*Adopters:* Butler, Jester.

**RC7 — PM2 configs mis-sized in opposite directions.**
Oracle 256M cap (~130-200M idle for eris+voice+mongo → routine OOM kills mid-playback = most of its restarts) + `max_restarts: 10` with no cron safety net = can wedge in "errored" forever. Jester 12G cap + 8G heap = Linux OOM killer (SIGKILL, no game save) always beats PM2's graceful SIGINT. Butler `max_restarts: 10` + fixed delay = wedges "errored" during any Atlas outage — which Phase 1's fail-fast makes MORE likely, so **Phase 2 must ship with or immediately after Phase 1**.

---

## PHASES

### Phase 1 — Fail-fast boot & exception posture *(Butler + Oracle + Jester — effort S)*
**Goal:** a bot that can't work refuses to run, so PM2 always restarts it into a working state.
- RC1 fix: Butler `index.ts:188-192` — wrap ready-init in try/catch, move `botInitialized = true` after success, `process.exit(1)` on failure. Oracle `index.ts:192-193, 372-374` — same.
- Token guards: Butler `config.ts:5` accepts `""`, Jester `config.ts:5` unvalidated — copy Oracle's exit-on-missing-token (`LunaOracle/index.ts:16-19`). Butler `index.ts:1204` bare `bot.connect()` and Jester `index.ts:1929-1932` log-only catch → `.catch(err => { console.error(err); process.exit(1); })`.
- RC2 fix: full `err.stack` in Jester's `uncaughtException`; triage-and-exit (whitelist network noise, `gracefulShutdown()` + exit for the rest) in all three.

**SEE:** kill Atlas during a test-bot boot → bot exits and PM2 restart-loops instead of sitting green-but-dead; next real Atlas blip at 4 AM self-heals in minutes, not 24 hours. Crash logs now contain stacks.

### Phase 2 — PM2 right-sizing & restart policy *(all three — effort S; ship with Phase 1)*
**Goal:** PM2's graceful path always wins, and restart loops never wedge.
- Oracle `ecosystem.config.cjs:14,19`: 256M → 512M; `kill_timeout` 5000 → 10000 (its `shutdown()` does Mongo updateMany + music teardown).
- Jester `ecosystem.config.json:6,11`: `max_memory_restart` → ~2500M, heap → 4096 — so PM2's SIGINT (which saves active games) preempts the kernel OOM killer's SIGKILL.
- All three: `exp_backoff_restart_delay: 5000`, `max_restarts` → ~50 (Butler `ecosystem.config.cjs:27-29` currently exhausts 10 in ~2 min).
- Butler drift: ecosystem runs `tsx index.ts` while package.json/deploy agent build `dist/` — pick one path so a broken build can't diverge from what's running.

**SEE:** Oracle's "random voice drops for no reason" stop (they were 256M OOM kills); Jester restart never again loses in-progress games to SIGKILL; a bad deploy retries with backoff instead of PM2 "errored".

### Phase 3 — Jester gateway agent + image worker pool *(Jester — effort S)*
**Goal:** stop Jester sabotaging its own gateway socket and its own render pool.
- **Self-inflicted shard churn:** `index.ts:226` passes `agent: discordAgent` top-level → Eris copies it onto the **websocket** (`eris/lib/Client.js:166-170`); the agent's 20s idle-kill (`discord_agent.ts:23-40`) destroys the gateway socket during any quiet >20s gap (heartbeat is ~41s). Move it to the `rest: {}` scope exactly like Butler `index.ts:110-113`; raise socketTimeout to 90s as defense-in-depth.
- **Worker-slot leak (critical):** `image_worker_pool.ts:89-92, 152-157` — a timed-out task's worker is never returned to `availableWorkers`; 4 slow GIFs = pool silently at zero, callers await forever, roulette channel bricked. Fix the unknown-task branch to push the worker back + `processNextTask()`; timeout must also splice from `taskQueue` and reject unconditionally.
- **No respawn:** `handleWorkerExit` (`:126-138`) never replaces dead workers → falls back to main-thread GIF encoding → event-loop blocks → heartbeat misses → disconnect storms. Extract `spawnWorker()` from `initialize()` and respawn (capped ~3/min).
- Enforce the declared-but-dead `maxQueueSize` (`:54`).

**SEE:** `[SHARD] disconnected` frequency drops visibly in logs within a day; no more dead roulette games; `imageWorkerPool.getStats()` never shows 0 workers.

### Phase 4 — State hygiene: sweepers, collectors, caches, lossless restarts *(Jester + Butler — effort S/M)*
**Goal:** every game and tracker ends cleanly on every exit path, including the nightly restart.
- RC4: add `activeRoomGames` orphan check + `activeFactionWarGames`/`activeGrandFantasyGames` to Jester's existing 5-min sweeper (`index.ts:275-310`); stamp `startTime` in LunaFantasyEvent / direct-start paths (currently the event-game sweep is a no-op).
- RC6: vendor patched collector in both bots (timer cleared on stop, no interaction accrual).
- Jester `imageCache` (`util/helpers/functions.ts:10-65`): byte-budget eviction (~64MB) + expired-entry purge in the existing cleanup interval; same for `cardBufferCache` (`card_images.ts:127-129`).
- **Butler 4 AM data loss:** `gracefulShutdown` (`index.ts:1181-1198`) doesn't flush `chatTracker` or award active voice sessions, and `VoiceTracker` (`voice_tracker.ts:23-53`) never scans voice states on boot — everyone in VC at 4 AM loses session time AND stops earning voice XP until rejoin, nightly. Flush trackers + run the existing `handleVoiceLeave` award per session on shutdown; iterate `guild.voiceStates` on boot (Oracle's `reconcile()` pattern; Jester's shutdown at `index.ts:1794-1873` is the model).
- Minors while in the area: Jester swap-trade `expiresAt` sweeper (`cards_trade.ts:865`), memory monitor logs map sizes + pool stats when its trend fires (turns "leak detected" into "which map").

**SEE:** no bricked game channels between restarts; RSS floor drops and stays flat; voice XP survives the 4 AM restart; `[MEMORY-STATS]` names the culprit if anything regresses.

### Phase 5 — Oracle voice self-healing *(Oracle — effort S/M)*
**Goal:** the radio and VC system recover from every voice hiccup without an admin.
- Missing `connection.on('error')` at both creation sites (`music_manager.ts:311, 411`) — an unhandled `'error'` on an EventEmitter throws; this is the classic "Oracle voice crash" signature.
- Reconnect leak: `:406-409` strips listeners and nulls the old connection **without `destroy()`** — zombie connections accumulate and `joinVoiceChannel` can hand back the broken one ("reconnected but silent"). Mirror the correct `:442` path.
- Don't give up forever: after 3 reconnect attempts (`:447-451`) it persists `active: false` — keep it true and add a slow 5-min retry tier reusing `restore()`/`joinVC`. Boot `restore()` (`:226-239`) is single-shot and leaves `stationActive=true` with no connection on failure — route failures into the existing `attemptReconnect` ladder.
- Stuck-track watchdog: R2 tracks get `duration = 0` (`:462`); a stalled CDN stream never emits Idle → radio hangs forever. Call the existing `getDuration()` (ffprobe accepts URLs) at play time; in the existing 15s `updateInterval`, force `player.stop()` when elapsed > duration+60s. Replace the ≥5-errors permanent pause (`:371-386`) with 60s cooldown → `autoPickNext()`.
- Tiny prunes: `panel_handler.ts:16` whisperCooldowns, `challenge_manager.ts:226` roomAskedQuestions (hook room-delete).
- Optional forward-compat: `pnpm add @snazzah/davey` (DAVE E2EE voice — verify the native build on the VPS during a deploy).

**SEE:** pull Oracle's network for 2 minutes on the test setup → radio resumes by itself; no more "station says active but silent"; `/station start` never blocked by phantom state after reboot.

### Phase 6 — Atomic data layer & DB-outage behavior *(Jester + Butler — effort M)*
**Goal:** shared MongoDB writes can never wipe, dupe, or clobber; Atlas blips fail fast instead of freezing everything.
- RC3, in order of blast radius:
  1. Jester `cards.ts` / `stones.ts` → `$pull`/`$push` (kills both the `[]`-wipe path and the trade/pull dupe race). Reference: same repo `inventory.ts:36-53`.
  2. Butler `profiles.ts:203-214` `incrementField` → `$inc` dot-path (copy Jester `profiles.ts:171-179` verbatim) — ends the cross-bot lost-update class the `b`-field scar came from.
  3. Butler `inventory.ts:69-98` → `$push` with dup-guard filter / `$pull`.
  4. Butler `levels.ts:107-172` → single `findOneAndUpdate` `$inc` (pattern: its own `tryClaimLeaderboardUpdate`, `levels.ts:330-351`).
  5. Seluna stock (`seluna_vendor.ts:558-629`) → per-shop doc, guarded `$inc: -1` with `$gt: 0` filter; `modifiedCount === 0` = sold out.
  6. `/gift` (`gift.ts:10-91`): proceed to `addCard` only if the `$pull` `modifiedCount === 1`; add `recipient.bot` check (mirror Butler `lunari_commands.ts:514`).
- Make read errors **rethrow** inside write paths (the `catch → []` returns in `cards.ts:102-104`, `inventory.ts:56-59` are the wipe enablers).
- Jester Mongo timeouts (`util/infra/database_helper.ts:8-22`): 60s/60s/90s → align with Butler's 5s/5s/30s profile so an Atlas blip fails in seconds instead of filling every queue slot with minute-long hangs.
- `safeParseData(doc)` helper per repo for the ~10 unguarded `JSON.parse(doc.data)` sites (Jester `game_wins.ts:40,57`, `profiles.ts:101,132`, etc.; safe pattern already at Butler `profiles.ts:125`) — log the `_id`, and never feed its empty fallback into a write.

**SEE:** two simultaneous trades/pulls on one account can't dupe or wipe; Jester stats survive Butler chat activity; during a simulated Atlas pause, commands error fast and recover instead of freezing shops for 90s. (Data-loss class = reliability, not the already-done money escrow work.)

### Phase 7 — Handler robustness: no more eternal spinners *(Jester + Butler + Oracle — effort M)*
**Goal:** every click and command resolves — success, or a polite error, never "This interaction failed."
- RC5: port Butler's `safeInteractionHandler` shape into Jester's type-2 dispatch (`index.ts:773-920`), using existing `safeRespond` + an existing Arabic error string. Oracle's router catch (`index.ts:565-567`) → attempt ephemeral fallback; add `Number.isNaN` guards on challenge answer parsing (`:492-516`). Butler autocomplete (`index.ts:1060-1074`) → try/catch returning `interaction.result([])` (Jester's pattern at `index.ts:764-770`).
- **Stale-button fallback (both bots):** Jester `index.ts:980-984` returns collector-prefixed buttons untouched; Butler's type-3 router has no unmatched branch — after every restart, old game buttons guarantee "interaction failed." Add a terminal fallback: known game prefix + no live game → `deferUpdate` + existing expired-game message.
- Jester cooldown limiter (`index.ts:735-739`) silently eats the second shop click within 1s — `deferUpdate().catch(() => {})` before the return.
- Butler `interactionLock` 3s self-expiry (`performance_manager.ts:11`) defeats hunt/steal/coinflip guards under DB latency: write the cooldown timestamp immediately after the check passes (before payout I/O), raise lockTimeout to ~30s (every caller already unlocks in `finally`). Luna21's `hasActiveGame` guard is the model.
- Mechanical sweep: Butler's ~82 raw `interaction.defer(...).catch(() => {})` sites across 9 command files → `const ok = await safeDefer(...); if (!ok) return;` (pattern already proven at `index.ts:884-885`) — stops wasted 1024×1792 canvas renders after dead defers.

**SEE:** click old buttons after a restart → friendly "game ended" instead of failure; browse shops fast → nothing eaten; user-visible "bot is broken" reports drop to ~zero.

### Phase 8 — Observability & ops hygiene *(all three — effort M)*
**Goal:** a zombie, a leak, or a wedge is visible on the dashboard before users report it.
- **`bot_health` heartbeat:** each bot `updateOne`s `{_id: botName, uptime, rss, gatewayLatency, lastEventAt, managersReady}` into shared Mongo every 60s — Jester just persists its existing `connectionHealth.getReport()` (`connection_health.ts:110-154`, currently console-only); reuse `getMongoCollection()`. Dashboard already reads this Atlas DB; the deploy verifier can check heartbeat freshness, not just PM2 state.
- **Log hygiene:** one ~30-line levelled logger per bot (ISO timestamp + module tag — NOT pino/winston at this scale); delete the three `console.clear()` calls inside `ready` (Butler `:183`, Jester `:489`, Oracle `:188` — they destroy pre-disconnect context on every re-identify); verify `pm2 install pm2-logrotate` on the VPS.
- Butler intents: `53608447` (`index.ts:108`) grants presences/typing that `disableEvents` proves unwanted — Discord still streams the firehose. Replace with a named-intent list (Oracle's style) and untick Presence in the dev portal. Highest-volume gateway event in a 1,400-member guild, parsed all day for nothing.
- Jester REST retry patch (`discord_agent.ts:91-113`): add 500/503 patterns (mirror Butler's `classifyError`, `functions.ts:96-106`); skip retry on ambiguous timeouts for POSTs.
- Deprecate the **dead interaction queue** (`interaction_queue.ts` — imported at `index.ts:61`, `enqueue()` called nowhere, logs all-zero stats; CLAUDE.md documents it as active protection). Per the deprecate pattern: zero-consumer grep done by the audit; remove after owner OK and fix CLAUDE.md — false safety beliefs are their own reliability risk.
- Optional cheap self-heal: `connectionHealth` already records `lastHeartbeat` — exit(1) if stale >5 min so PM2 revives a zombie gateway.

**SEE:** dashboard shows real per-bot health, not just PM2 green; `grep ERROR output.log` around a 3 AM timestamp actually works; Butler baseline CPU/heap drops after the intent trim.

---

## Effort & touch map

| Phase | Bots | Effort | Property |
|-------|------|--------|----------|
| 1 Fail-fast boot | B + J + O | S | P1, P2 |
| 2 PM2 right-sizing | B + J + O | S | P1, P5 |
| 3 Gateway agent + worker pool | J | S | P3, P4 |
| 4 Sweepers/caches/lossless restart | J + B | S/M | P4, P5 |
| 5 Oracle voice self-healing | O | S/M | P3 |
| 6 Atomic data layer | J + B | M | P2, P6 |
| 7 Handler robustness | B + J + O | M | P7 |
| 8 Observability | B + J + O | M | P8 |

Order rationale: 1+2 must land together (fail-fast makes crash loops more likely, so backoff/limits must be ready). 3-5 stop the restart drivers so Phase 8's metrics measure a stable baseline. 6 before 7 so handler wrappers aren't papering over data-layer throws. Each phase is one focused session with a post-deploy smoke test named in its SEE line.

---

## Do NOT do (over-engineering at 1,400 users)

- No Kubernetes, Docker orchestration, or microservices — PM2 fork mode on one VPS is correct.
- No message bus / event queue between bots — shared Mongo + fire-and-forget logging already works.
- No rewrite off Eris or st.db — both are fine; the defects are usage patterns, not the libraries.
- No sharding (`maxShards`) — one shard handles this guild for years.
- No pino/winston/Grafana/Prometheus/external uptime monitors — the 30-line logger + `bot_health` doc + existing dashboard cover it.
- No HTTP health-check servers, `wait_ready` machinery, clustering, or external watchdogs.
- No new indexes or TTL urgency — live DB is 18k docs / 22 MB with 117 indexes; the scary-looking collscans touch 62-68 docs. Revisit only on ~10× growth. (One TTL on `*_transactions` is cheap insurance later — coordinate retention with the dashboard first.)
- Don't "fix" Jester's `UV_THREADPOOL_SIZE: 12` beyond the Phase 2 trims; don't wire the dead interaction queue "properly" — Eris per-route buckets + existing cooldowns suffice.

## Already solid — do not touch

- **Jester:** Mongo layer (lazy self-heal, retry/backoff, recoverable-error classification — ecosystem reference), graceful shutdown with game save/notify/restore, `interaction_helper.ts` (immediateAck/gameResilientSend), startup diagnostics + 60s ready watchdog, `withTimeout` on component routes, atomic `profiles`/`game_wins`/`inventory` writes, cooldown/lock sweepers, `!stop` unstick command.
- **Butler:** `discordRetry` + `classifyError` (best REST wrapper in the ecosystem), `safeInteractionHandler`, tracked interval handles preventing reconnect stacking, Luna21's guard/settle/refund pattern, central 30s game sweep, bounded CacheManager, `/give` validation, clear "MongoDB not connected" getter errors.
- **Oracle:** room lifecycle (grace-timer identity checks, idempotent deletes, orphan sweep, startup reconcile, hub 3-strike rescue), music reconnect ladder structure, Eris→djs-voice adapter listener hygiene, panel 404-vs-transient handling, fail-fast token guard.
- **Eris built-ins:** auto-reconnect with infinite attempts, `Client.connect()` internal gateway-fetch retry, per-route SequentialBucket honoring 429/502 — no extra client-side throttling needed at this scale.

## Completeness check — what this audit did NOT cover

- **Luna Sage** — excluded by request.
- **Feature correctness / game rules / Arabic content** — reliability only; a game that reliably computes the wrong payout is out of scope.
- **Money-logic integrity** — already hardened (escrow, atomic deducts, settle-once); deliberately not re-audited. Phase 6 covers the *non*-money asset classes (cards/stones/inventory/XP) that were left behind.
- **VPS deploy agent security** — already Phase 5 of the separate security gameplan.
- **Dashboard/website (Luna-Fantasy-Main) reliability** — only its read-side coupling to bot schemas was considered (Phase 6 retention note, Phase 8 heartbeat consumer).
- **Atlas-side ops** — backup/restore drills, Atlas alerting, connection-string rotation.
- **Discord-side configuration** — role/permission audits, dev-portal intent toggles beyond the Phase 8 presence untick.
- **Load beyond ~1,400 users** — all calibrations assume current scale; the down-ranked index/TTL items are the first to revisit on growth.