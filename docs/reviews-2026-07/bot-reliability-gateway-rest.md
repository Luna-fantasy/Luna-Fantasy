All investigation complete. Here is the Discord Gateway + REST resilience audit.

---

# AXIS REPORT: Discord Gateway + REST Resilience (Butler / Jester / Oracle)

## TOP FINDINGS

### 1. [HIGH] Jester: custom HTTPS agent (20s idle-kill) is also installed as the **gateway websocket agent** — likely cause of recurring shard disconnect churn
- **Evidence:** `LunaJesterMain/index.ts:226` passes `agent: discordAgent` as a **top-level** (deprecated) Eris option. Eris copies it onto the WS options: `node_modules/eris/lib/Client.js:166-170` (`this.options.ws.agent = this.options.agent`). The agent's `createConnection` (`LunaJesterMain/util/infra/discord_agent.ts:23-40`) arms `sock.setTimeout(20000)` and **destroys the socket** on 20s of inactivity ("Socket timeout - connection stale or TLS handshake hung").
- **Failure scenario:** Discord's gateway heartbeat interval is ~41.25s. During quiet periods (late night, low chat — anything with a >20s gap in gateway traffic), the shard's TLS socket is destroyed by the bot's own agent → `shardDisconnect` → resume cycle. Every resume risks dropped events (missed button clicks, missed messages) and shows up as the `[SHARD] disconnected` / `[AGENT] Timeouts since last check` log pairs. This directly undermines uptime and is self-inflicted.
- **Severity:** High. **Effort:** S.
- **Fix:** Move the agent to the REST-scoped option like Butler does with its `rest: {}` block (`LunaButlerMain/index.ts:110-113`): `rest: { agent: discordAgent, requestTimeout: 15000, latencyThreshold: 30000 }` and delete the top-level `agent`/`requestTimeout`/`latencyThreshold` keys. Defense-in-depth: raise `socketTimeout` above the heartbeat interval (e.g. 90s) so even a mistakenly-shared agent can't kill an idle-but-healthy socket. Verify after deploy by watching `[SHARD]` disconnect frequency drop.

### 2. [HIGH] Butler + Oracle: one-shot `ready` init sets the "initialized" flag **before** the work — a boot-time MongoDB/API hiccup leaves a half-dead bot that looks online
- **Evidence:** Butler `LunaButlerMain/index.ts:188-189` — `botInitialized = true` immediately, then `await initDatabase()` (line 192) and ~20 manager constructions with **no try/catch around the ready body**. Oracle `LunaOracle/index.ts:192-193` — `botInitialized = true` before the `try`, and the catch at :372-374 just logs `[Oracle] Init error`.
- **Failure scenario:** Atlas is slow/unreachable for 30s at PM2 restart (common right after a crash loop). Butler: `initDatabase()` throws inside the async listener → swallowed as unhandledRejection → **no managers exist**; every command crashes with `bot.pointsManager is undefined` until the 4 AM cron restart. Oracle: voice handlers never register, hubs stop creating rooms, panels dead — bot shows green in Discord, PM2 shows "online". Nothing self-heals because the guard flag is already set and `ready` won't re-run the block.
- **Severity:** High (this converts a 30s outage into an hours-long silent outage). **Effort:** S.
- **Fix:** Set the flag **only after** init succeeds, and wrap init in a retry loop with backoff (Butler already has `getBackoffDelay`/`discordRetry` in `util/helpers/functions.ts:131-180` to reuse; Oracle can copy the `RECONNECT_DELAYS` ladder pattern from `music_manager.ts:398`). On final failure, `process.exit(1)` so PM2 restarts into a clean boot instead of running a zombie. Jester is already the model here: its guard is `if (!bot.pointsManager)` with sync constructors and backgrounded DB init (`LunaJesterMain/index.ts:505-521`).

