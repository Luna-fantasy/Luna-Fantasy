All investigation complete. Final findings below.

---

## AXIS REPORT: Oracle VC/Music Deep-Dive + Cross-Bot Startup/Observability

### TOP FINDINGS

**1. Zombie-on-init-failure: bot stays "online" with zero managers, forever — Oracle + Butler** — HIGH, effort S
- Evidence: `LunaOracle/index.ts:192-193` (`botInitialized = true` set, then init in try/catch that only logs `[Oracle] Init error` at :372-374) and `LunaButlerMain/index.ts:188-192` (`botInitialized = true`, then bare `await initDatabase()` — no try/catch; a throw becomes a logged unhandledRejection).
- Failure scenario: Atlas hiccup at boot (initDatabase retries 5x over ~45s then throws — `database_helper.ts:31`). Bot connects to Discord, shows green in PM2, but `roomManager`/`levelManager`/etc. are undefined and voice handlers never registered. Every hub join, command, and interaction dead-errors until someone manually restarts. PM2's autorestart never fires because the process didn't crash. Jester does NOT have this problem (lazy self-healing `getMongoClient()` in `util/infra/database_helper.ts:49-67`).
- Fix: on init failure, `process.exit(1)` and let PM2 restart (restart_delay 5s already configured); set `botInitialized = true` only after success. Reuse the existing exit-on-missing-token pattern (`LunaOracle/index.ts:16-19`).

**2. Music station permanently gives up after ~65s of voice trouble; boot-restore is single-shot** — HIGH (for a 24/7 radio), effort S
- Evidence: `LunaOracle/util/managers/music_manager.ts:115` (`RECONNECT_DELAYS = [5s,15s,45s]`), `:447-451` — after 3 attempts, `stationActive = false` is persisted (`data.active: false`), so even the next PM2 restart won't restore it. Also `:234-239` — `restore()` at boot tries `joinVC` exactly once; if Discord voice isn't ready seconds after gateway connect (common), it logs and returns, leaving `stationActive=true` in memory with no connection and a possibly-leaked Signalling connection (never destroyed).
- Failure scenario: any Discord voice outage or gateway resume storm >65s → radio dies silently and stays dead across restarts until an admin notices and re-runs `/station start`.
- Fix: don't flip `data.active` off on network failure — keep it true and add a slow retry tier (every 5 min, re-run the existing `restore()`/`joinVC` path while `stationActive`). All plumbing already exists.

**3. No stuck-track watchdog + error path dead-ends the player** — MED-HIGH, effort S/M
- Evidence: `music_manager.ts:371-386` — after 5 consecutive player errors it logs "pausing playback" and returns: `stationActive` stays true, no retry timer, the last track's 15s `updateInterval` (:474-475) keeps firing REST edits forever on a silent panel. And `:462` — R2 tracks get `duration = 0`; ffmpeg reads an HTTPS URL, so a stalled CDN stream never emits Idle *or* error → queue never advances, radio hangs indefinitely with frozen progress bar.
- Fix: inside the existing 15s `updateInterval`, force `s.player.stop()` when elapsed > duration+60s (call the existing `getDuration()` — ffprobe accepts URLs — at `play()` time for R2 tracks so duration is known); and replace the ≥5-errors bail with a 60s cooldown then resume via `autoPickNext()`.

