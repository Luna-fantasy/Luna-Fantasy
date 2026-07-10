Investigation complete. Findings below, verified against source.

# MEMORY LEAKS + RESOURCE MANAGEMENT — Audit Findings

## TOP FINDINGS (ranked)

### 1. Jester image worker pool: a timed-out task permanently leaks a worker slot — pool silently degrades to zero
**Evidence:** `C:\Users\Admin\Desktop\Luna Bot\LunaJesterMain\util\canvas\image_worker_pool.ts:89-92` and `:152-157`
When a render exceeds its timeout (roulette GIF = 25s, easily hit under load), the timeout handler deletes the task from `pendingTasks` and rejects. But the worker is still busy rendering. When it finishes and posts its message, `handleWorkerMessage` hits `if (!task) { console.error(...); return; }` — it returns **without pushing the worker back to `availableWorkers` and without calling `processNextTask()`**. That worker is alive but never scheduled again.
**Failure scenario:** 4 slow GIFs during a busy evening → all 4 workers permanently sidelined → `this.workers.length > 0` so the main-thread fallback never activates → every queued task sits forever. Worse: tasks still in `taskQueue` (never assigned) are not in `pendingTasks`, so their timeout's `if (this.pendingTasks.has(taskId))` is false → **reject never fires → the caller awaits forever** → roulette game never posts the spin, `activeRoomGames` keeps the channel blocked, users see a dead game until restart. This is a prime candidate for the Jester restart pattern.
**Severity:** Critical | **Effort:** S
**Fix:** In the unknown-task branch of `handleWorkerMessage`, still do `this.availableWorkers.push(worker); this.processNextTask();`. In the timeout handler, also splice the task out of `taskQueue` and reject unconditionally.

### 2. Worker pool: crashed workers are never respawned
**Evidence:** `image_worker_pool.ts:126-138` (`handleWorkerExit` only removes from arrays; no replacement is created).
**Failure scenario:** a worker dies (native canvas crash / OOM in `@skyra/gifenc`) → pool shrinks to 3, 2, 1 silently. When it hits 0, all rendering falls back to the **main thread** (`generateRouletteGif` fallback at :184-188) — GIF encoding blocks the event loop for seconds per spin → Eris heartbeat misses → shard disconnect/reconnect storms → looks like "the bot is dying."
**Severity:** High | **Effort:** S
**Fix:** In `handleWorkerExit`, create a replacement `Worker` with the same three listeners (extract the loop body of `initialize()` into `spawnWorker()` and reuse it). Add a simple respawn cap (e.g. 3 respawns/min) to avoid a crash loop.

### 3. Jester `activeRoomGames` has no orphan sweeper — channels get permanently bricked for games
**Evidence:** `C:\Users\Admin\Desktop\Luna Bot\LunaJesterMain\index.ts:275-310` (5-min sweeper covers only `activeGames` + `activeEventGames`), `index.ts:105` (`gameGateCheck` refuses any new game if `activeRoomGames.has(channel)`).
**Failure scenario:** any game orphaned by an uncaught throw between rounds → after 30 min the sweeper deletes it from `activeGames` **but leaves its `activeRoomGames` entry** → that channel refuses all 8 prefix games ("There's already an active game") until restart or a manual `!stop`. Users experience a dead game channel for hours.
**Severity:** High (stuck-state, small memory) | **Effort:** S
**Fix:** In the same 5-min sweeper, iterate `activeRoomGames` and delete entries whose `gameId` is absent from `activeGames`/`activeFactionWarGames`/`activeGrandFantasyGames` (all already imported in index.ts).

### 4. The sweeper's `startTime` guard never matches event games and direct-start games — they are never swept
**Evidence:** `index.ts:281` and `:289` gate on `gameData.startTime`; `startTime` is only set by the lobby helper (`util\helpers\start_game.ts:111`). `commands\games\LunaFantasyEvent.ts` contains **zero** occurrences of `startTime` — so the `activeEventGames` sweep at index.ts:288-293 is a no-op. Same for LunaFantasy duels / slash duels inserted into `activeGames` without lobby.
**Failure scenario:** during an event night, every crashed/abandoned event game (players, card arrays, message refs) stays in `activeEventGames` until restart; the `[MEMORY-STATS]` line even reports the phantom count but nothing reclaims it.
**Severity:** Medium | **Effort:** S
**Fix:** Set `startTime: Date.now()` at every gameData creation site (LunaFantasyEvent, slash duel path), or make the sweeper treat missing `startTime` as sweepable by stamping one on first sight.