### 3. [MED-HIGH] Oracle music: `VoiceConnection` has no `'error'` listener, and a failed restore leaves `stationActive=true` with no connection — station silently dead until manual intervention
- **Evidence:** `LunaOracle/util/managers/music_manager.ts:319-329` and `:419-424` attach only `Disconnected`/`Destroyed` status listeners; there is no `connection.on('error', ...)` anywhere (grep confirms only the audio *player* has one, :371). And in `restore()` (`music_manager.ts:226`), `s.stationActive = true` is set before `joinVC`; the failure path at :236-239 logs and returns **without resetting it or retrying**.
- **Failure scenario:** (a) A voice-networking error emits `'error'` on the connection → unhandled `'error'` on an EventEmitter throws → caught only by the global `uncaughtException` logger (`index.ts:742-744`) which never exits → playback state left inconsistent (this is exactly the "Oracle voice is most crash-prone" signature). (b) Oracle reboots while the voice gateway is flaky (typical right after a crash): restore's single `joinVC` attempt fails → music never plays, DB still says active, and `/station start` is refused with "المحطة تعمل بالفعل" (`station()` guard at :171-173) — an admin must know to run `/station stop` first.
- **Severity:** Med-High. **Effort:** S.
- **Fix:** Add `s.connection.on('error', err => …log…)` at both creation sites (:311, :411) — status listeners already drive recovery, the listener just needs to exist to prevent the throw. In `restore()`, on join failure call the existing `attemptReconnect(guildId)` ladder (`:393-452`) instead of returning, or at minimum reset `s.stationActive = false` and `saveState()`.

### 4. [MED] Oracle: `discord_rest.ts` raw-fetch path has near-zero retry and bypasses all rate-limit bookkeeping — panels/music UI silently freeze on any transient error
- **Evidence:** `LunaOracle/util/helpers/discord_rest.ts:16-25` — `fetchWithRetry` retries a 429 exactly **once** (second 429 falls through to `throw`), retries **no** network errors (ECONNRESET/timeout reject immediately), and being raw `fetch`, it skips Eris's per-route SequentialBucket (which auto-honors 429s and retries 502s — `eris/lib/rest/RequestHandler.js:292-320`). This path carries all Components-V2 traffic: room panels (30s refresh per room), music panel updates, whispers.
- **Failure scenario:** Busy evening with 6-8 live rooms → panel edits + music progress edits share the process; one Cloudflare blip or double-429 → `editComponentsV2` throws → callers mostly `.catch(() => {})` → the panel just stops updating with no recovery, or an uncaught rejection is logged. Users see frozen/stale control panels; staff assumes bot is broken.
- **Severity:** Med. **Effort:** S/M.
- **Fix:** Give `fetchWithRetry` a proper loop (3 attempts, exponential backoff) covering 429 (honor `Retry-After` each time), 5xx, and the transient-error patterns already enumerated in Jester's `discord_agent.ts:91-104` — copy that list rather than inventing one. Keep the 404 short-circuit in `deleteMessageRest`.

### 5. [MED] Jester: the interaction queue with per-type concurrency caps is **dead code** — imported, never invoked
- **Evidence:** `LunaJesterMain/index.ts:61` imports `interactionQueue`; grep across the repo shows `enqueue()` is called **nowhere** — the only references are the import and the class file itself (`util/infra/interaction_queue.ts:205`). The stats logger (`:207-210`) dutifully prints all-zero stats every 5 minutes. CLAUDE.md documents the ADMIN:20/GAME:15/TRADE:10/SHOP:8 caps as active protection.
- **Failure scenario:** Not a crash — a false safety belief. Burst load (mass luckbox opens, auction sniping) hits handlers unthrottled; anyone tuning "the caps" changes nothing. Also, if someone ever wires it as-is, the 5s queue-wait timeout (`interaction_queue.ts:94,114-121`) rejects tasks *after* the 3s ACK deadline has already passed — queued interactions would die unacked.
- **Severity:** Med (misleading infra, same class as the deleted batch_writer). **Effort:** S.
- **Fix:** Follow the deprecate pattern: for ~1,400 users Eris's own per-route buckets plus the per-user cooldown check (`index.ts:729-743`) are sufficient — delete the queue and its CLAUDE.md section after a zero-consumer grep, or explicitly wire `enqueue` into the component dispatch if throttling is truly wanted (then ACK **before** enqueueing).

