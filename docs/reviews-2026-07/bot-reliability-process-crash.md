# Process-Level Crash Resilience Audit — Butler / Jester / Oracle

## TOP FINDINGS

### 1. Butler: boot init failure creates a permanent zombie (HIGH, effort S)
`C:\Users\Admin\Desktop\Luna Bot\LunaButlerMain\index.ts:188-189` sets `botInitialized = true` **before** `await initDatabase()` (line 192), and the entire ready-handler init (managers, trackers, ensureIndexes) has **no try/catch**. `initDatabase()` throws after 5 attempts (~45s) (`util/helpers/database_helper.ts:19-33`).
**Failure scenario:** Atlas blip >45s at boot (or any throw in `initImageCache`/`ensureIndexes`) → rejection swallowed by the `unhandledRejection` handler (index.ts:143-149) → bot is connected to Discord with **zero managers**. Every command throws `TypeError: Cannot read ... of undefined`, silently logged, until the 4AM cron restart — up to ~24h of total outage while PM2 shows green. Reconnects don't retry because `botInitialized` is already true.
**Fix:** wrap the init block in try/catch; on failure `console.error` + `process.exit(1)` (PM2 restarts it); move `botInitialized = true` to after successful init. Reuse Oracle's fail-fast posture (`LunaOracle/index.ts:16-19`).

### 2. Oracle: same zombie pattern — init error leaves the whole VC system dead (HIGH, S)
`C:\Users\Admin\Desktop\Luna Bot\LunaOracle\index.ts:192-193` sets `botInitialized = true` before the try; the catch at 372-374 only logs `[Oracle] Init error`.
**Failure scenario:** Mongo down at boot → no `roomManager`, `registerVoiceHandlers` never runs → users join hub channels and nothing happens; announce still half-works so it looks "up". Stays broken until manual restart (Oracle has no cron).
**Fix:** `process.exit(1)` in the ready catch — Oracle already exits on missing token, keep that posture consistent.

### 3. Butler + Jester: failed `bot.connect()` / missing token = silent permanent outage (HIGH, S)
- Butler `index.ts:1204`: bare `bot.connect();` — rejection goes to the log-and-continue `unhandledRejection` handler. Token is `process.env.BOT_TOKEN || ""` (`config.ts:5`) — empty string is accepted.
- Jester `index.ts:1929-1932`: `.catch` logs only. Token is `process.env.BOT_TOKEN!` (`config.ts:5`) — no validation.
**Failure scenario:** missing/rotated token or gateway auth failure → process idles forever, PM2 shows "online", zero restarts, bot fully down with no self-healing.
**Fix:** copy Oracle's boot guard (`if (!config.token) { console.error; process.exit(1) }`) into both, and `bot.connect().catch(err => { console.error(err); process.exit(1); })` so PM2's autorestart actually engages.

### 4. Oracle: 256M `max_memory_restart` is the main crash driver (HIGH, S)
`C:\Users\Admin\Desktop\Luna Bot\LunaOracle\ecosystem.config.cjs:14` — 256M cap on a process running tsx + Eris + mongodb + `@discordjs/voice` + `@discordjs/opus` + `sodium-native` (package.json:13-19). Baseline RSS for that stack is ~150-220M idle; music playback with `inlineVolume: true` (`util/managers/music_manager.ts:468`) adds in-process PCM transforms.
**Failure scenario:** normal music session pushes RSS over 256M → PM2 kills mid-playback → music dies, panel refresh timers die, rooms re-reconcile; users experience random voice drops "for no reason". This — not code crashes — is likely most of Oracle's restart count.
**Fix:** raise to 512-768M. Also `kill_timeout: 5000` (line 19) is tight for `shutdown()` (index.ts:711-737: roomManager updateMany + Mongo close + music teardown) — bump to 10000 to match Butler/Jester.

### 5. Jester: 12G memory cap + 8G heap means PM2's graceful restart never fires — OOM killer does (MED-HIGH, S)
`C:\Users\Admin\Desktop\Luna Bot\LunaJesterMain\ecosystem.config.json:6,11` — `--max-old-space-size=8192` with `max_memory_restart: "12G"`.
**Failure scenario:** on any VPS with <12G free, a leak (canvas buffers, gif encoding) hits the Linux OOM killer **before** PM2's threshold. OOM = SIGKILL = the excellent `gracefulShutdown` (index.ts:1794-1873) never runs → active LunaFantasy/GrandFantasy/FactionWar games are NOT saved → players lose in-progress games. This plausibly explains a chunk of the 237 restarts. 8G heap for ~1,400 users is over-provisioned, not protective.
**Fix:** set `max_memory_restart` to ~2500M and heap to 4096 so PM2's SIGINT path (which saves games) always preempts the kernel.