**4. Oracle PM2 config: 256M cap + max_restarts:10 = OOM kills and possible permanent downtime** — HIGH, effort S
- Evidence: `LunaOracle/ecosystem.config.cjs:14-18` (`max_memory_restart: '256M'`, `max_restarts: 10`, `min_uptime: 5000`). Quantified footprint: node+tsx (~50-70MB RSS) + Eris with guildMembers intent + mongodb driver + @discordjs/voice with sodium-native/opus buffers realistically idles 130-200MB. Note the canvas/gifenc deps in CLAUDE.md are stale — `package.json` no longer has them, so the load is voice+eris+mongo. Spike sources: `index.ts:69-89` builds full base64 data-URIs of avatar/banner in heap on profile updates. Headroom is <60MB; a GC-lagged spike → PM2 SIGKILL mid-playback (users hear the radio die, temp-room events drop during restart). Worse: 10 consecutive <5s crashes (bad deploy, native module failure) → PM2 "errored" state → Oracle stays DOWN with no cron_restart safety net (Butler has one; Oracle doesn't).
- Fix: bump to 512M (Butler gets 3.5G, Jester 12G — 512M is still conservative) and either raise `max_restarts` or add `cron_restart` like Butler's.

**5. No externally visible health signal from any bot — dashboard/deploy verifier can only see PM2 process state** — MED-HIGH, effort S/M
- Evidence: Jester computes a full `HealthReport` (latency, failure rate, disconnects) in `util/infra/connection_health.ts:110-154` but it is never persisted or exposed — logStatus() to console every 10min only. Butler and Oracle have nothing. Dashboard `SystemHealth.tsx:92-95` renders only PM2 `status`/`pm_uptime` from the VPS agent. Grep across all three bots + dashboard: zero `bot_health`/heartbeat writes.
- Failure scenario: a zombie bot (finding 1), a wedged event loop, or dead Mongo pool all show green "online" on the ops dashboard; nobody knows until users complain.
- Fix: each bot `updateOne` into shared Mongo `bot_health` (`_id`: bot name; uptime, RSS, gateway latency, lastEventAt, managersReady flag) every 60s — reuse `getMongoCollection()` + Oracle's `bot_profiles` polling pattern in reverse; Jester just persists its existing `getReport()`. Dashboard already reads the same Atlas DB; deploy verifier can then check heartbeat freshness + `managersReady`, not just PM2 uptime.

**6. uncaughtException swallowed → corrupted-state continuation; Jester discards the stack trace** — MED, effort S
- Evidence: `LunaButlerMain/index.ts:151-163` — exception logged, `process.exit(1)` commented out, so ANY uncaught exception (not just the whitelisted network ones) continues in unknown state. `LunaJesterMain/index.ts:1787-1791` — logs `err.message, origin` only: no stack, making a 3am crash undiagnosable from logs. `LunaOracle/index.ts:742-748` — logs and continues.
- Failure scenario: a throw mid-game-settlement or mid-room-mutation leaves in-memory maps inconsistent; bot limps on producing stuck games/rooms instead of a clean 5s PM2 restart (Jester's SIGTERM path already saves active games — but that safety only runs on signals, not on this path).
- Fix: log full `err.stack`, keep the network-error whitelist, and `process.exit(1)` for everything else — PM2 restart + Jester's game restore / Oracle's reconcile() already make restarts near-lossless.

**7. Logging is unstructured and self-destructing — 3am diagnosis is grep-hostile** — MED, effort M
- Evidence: console.* call sites: Butler 559, Jester 963, Oracle 118; no logger helper exists anywhere (only domain loggers `card_logger.ts`/`stone_logger.ts` which write transactions, not diagnostics). Tag conventions are inconsistent (`[Music]`, `[HEALTH]`, `[MESSAGE-HANDLER]`, bare). All three call `console.clear()` inside `on("ready")` (Butler :183, Jester :489, Oracle :188) — ready re-fires on every gateway re-identify, injecting reset escape codes into `output.log` right after the most interesting pre-disconnect context. Neither ecosystem file configures rotation (if pm2-logrotate isn't installed on the VPS, logs grow unbounded).
- Fix (calibrated — NOT pino/winston at 1,400 users): one ~30-line levelled logger helper per bot (`log.info('music', ...)` → ISO timestamp + module tag), delete the three `console.clear()` calls, verify `pm2 install pm2-logrotate` on the VPS. That alone makes `grep '\[ERROR\]' output.log` around a crash timestamp actually work.

**8. DAVE protocol not installed — forward-compat risk for all Oracle voice** — LOW-MED (today), effort S
- Evidence: `@discordjs/voice` 0.19.2 installed (`node_modules/@discordjs/voice/package.json`), no `@snazzah/davey` in `node_modules/@snazzah` (absent) or package.json. 0.19.x supports Discord's E2EE voice (DAVE) only via that optional dep; connections currently succeed by downgrading.
- Failure scenario: Discord is progressively mandating DAVE for guild voice; when enforcement reaches the guild, every `joinVoiceChannel` fails and the radio + any future voice features break at once, looking like a mystery outage.
- Fix: `pnpm add @snazzah/davey` (native module — verify it builds on the VPS during the next deploy).

---

### ALREADY SOLID (do not touch)

**Oracle room lifecycle (genuinely premium-grade):**
- `discordRetry()` with error classification (already_acknowledged/fatal/retry) + jittered exponential backoff — `util/helpers/functions.ts:81-137`
- Grace-period race guards (timer identity re-check before and after async gaps) — `room_manager.ts:379-408`; idempotent deletes via `inFlightDeletes`; Discord-first delete ordering with DB row kept for retry (:295-312)
- Orphan sweep with snowflake-age guard + non-empty skip (:827-890); external-deletion handler wired to `channelDelete` (voice_handler.ts:160-169); startup `reconcile()` archives + restarts grace periods
- Hub rescue with 3-strike retry budget + stale-entry cleanup — `index.ts:277-339`
- Bitrate kbps→bps normalization already fixed — `room_manager.ts:148`; VC-status REST removed entirely
- Panel: 404-vs-transient distinction on edits (`music_manager.ts:598-608`), send-failure 60s backoff + concurrency lock (BUG-13, `room_manager.ts:30-33,693-695`)
- Music state persisted to Mongo + restored on boot; custom Eris adapter correctly deregisters its `rawWS` listener in `destroy()` (music_manager.ts:798); R2 track URLs host-allowlisted (:29,56)
- Welcome cooldown map has a cleanup interval (voice_handler.ts:19-24) — no leak

**Cross-bot:**
- Mongo resilience: Jester's lazy self-healing client with recoverable-error classification is exemplary (`util/infra/database_helper.ts`); Oracle/Butler both do 5-attempt boot retry with retryWrites/retryReads
- Graceful shutdown: Jester saves + notifies active games with 5s cap (`index.ts:1794-1873`); Oracle clears all timers, saves music state, closes Mongo (`index.ts:711-737`); interval handles tracked to prevent stacking on reconnect, `botInitialized` guards in all three
- Jester's in-process `connectionHealth` monitor: VPS-calibrated latency thresholds (1500/3000ms), Infinity-latency rejection, game-start gating via `getBlockedReason()` — only needs its report *persisted* (finding 5), not changed
- Butler Eris client tuning (`index.ts:107-125`): messageLimit 25, disabled TYPING/PRESENCE events, compression, getAllUsers off — memory-conscious and correct
- PM2 configs for Butler/Jester are appropriately sized with kill_timeout for graceful shutdown; Butler's daily cron_restart explains most of its 354 restarts (≈1/day is by design, not instability)