### 5. `activeFactionWarGames` / `activeGrandFantasyGames` have no periodic sweeper at all
**Evidence:** `commands\games\FactionWar.ts:830`, `commands\games\GrandFantasy.ts:452` (module maps); index.ts references them only in restore (:555-558), stats (:1674-1675), and the **shutdown** handler (:1841) — not in the 5-min sweeper. Cleanup relies 100% on delete-on-end paths inside `startTurn` etc.
**Failure scenario:** one uncaught throw mid-turn (e.g. Discord 500 after retries) orphans the full gameData — decks, per-player card lists, message references — forever. The `playersInGame` lock sweepers (FactionWar.ts:31, GrandFantasy.ts:53) let users start new games, so the leak is invisible until RSS creeps.
**Severity:** Medium | **Effort:** S
**Fix:** Add both maps to the existing index.ts 5-min sweeper (same `startTime` stamp as finding 4 — GF/FW gameData needs one).

### 6. eris-collects collector: constructor timer pins gameData for the full `time` even after early stop; `interactions[]` accrues every click
**Evidence:** `node_modules\eris-collects\src\InteractionCollector.js:21-25` — the `setTimeout(() => this.stop("time"), time)` is never cleared in `stop()` and never unref'd; `:16` — every matching interaction is pushed into `this.interactions` (games never read it). Both bots create collectors constantly (roulette pushes 1-4 per round: `roulette.ts:296,448,556,674`; GrandFantasy ~10 sites; Butler xo/rps/connect4/luna21).
**Failure scenario:** collector stopped 2s into a 60s invite window → the timer closure retains the collector, its filter closure (captures gameData/channel/players), and all collected interaction objects (member, message, guild refs) for the remaining 58s. Multiply by rounds × concurrent games and you get a constant heap churn floor plus periodic `MaxListenersExceeded` pressure on `interactionCreate`. Not permanent, but a real bloat driver on a busy night.
**Severity:** Medium | **Effort:** S/M
**Fix:** The library is 60 lines — vendor a patched copy as `util/helpers/collector.ts` in both bots (Jester + Butler import sites are a 1-line change each): store the timer handle, `clearTimeout` in `stop()`, and drop the `interactions.push` (emit-only). This also removes the permanent-listener risk if anyone ever creates a collector without `time`.