### 6. Jester: `uncaughtException` logs message only — no stack; both Butler & Jester continue unconditionally (MED, S)
Jester `index.ts:1787-1791` logs `err.message, origin` — every crash-class bug becomes an undiagnosable one-liner (`Cannot read properties of undefined` with no file/line). Butler `index.ts:151-163` deliberately never exits (exit is commented out) even for unknown exceptions — per Node docs the process is in undefined state; a corrupted Eris/socket state then persists until the next cron restart.
**Fix:** log `err.stack` in Jester; in both bots, for exceptions that aren't the known network noise (Butler already whitelists ECONNRESET/ETIMEDOUT), call the existing `gracefulShutdown()` then `process.exit(1)` — Jester's game persistence + restore (index.ts:539-581) makes restarts cheap, so restarting is safer than limping.

### 7. Butler: daily 4AM cron restart silently loses voice-XP sessions and in-memory games (MED, M)
`gracefulShutdown` (`index.ts:1181-1198`) only disconnects + closes Mongo. Not flushed: `chatTracker.flushPendingMessages()` (5s batch, `util/tracking/chat_tracker.ts:165`), `chatEventTracker`, and `voiceTracker.voiceSessions`. Worse: `VoiceTracker` (`util/managers/voice_tracker.ts:23-53`) has **no startup scan** of existing voice states.
**Failure scenario:** every night at 4AM, everyone sitting in VC (a) loses un-awarded session time and (b) **stops earning voice XP entirely** until they leave and rejoin — silent, recurring, self-inflicted by the cron. In-memory xo/rps/connect4/luna21 games also vanish (only Baloot persists via `loadAllGames`, index.ts:211).
**Fix:** in `gracefulShutdown`, await tracker flushes and run the voice-leave award for each active session (the award code already exists in `handleVoiceLeave`); on boot, iterate `guild.voiceStates` to re-register sessions — same reconcile pattern Oracle uses (`room_manager reconcile`). Jester's shutdown (index.ts:1798-1867) is the model to copy.

### 8. PM2 restart policies: Butler can wedge in "errored"; nobody uses backoff (MED, S)
Butler `ecosystem.config.cjs:27-29`: `max_restarts: 10`, `min_uptime: 10000`, fixed `restart_delay: 5000`.
**Failure scenario:** a boot-time crash loop (bad env after deploy, Atlas outage — especially once findings 1/3 make boot fail-fast) exhausts 10 restarts in ~2 min → PM2 marks it **errored** → bot stays down until a human runs `pm2 restart`. Jester/Oracle rely on defaults (16 unstable restarts / min_uptime 1s).
**Fix:** add `exp_backoff_restart_delay: 5000` to all three and raise `max_restarts` (e.g. 50) — a bot that retries every few minutes during an Atlas outage recovers by itself; one in "errored" doesn't. Minor related drift: Butler's ecosystem runs `tsx index.ts` (lines 6-7) while package.json `start` and the deploy agent build `dist/` — one of those paths is dead weight; pick one so a broken build can't silently diverge from what's running.

**Minor (not counted):** Jester's interaction queue (`util/infra/interaction_queue.ts:125-138`) has no timeout on *executing* handlers — a never-settling handler permanently leaks a concurrency slot (15 leaks = all game buttons dead until restart). Low likelihood since Eris `requestTimeout: 30000` and Mongo `socketTimeoutMS` bound most awaits; worth a `Promise.race` guard only if stuck-button reports appear.

## ALREADY SOLID — do not touch

- **All 3 bots register `unhandledRejection` handlers** → the 40+ `setTimeout(async ...)` / fire-and-forget sites cannot crash the process; most also have local try/catch.
- **Jester Mongo layer** (`util/infra/database_helper.ts`): retry with backoff, recoverable-error reconnect, `retryWrites/retryReads`, lazy re-init — best DB resilience in the ecosystem.
- **Jester graceful shutdown** (`index.ts:1794-1873`): per-game save with catch + 5s race timeout, player notification in Arabic, restore-on-boot — the reference implementation for finding 7.
- **Jester startup diagnostics** (`index.ts:1882-1927`): token REST probe, gateway reachability check, 60s ready watchdog.
- **Butler reconnect hygiene**: interval handles tracked and cleared (`index.ts:133-140, 274-281`), `botInitialized` guard prevents double-init (just move where the flag is set), `safeInteractionHandler` wraps every route with user-facing error reply (`index.ts:918-937`).
- **Oracle defensive habits**: fail-fast on missing token (index.ts:16-19), every interval body try/caught, hub-cleanup 3-strike retry budget (index.ts:279-339), grace-period race handling, startup reconcile, music player `'error'` handler with consecutive-error counter (`music_manager.ts:371,388`).
- **Eris hardening (Butler/Jester)**: `requestTimeout: 30000`, `connection_health` + `getBlockedReason()` gate before games, `patchErisRestWithRetry` (`discord_agent.ts`).
- **PM2 basics**: fork mode, autorestart, merged logs, Butler/Jester `kill_timeout: 10000` matches their shutdown budgets.

**Over-engineering to avoid at 1,400 users:** no HTTP health-check servers, no external watchdogs, no clustering/sharding, no `wait_ready`/`process.send('ready')` machinery. Jester's 8G heap / `UV_THREADPOOL_SIZE: 12` are already oversized — the fixes here are trims and small guards, not new infrastructure.