### 6. [MED] Butler: privileged `presences` + typing intents requested but never used — gateway firehose the bot pays for and throws away
- **Evidence:** `LunaButlerMain/index.ts:108` — `intents: 53608447` sets bits 0-16 (incl. `guildPresences` 1<<8, `guildMessageTyping` 1<<11, `dmTyping` 1<<14) plus automod bits. Meanwhile `disableEvents: { TYPING_START, PRESENCE_UPDATE }` (:121-124) proves the events are unwanted — but `disableEvents` only skips *processing*; Discord still streams every presence/typing update over the socket because the intent is granted.
- **Failure scenario:** In a 1,400-member guild, presence updates are typically the highest-volume gateway event. Butler decompresses and parses them all day for nothing — steady CPU/heap churn on a bot with ~354 restarts and a daily memory-hygiene cron, plus fatter resume replays after every disconnect.
- **Severity:** Med (efficiency/uptime, not correctness). **Effort:** S.
- **Fix:** Replace the magic number with an explicit named-intent list (Oracle's style, `LunaOracle/index.ts:26-33`): `guilds, guildMembers, guildMessages, guildMessageReactions, guildVoiceStates, messageContent, directMessages` — mirror what Jester's lean `37379` does (`LunaJesterMain/index.ts:224`) plus voice states for the VoiceTracker. Then drop the now-dead `disableEvents` entries and untick Presence Intent in the dev portal.

### 7. [LOW-MED] Butler: ~82 raw interaction API calls bypass the safe wrappers; the standard `defer().catch(() => {})` pattern keeps working after a failed defer
- **Evidence:** `grep` count: 82 raw `interaction.defer/createMessage/editOriginalMessage` sites across 9 files (`commands/profile_commands.ts:422,493,532,571`, `banker_commands.ts`, `shop.ts`, `valecroft_commands.ts`, etc.) despite the project rule "never use raw Eris API calls". Typical: `await interaction.defer(64).catch(() => {}); …canvas render… await interaction.editOriginalMessage(...)`.
- **Failure scenario:** A dropped defer (transient network, 10062 on a stale click) is swallowed → the handler still renders a 1024x1792 profile card (CPU burn) → every follow-up `editOriginalMessage` fails → user sees "application did not respond" and Butler wastes a full canvas render per retry-click. No crash (the `safeInteractionHandler` try/catch at `index.ts:918-937` contains it), but degraded under exactly the network conditions where you want graceful behavior.
- **Severity:** Low-Med. **Effort:** M (mechanical).
- **Fix:** Reuse the existing pattern already proven in the same repo — `handleHonorCommand` (`index.ts:884-885`): `const deferred = await safeDefer(interaction, 64); if (!deferred) return;`. Sweep the 9 files; `safeDefer`/`safeEditOriginalMessage` from `util/helpers/functions.ts:205,232` already handle retry + 40060/10062 classification.

### 8. [LOW] Jester: `[REST_RETRY]` patch doesn't cover Discord 500/503 — and blindly re-POSTs on ambiguous timeouts
- **Evidence:** `LunaJesterMain/util/infra/discord_agent.ts:91-113` — `TRANSIENT_ERROR_PATTERNS` covers socket-level failures only. Eris itself retries only 429 and 502 (`eris/lib/rest/RequestHandler.js:292-320`); a Discord 500/503/504 therefore fails on the first attempt through this patch. Butler's `classifyError` (`functions.ts:96-106`) correctly treats 500/502/503 as retryable — Jester's global patch does not. Conversely, the patch retries `'timed out'`/`'socket hang up'` on **POSTs**, where the original request may have landed → occasional duplicate game messages (money paths are idempotent already, so cosmetic).
- **Failure scenario:** Discord has a 5xx blip during a game round → a non-`gameResilientSend` call (e.g. a vendor panel edit) fails once and gives up → stale shop panel / missing round message. Rare, bounded.
- **Severity:** Low. **Effort:** S.
- **Fix:** Add `'500'`, `'503'`, `'Service Unavailable'`, `'Internal Server Error'` to the pattern list (mirroring Butler's classifier), and optionally skip retry for `method === 'POST'` on the ambiguous `'timed out'` case. Optional (cheap, not over-engineering): since `connectionHealth` already records `lastHeartbeat` (`connection_health.ts:61-67`), add a 5-minute staleness check that `process.exit(1)`s so PM2 revives a zombie gateway — the data is already collected, nobody acts on it.

---

## ALREADY SOLID — do not touch

**All three bots**
- Eris auto-reconnect is on by default with `maxReconnectAttempts: Infinity`, and `Client.connect()` self-retries gateway fetch failures internally with backoff (`eris/lib/Client.js:504-513`) — no zombie-on-boot-connect risk despite Butler/Oracle's uncaught `bot.connect()`.
- Eris's `SequentialBucket` transparently queues per-route requests, honors 429 `Retry-After` (incl. global/shared scopes), and retries 502s up to 4x — so "bulk" role grants / sequential sends do not need extra client-side throttling at this scale.

**Butler**
- `discordRetry` + `classifyError` (`util/helpers/functions.ts:64-180`) is the best REST wrapper in the ecosystem: proper error taxonomy (10062/40060/10008/50013 vs retryable 5xx/timeout/429), exponential backoff with jitter, honors `retryAfter`. Keep as the reference implementation.
- Gateway events (`error`, `disconnect`, `shardReady`, `shardDisconnect`) all handled/logged; interval stacking on reconnect is correctly prevented by tracked interval handles (`index.ts:133-139, 274-281`); `bulkEditCommands` failure is non-fatal (`index.ts:396-400`).
- `safeInteractionHandler` gives every slash/component route a crash barrier plus a user-facing Arabic error message.

**Jester**
- `interaction_helper.ts` is genuinely strong: `immediateAck`/`safeDeferUpdate` with pre-flight staleness check (2.5s), defer timeout race, ack-dedupe (`ackTracker`), and `gameResilientSend/Edit` with 5 retries, 429 `retry_after` honoring, and dead-channel short-circuits. Global component defer at `index.ts:972-979` bails cleanly when defer fails.
- The `[REST_RETRY]` patch signature matches Eris 0.18's `RequestHandler.request` exactly and correctly rebinds; socket-level retry with capped exponential backoff is sound (subject to finding 8).
- `connectionHealth` latency thresholds were already re-tuned for the Norway VPS (1500/3000ms) with `Infinity` heartbeat rejection; game-start gating via `getBlockedReason()` is a good degradation pattern.
- Startup diagnostics (gateway reachability probe, 60s no-ready watchdog log, `[WS] READY/RESUMED` raw logging, slash-command registration with 3 retries in background) are exemplary.
- Ready-handler re-init guard (`if (!bot.pointsManager)`) is correct and reconnect-safe.

**Oracle**
- Hub-cleanup 3-strike retry budget (`index.ts:279-339`) is a textbook self-healing loop — transient createRoom failures no longer kick users.
- Music `attemptReconnect` ladder with staged delays, listener cleanup before re-join, player re-subscribe, and clean deactivation after exhaustion (`music_manager.ts:393-452`) is well built (just needs the `'error'` listener from finding 3).
- The Eris→@discordjs/voice adapter (`music_manager.ts:780-801`) correctly scopes `rawWS` listeners per connection and detaches them in `destroy()` — no listener leak.
- Orphan-channel sweep + startup `reconcile()` + dashboard pending-actions poller give the VC system good eventual consistency with Discord state.