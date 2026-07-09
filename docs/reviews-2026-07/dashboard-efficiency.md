# Dashboard + Public Website Efficiency — Top Opportunities

**Live DB scale (measured via read-only Mongo):** points=1,396 · discord_users=1,415 · lunari_transactions=6,117 (unbounded growth) · cards=552 · stones=57 · admin_audit_log=1,562 · nemesis=62. Absolute latencies are modest *today*; the ranking below weights external-HTTP fan-out, per-poll cost, and unbounded-growth patterns highest.

---

**1. users/list: Discord REST fan-out (up to 24 external calls per page) + join-everything pipeline + a broken sort — [CONFIRMED, effort M]**
`src/app/api/admin/users/list/route.ts`
- Line 173: `getUserRanksBulk(ids)` → `src/lib/admin/ranks.ts:88-91` → `src/lib/bank/discord-roles.ts:37` fires one `GET /guilds/{gid}/members/{id}` **per row** (24/page). Discord buckets these at ~5/s, so a cold page adds 3–5s; the 220ms search debounce (`src/app/admin/users/UsersClient.tsx:127`) re-triggers this per pause-in-typing.
- Lines 103-115: 5 `$lookup`+`$unwind` over all 1,396 points docs run **before** the `$match` (pushed at line 115) — the join always materializes the whole collection.
- Line 57/60: sortSpec uses `'points.balance'` / `'levels.level'` — **neither field exists** on the joined docs (balance is root-level `balance`; level is `levels.data.level`). The "Top balance" sort is a silent no-op sorting on missing==null, and it's a blocking in-memory sort of the full joined set every request.
**Rewrite:** (a) filter-first: numeric q → `$match {_id}` on points; name q → regex query `discord_users` first (1,415 docs, collscan fine), then `$match {_id: {$in: ids}}`; faction/staff/passport → query `profiles` first. Then `$sort {balance: -1}` (add index, see #2), `$skip/$limit`, and `$lookup` only the ≤60 page rows. (b) Replace per-user member fetches with ONE `GET /guilds/{gid}/members?limit=1000` (2 calls covers the whole guild) cached 5 min in a module map — drops 24 REST calls to ~0.

**2. Zero secondary indexes on every hot collection — ensureAuditIndexes exists but is never called — [CONFIRMED, effort S]**
Measured live: `lunari_transactions`, `cards_transactions`, `stones_transactions`, `admin_audit_log`, `discord_users`, `card_marketplace` all have **only `_id_`**. Yet:
- `activity/stream/route.ts:39-50` sorts 4 collections on `timestamp`/`createdAt` desc every 5s poll (see #3) — in-memory sort of 6,117+ docs, growing forever.
- `users/list/route.ts:147-151` filters `{discordId: {$in}, createdAt: {$gte}}` — collscan.
- `profile/transactions/route.ts:23-25` filters `{discordId}` sort `createdAt` — collscan per profile view.
- `analytics/games/route.ts:46` regex-groups `type` over the whole collection.
- `src/lib/admin/audit.ts:110-118` — `ensureAuditIndexes()` is defined and **never invoked anywhere** (grep: only its definition). Live DB confirms the indexes were never built.
**Fix:** one startup hook (Next `instrumentation.ts`, or a lazy once-per-process block in `src/lib/mongodb.ts`) creating: `lunari_transactions {discordId:1, createdAt:-1}` + `{createdAt:-1}` + `{type:1, createdAt:-1}`; same `{createdAt:-1}`+`{discordId:1}` on cards/stones_transactions; call `ensureAuditIndexes()`; `card_marketplace {status:1, expiresAt:1}`; `points {balance:-1}` (enables #1's index sort).

**3. Live Activity Pulse: 8 queries every 5 seconds per admin, no visibility pause, no shared cache — [CONFIRMED, effort S]**
`src/app/admin/_components/LiveActivityPulse.tsx:83,119` polls `/api/admin/activity/stream` at `pollMs=5000` (mounted on admin home, `src/app/admin/page.tsx:144`); the route (`activity/stream/route.ts:38-51,95-97`) runs 4 unindexed sorted finds + 2 enrichment `$in` queries per poll = **~96 Mongo queries/min per open tab**, plus a 1s `setTick` re-render loop (line 94). No `document.visibilityState` check — backgrounded tabs keep polling.
**Fix:** (a) 5s module-level micro-cache in the route (same pattern as `admin/db.ts:64` overview cache) so N admins share one query set; (b) pause polling on `visibilitychange`; (c) optional `since` param returning `{events: []}` early. Pairs with #2's createdAt indexes.

**4. game-data (public profile API): full card catalog re-read + shipped in every response, bypassing an existing cache — [CONFIRMED, effort S]**
`src/app/api/profile/game-data/route.ts:74` does `cards_config.find({}).limit(500).toArray()` raw on **every** profile view and inlines the entire catalog (name/imageUrl/attack/weight for ~500 cards, ~50KB+) into the JSON — even though `src/lib/cards.ts:13-23` already has a 5-min TTL catalog cache **with admin-write invalidation** (`invalidateCardCatalogCache`). The other 15 parallel reads (lines 62-87) are all `_id` point lookups — those are fine; not an N+1. Secondary: line 69's nemesis suffix regex `` `_${discordId}$` `` can never use an index (62 docs today, harmless, but the pattern is a trap).
**Fix:** replace the raw find with the `lib/cards.ts` cached reader (or move `cardCatalog` to its own route with `Cache-Control: s-maxage=300` and drop it from the per-user payload).

**5. Shared `ttlCache` helper — 10 copy-pasted TTL caches, none dedupe concurrent loads — [CONFIRMED, effort M]**
Ad-hoc TTL caches confirmed in **10** lib files: `lib/cards.ts:13-15`, `lib/faction-war.ts:6-8`, `lib/admin/db.ts:64`, `lib/bank/live-bank-config.ts:36-40`, `lib/bazaar/passport-discount.ts:23-24`, `lib/bazaar/shop-config.ts:23-27`, `lib/bank/discord-roles.ts:15-17`, `lib/admin/footer-defaults.ts:112-114`, `lib/admin/site-tabs.ts:25-27`, `lib/bazaar/vendor-config.ts:31-33`. All hand-roll `{data, expiresAt}`; **none** dedupe in-flight loads (two concurrent requests on expiry both hit Mongo/Discord — thundering herd on the Discord-roles cache is the worst case).
**Spec:** `src/lib/cache/ttl-cache.ts` — `createTtlCache<K,V>({ ttlMs, max? })` returning `{ get(key, loader): Promise<V>, set(key,v), invalidate(key?), clear() }`, with (a) in-flight promise memoization (store the Promise, not just the value), (b) stale-on-error fallback, (c) optional LRU cap for keyed maps (roleCache, passport-discount). Migrate the 10 files mechanically; keep each file's existing `invalidateX()` exports as thin wrappers so the ~15 write-route invalidation call sites don't change.

**6. `/admin/cards` + `/admin/stones` snapshots: full-ownership `$unwind`+`$addToSet` on every page navigation — [CONFIRMED, effort S]**
`src/lib/admin/cards-v2.ts:19-37` (called from `src/app/admin/cards/page.tsx` server render) `$unwind`s every user's card array and `$addToSet`s **owner id arrays per card** (memory ∝ users×cards); `src/lib/admin/stones-v2.ts:12` same pattern; `stones/config/route.ts:97-121` repeats it a third time with a legacy-shape `$cond`. 552/57 docs today = tens of ms, but it's uncached, runs per navigation, and grows with ownership.
**Fix:** wrap both snapshots in the #5 `ttlCache` (30-60s TTL, invalidate from the cards/stones write routes — invalidators already exist for the public caches); and replace `owners: {$addToSet: '$_id'}` + `$size` with `{$sum: 1}` over a pre-`$group` per-user dedup (`$setUnion` on names before unwind) so owner-id sets never materialize.

**7. holders lookups unwind-then-match (backwards) — [CONFIRMED, effort S]**
`src/app/api/admin/v2/cards/holders/route.ts:34-47` (and the stones twin): `$project` → `$unwind` **all** card arrays → `$match {'items.name': name}`. Every drawer open unwinds the entire ownership collection.
**Fix:** prepend `{$match: {$or: [{'cards.name': name}, {'items.name': name}]}}` before the unwind (multikey-indexable: `cards {"cards.name": 1}`), keep the post-unwind match for copy counting. Also replace the `$expr $toUpper` rarity comparison (line 42) with `$in` over the two case variants so it stays index-eligible.

**8. `images.unoptimized: true` + full-resolution R2 art in every grid — [CONFIRMED, effort M]**
`next.config.js:16`. All `next/image` resizing/webp is off, so the admin cards grid (~500 cards), public bazaar, and profile collection grids download original R2 PNGs (full card-template resolution) to render ~150px thumbnails. This is the single biggest public-page bandwidth cost and unaffected by any server work.
**Fix (pick one):** (a) since assets already sit behind Cloudflare (`assets.lunarian.app`), enable Cloudflare Image Resizing and add a `cfImageLoader` (`loader: 'custom'`) — zero Railway CPU, keeps `unoptimized` semantics; or (b) generate a `*_thumb.webp` (256w, sharp) alongside each upload in the admin upload/R2 routes and serve thumbs in grids. Respect the existing `?v=` cache-bust pattern.

**9. Analytics/voice routes read entire collections to enrich ≤20 rows — [CONFIRMED, effort S]**
- `src/app/api/admin/analytics/games/route.ts:52`: `discord_users.find({})` fetches all 1,415 users to label ≤40 ids parsed from 62 nemesis docs (line 51). Replace with `{_id: {$in: idsFromNemesis}}` after parsing.
- `src/app/api/admin/voice/stats/route.ts:17-35`: three `find({})` over `vc_rooms`/`vc_stats`(×2)/`vc_user_stats` per open; `voice/export/route.ts:26,37` same. Add projections+limits or aggregate server-side.
- `src/app/api/admin/analytics/games/route.ts:46`: regex `$group` over all lunari_transactions per page open — fixed by the `{type:1, createdAt:-1}` index in #2 plus a 60s ttlCache (#5) since analytics tolerate staleness.

**10. Shared `admin_read` rate bucket: the 5s pulse silently eats other pages' budget → mystery 429s — [CONFIRMED, effort S]**
`src/lib/bazaar/rate-limit.ts:44-47` keys the sliding window by endpoint **string** + userId, and ~all admin GET routes pass the same literal `'admin_read'` with *different* limits: `users/list/route.ts:38` checks `30/min` while `activity/stream/route.ts:26` pushes `120/min` into the **same timestamps array**. Sitting on the admin home (pulse = 12 req/min) + typing a search (~1 req per 220ms pause) + opening any config page can exceed 30 shared hits/min → users/list starts 429ing even though each route individually looks under-limit. This is an efficiency/UX landmine, not security.
**Fix:** per-route bucket keys (`'admin_read:users_list'` etc.), or a single canonical admin-read limit constant applied uniformly; exempt the micro-cached stream (#3) from the shared bucket.

---

**Not re-verified as problems (checked, fine):** the 16 parallel reads in game-data are all `_id` point lookups (no N+1 besides the catalog, #4); three.js is already dynamic-imported + tree-shaken behind `RuneField.tsx:13` `next/dynamic` with reduced-motion bail-out (`next.config.js:13` optimizePackageImports) — not a bundle problem; `bot_config`/`vendor_config`/`characters` `find({})` reads are small config collections; other admin polls (ops 20s, dm 15s, SystemHealth 20s) are page-scoped and reasonable.

**Suggested execution order:** #2 (indexes, pure win, no code-shape risk) → #10+#3 (tiny diffs, kills 429s + idle load) → #4 → #1 (biggest single-page speedup) → #5 helper then migrate → #6/#7/#9 → #8 (needs an infra decision: Cloudflare resizing vs upload-time thumbs — ask owner).