### 7. Jester `imageCache`: 500 raw image Buffers, count-bounded not byte-bounded, expired entries never evicted
**Evidence:** `util\helpers\functions.ts:10-12` (`MAX_CACHE_SIZE = 500`, TTL 1h), `:26-30`/`:61-65` (FIFO evict only when full; TTL checked only on `get` — a stale buffer stays resident until re-requested or FIFO'd out). Card art / backgrounds run 0.5-2MB each; there's a second 200-entry buffer cache in `util\canvas\card_images.ts:127-129`.
**Failure scenario:** steady RSS floor of hundreds of MB that never comes back down; this is consistent with `memory_monitor.ts` thresholds having been raised to 4GB warn / 6GB critical. Not a crash by itself, but it masks real leaks and inflates every restart trigger.
**Severity:** Medium | **Effort:** S/M
**Fix:** Track `totalBytes` alongside the map and evict FIFO until under a byte budget (~64MB is generous for 1,400 users); add expired-entry purge to the existing 5-min cleanup interval in index.ts. Same treatment for `cardBufferCache`.

### 8. Oracle music: reconnect path abandons the old VoiceConnection without `destroy()`
**Evidence:** `C:\Users\Admin\Desktop\Luna Bot\LunaOracle\util\managers\music_manager.ts:406-409` — on each reconnect attempt the old connection gets `removeAllListeners()` and is nulled, **without** `destroy()` (contrast with the correct catch path at :442 and joinVC at :301-307).
**Failure scenario:** @discordjs/voice keeps connections in a module-level per-guild registry; an un-destroyed connection keeps its networking state alive, and since its listeners were stripped, nothing reacts to it. Repeated reconnect cycles (Oracle's documented weak spot) accumulate zombie connection state inside a **256MB** PM2 cap — plus `joinVoiceChannel` for the same guild can hand back the existing broken connection instead of a fresh one, making "reconnected but silent" states. Voice is Oracle's crash driver; this is the leak in its hottest path.
**Severity:** Medium-High for Oracle specifically | **Effort:** S
**Fix:** Mirror line 442: `if (s.connection.state.status !== VoiceConnectionStatus.Destroyed) s.connection.destroy();` before nulling, exactly like `joinVC` already does.

## Minor (worth one-line fixes while in the area)
- `image_worker_pool.ts:54` — `maxQueueSize = 100` is declared but never enforced; queue is unbounded under a stampede.
- Oracle `handlers\panel_handler.ts:16` — `whisperCooldowns` never pruned (copy the sweeper pattern from `voice_handler.ts:19-23`).
- Oracle `util\managers\challenge_manager.ts:226` — `roomAskedQuestions` keyed by temp-VC channelId, never deleted; grows with every room ever created (tiny, but the room-delete path in room_manager is the natural hook).
- Jester `commands\trading\cards_trade.ts:865` — swap trades set `expiresAt` but have no timer/sweeper; unaccepted swaps sit in `activeTrades` until restart (small objects).

## Memory monitor assessment (axis item 6)
`util\infra\memory_monitor.ts` is log-only: 5-min samples, 12-sample history, flags "+XMB over Y min" when 80% of samples grow. Good bones, nobody consumes `getMemoryReport()`. Cheap win (S): when the trend fires, also log `imageWorkerPool.getStats()` (already exists) and the sizes of `activeGames`/`activeRoomGames`/`activeEventGames`/`activeFactionWarGames`/`activeGrandFantasyGames`/`activeTrades` — that turns "potential leak detected" into "which map is leaking." Also align thresholds (4GB/6GB) with the actual PM2 `max_memory_restart` so warnings arrive before PM2 kills.

## ALREADY SOLID — do not touch
**Jester:** `interactionCooldowns` dual cleanup (size-triggered + unref'd 60s interval, index.ts:200-221); 5-min game sweeper with `[MEMORY-STATS]` logging; per-game `playersInGame` lock TTL sweepers (LunaFantasy:55, GrandFantasy:53, FactionWar:31); luckboxes `processedInteractions` + `activeLuckboxMessages` sweepers (luckboxes.ts:33,43); book/chest/tome cleanup intervals; guess_the_country's self-healing `checkAlive` interval with proper `messageCreate` removeListener + setMaxListeners bookkeeping (guess_the_country.ts:189-199); roulette stops all its collectors on the crash path (roulette.ts:765); `game_state_persistence` clears debounce timers on remove; `withTimeout` clears its timer (index.ts:262-272); all collector creations verified to pass `time`; bounded avatar/background caches in roulette_image.ts; cache_manager + game_session_manager both run cleanup intervals.
**Butler:** every game engine has `deleteGame` + `cleanupOldGames` driven by a 30s central interval (index.ts:284-302), incl. `rouletteGames` 2-min sweep; luna21's "idle timer owns the timeout" collector pattern is deliberate and correct (luna21_commands.ts:243-255); levels textCooldowns 5-min cleanup; challenge_commands sweeper prunes rate-limits and empty voter-pattern keys; CacheManager bounded (100k, 60s cleanup, 10% eviction); all interval handles stored and cleared on shutdown (index.ts:133-139).
**Oracle:** room_manager is exemplary — identity-checked graceTimers (race-safe), self-terminating `panelRefreshIntervals`, full map cleanup on both delete paths (:242-263, :323-338), `inFlightDeletes` guard; welcomeCooldowns sweeper; welcomedMembers per-entry TTL; challenge cooldown sweepers + `clearTimeout` on every challenge end; music_manager is otherwise careful (removeAllListeners before rejoin, one player per joinVC so no listener stacking, `playedHistory` cleared when exhausted, panel `updateInterval` cleared on stop).