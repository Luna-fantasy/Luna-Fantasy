# Bot-side Changes Required

> **Status:** Sections 1–6 applied to live bots 2026-04-18 (LunaJester c6cc78a, LunaButler 068f391). VPS not pulled yet — bots still run prior code until manual deploy. New section 9 below is pending.
> **Workflow:** Going forward, apply to TEST copies first (`ButlerTEST` / `JesterTEST` / `OracleTEST` / `SageTEST`), verify behavior in the test server, then promote to main production bots.

This document lists every bot-side change the v2 admin dashboard is waiting for. Each section has the minimum code needed, the MongoDB collection / doc it reads, and the feature that will start working once the change is deployed.

---

## 1. Canvas background override (`_backgroundOverride`) — DONE 2026-04-18

**Feature:** Admin uploads a trial background image in `/admin/v2/media` → clicks Save → wants the bot to render with the new background instead of the hardcoded asset URL.

**Affects:** All canvas renders on Butler + Jester (leaderboards, rank card, profile card, level-up card, winner image, book, chest, passport, etc.).

**MongoDB read:** `bot_config.{bot}_canvas_layouts.data.{canvasType}._backgroundOverride` (string URL, optional)

**Change needed (both bots):**

Wherever the bot loads the layout for a canvas type, add the override check before falling back to the hardcoded background URL. Current bot code likely looks like:

```js
// Before
const bg = await loadImage(HARDCODED_BACKGROUND_URL_FOR_THIS_CANVAS);
```

After:

```js
// After — honor admin-uploaded override from bot_config
const layoutDoc = await getCanvasLayout(canvasType); // existing fetch
const bgUrl = layoutDoc?._backgroundOverride || HARDCODED_BACKGROUND_URL;
const bg = await loadImage(bgUrl);
```

Files likely to touch:
- `LunaButlerMain/events/profile_card.ts` (passport, profile card)
- `LunaButlerMain/events/rank.ts` (rank card)
- `LunaButlerMain/events/levelup.ts` (level-up card)
- `LunaButlerMain/events/leaderboard.ts` (Lunari leaderboard, Levels leaderboard)
- `LunaJesterMain/events/winner-image.ts`
- `LunaJesterMain/events/book.ts`
- `LunaJesterMain/events/chest.ts`
- `LunaJesterMain/events/fantasy-leaderboard.ts`

---

**Resolution (2026-04-18):**
- Both bots' `util/canvas/canvas_layout.ts` already exposed `getBackgroundUrl(canvasType, fallbackUrl)` honoring `_backgroundOverride` → `backgroundUrl` → fallback. Most canvas files (leaderboards, level-up, luna21, book, chest, fantasy_leaderboard, winner_image) were already wired.
- Butler `util/canvas/profile_card.ts` already honored the override on the passport variant (line 1021).
- Butler `util/canvas/rank_card.ts` was the only remaining miss — patched 2026-04-18 to consult `live._backgroundOverride` / `live.backgroundUrl` before falling back to the hardcoded gradient (commit `068f391`). User-purchased shop background still takes precedence.

---

## 2. Canvas trial render (`trialBackgroundUrl` in test requests) — DONE (already implemented)

**Feature:** Admin uploads a trial image → clicks "Test render ↗" → bot must render **this render only** with the trial image, without saving anything.

**MongoDB read:** `canvas_test_requests.trialBackgroundUrl` (string URL, optional field on the existing test-request doc)

**Change needed (both bots, wherever they poll/consume `canvas_test_requests`):**

```js
// In the canvas test worker
const testReq = await consumePendingTestRequest(); // existing poll
const layoutDoc = await getCanvasLayout(testReq.canvasType);

// Precedence: trial (per-test) → saved override → hardcoded fallback
const bgUrl = testReq.trialBackgroundUrl
           || layoutDoc?._backgroundOverride
           || HARDCODED_BACKGROUND_URL;

const bg = await loadImage(bgUrl);
// …rest of render logic unchanged
```

**Security notes for the bot:**
- Validate the URL is from `https://assets.lunarian.app/` before loading (prevent SSRF / arbitrary URL fetching)
- Use the existing timeout / error handling; if the trial URL fails to load, render without it rather than blowing up the request

---

**Resolution (2026-04-18):** Both bots' `test_render.ts` already polls `canvas_test_requests`, validates the URL host against `ALLOWED_TRIAL_HOST`, and calls `setTrialBackground(url)` from `canvas_layout.ts`. Verified — no further work.

---

## 3. Consistent transaction `type` naming (for v2 dashboard observation) — DONE 2026-04-18 (Butler) / mostly done (Jester)

**Feature:** The v2 user profile page shows semantic categories of Lunari activity (Games / Gifts / Trades / Bank & Loans / Investments / Shop / Daily / Heists / Cards & Stones / Admin). Categorization is based on the `type` field in `lunari_transactions`.

**Context:** Amounts in `lunari_transactions` are **positive magnitudes**; the `type` field indicates direction. The dashboard groups types with regex on suffixes / prefixes:

| Category | Type pattern |
|---|---|
| Games | `_win` / `_loss` suffix, or prefix `trivia_` `fantasy_` `roulette_` `mafia_` `rps_` `mines_` `duel_` `bomb_` `magic_`, or `game_win` / `game_loss` / `challenge_reward` / `faction_war` |
| Gifts | `gift_received`, `gift_sent`, `transfer_in`, `transfer_out` |
| Trades | `trade_*` |
| Bank & Loans | `bank_*`, `loan_taken`, `loan_repaid` |
| Investments | `investment_*` |
| Shop | `*_purchase`, `shop_*`, `store_*`, `mells_purchase` |
| Daily | `daily_*`, `passport_bonus`, `vip_bonus` |
| Admin | `admin_credit`, `admin_debit` |
| Heists | `steal_*` |
| Cards/Stones | `card_*`, `stone_*`, `luckbox` |

**Change needed:** When bots insert transactions into `lunari_transactions`, prefer consistent type names that fit these patterns. Specifically:

- **Game results** should use `<game>_win` / `<game>_loss` (e.g. `roulette_win`, `mafia_loss`) instead of generic `lunari_added` / `lunari_spent`
- **Gifts** should use `gift_sent` (payer) + `gift_received` (recipient) as two separate transaction records
- **Shop purchases** should use `shop_purchase` or a specific `<vendor>_purchase` (e.g. `mells_purchase`)
- **Bank operations** should be prefixed `bank_` (e.g. `bank_loan_taken`, `bank_interest`, `bank_daily`)
- **Investments** should be prefixed `investment_` (e.g. `investment_buy`, `investment_payout`)

**Impact if not applied:** Transactions still appear in the "Other" category — the dashboard doesn't break, but the rich category breakdown is less informative. Existing transactions in production are grandfathered (they still show up under whichever suffix/prefix they already have).

Files likely to touch:
- `LunaButlerMain/util/helpers/webhook_sync.ts` (transaction logger)
- `LunaJesterMain/util/helpers/webhook_sync.ts` (same)
- Any code path that calls `pointsManager.credit()` / `debit()` — audit the `type` string passed

**No schema migration needed** — just label new transactions going forward with more specific types.

---

**Resolution (2026-04-18):**
- Most game/shop transactions in both bots already used semantic typeOverrides (e.g. `roulette_win`, `card_purchase`, `gift_sent`).
- 11 untyped Butler call-sites patched 2026-04-18 (`068f391`) — daily_reward, salary_monthly, investment_payout (×2), investment_buy, passport_refund (×3), baloot_win, steal_win, steal_loss.
- Jester trading-side refunds and a few card-trade auction completions still use generic types (`lunari_added`/`lunari_spent`). Acceptable for now per the doc's "grandfathered to Other category" note. Future polish: type the cards_trade.ts auction wins/sales as `card_trade_*` if richer breakdown becomes valuable.

---

## 4. Oracle music library from `bot_config.oracle_vc_music` — DONE (already implemented)

**Feature:** Admin uploads MP3 files via `/admin/v2/voice` → Music tab → Oracle plays them in voice rooms.

**MongoDB read:** `bot_config.oracle_vc_music.data = { enabled: boolean, tracks: MusicTrack[] }`

```ts
interface MusicTrack {
  key: string;          // R2 key: "oracle-music/1234567890-song.mp3"
  url: string;          // "https://assets.lunarian.app/oracle-music/..."
  title: string;        // admin-editable display title
  sizeBytes?: number;
  contentType?: string; // "audio/mpeg" / "audio/wav" / "audio/ogg" / ...
  uploadedAt: string;   // ISO timestamp
}
```

**Change needed (`LunaOracle/util/managers/music_manager.ts`):**

Replace the local filesystem scan (`readdir` on `Music/`) with a hybrid approach:

```js
// Keep local Music/ files for fallback, but also load from bot_config
async function loadSongs() {
  const localSongs = await scanLocalMusicFolder(); // existing logic
  const cfg = await getBotConfig('oracle_vc_music'); // 30s TTL cache
  if (!cfg?.enabled || !Array.isArray(cfg.tracks)) return localSongs;

  // Each R2 track becomes a virtual song entry playable via @discordjs/voice HTTP stream
  const remoteSongs = cfg.tracks.map(t => ({
    title: t.title,
    url: t.url,               // Stream directly from R2 CDN — no download needed
    durationSec: null,        // Unknown until ffprobe runs on first play (cache result)
    source: 'r2',
    key: t.key,
  }));

  // De-dupe by title (local takes precedence if both exist)
  const localTitles = new Set(localSongs.map(s => s.title));
  return [...localSongs, ...remoteSongs.filter(r => !localTitles.has(r.title))];
}
```

**Streaming from R2:** `@discordjs/voice` accepts a URL in `createAudioResource()`. Pass `track.url` directly — Cloudflare R2 public URLs support HTTP range requests so streaming works without pre-download.

**Security:** Validate URL host is `assets.lunarian.app` (or your R2_PUBLIC_URL) before streaming to avoid SSRF.

**Cache behavior:** Refresh `bot_config.oracle_vc_music` at the existing bot-config TTL (30s). New uploads appear in Oracle's song list within 30s without restart.

---

**Resolution (2026-04-18):** `LunaOracle/util/managers/music_manager.ts` lines 43-72 already implements:
- Read `bot_config.oracle_vc_music` doc
- Validate URL host against `R2_ALLOWED_HOST` (SSRF guard)
- Map tracks to `Song[]` with `source: 'r2'`
- De-dupe by name (local songs win)
- Refresh every 60s + initial 5s
- Player calls `createAudioResource(song.path)` — works for both local file paths and R2 URLs (line 451)

No additional work needed.

---

## 5. Jester per-game flavor text (dashboard-driven) — DONE 2026-04-18

**Status:** Dashboard shipped 2026-04-17. Bot side pending.

**Feature:** Admin edits each Jester lobby game's flavor-text pool (or pins one fixed line) from `/admin/v2/games`. Replaces the hardcoded `JESTER_FLAVOR[]` array in `start_game.ts:16-27`.

**Dashboard schema (per Jester lobby game: roulette, mafia, rps, bombroulette, mines):**

- `bot_config.jester_game_settings.data.<game>.flavor_pool` — **string**, one flavor per line (newline-separated). Empty = fall back to hardcoded `JESTER_FLAVOR`.
- `bot_config.jester_game_settings.data.<game>.flavor_pinned` — **string**, if set & non-empty, always use this exact text instead of rotating the pool.

**Seed applied:** 2026-04-17 — all 5 lobby games seeded with the existing `JESTER_FLAVOR` strings (including `<a:Animated_JesterL:1435345549120503919>` emoji markup) so behavior matches what players already see.

**Change needed in `LunaJesterMain/util/helpers/start_game.ts`:**

Replace the current random pick against the hardcoded array:

```ts
// Before (line ~99)
const flavor = JESTER_FLAVOR[Math.floor(Math.random() * JESTER_FLAVOR.length)];
```

With a DB-aware pick that respects the pinned/pool precedence:

```ts
// After
function pickFlavor(cfg: any): string {
  const pinned = typeof cfg?.flavor_pinned === 'string' ? cfg.flavor_pinned.trim() : '';
  if (pinned) return pinned;

  const raw = cfg?.flavor_pool;
  const pool = Array.isArray(raw)
    ? raw.filter((s: any) => typeof s === 'string' && s.trim())
    : typeof raw === 'string'
      ? raw.split('\n').map((s) => s.trim()).filter(Boolean)
      : [];

  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return JESTER_FLAVOR[Math.floor(Math.random() * JESTER_FLAVOR.length)]; // fallback
}

// At call-site:
const flavor = pickFlavor(gameSettngs);
gameData._flavor = flavor;
```

`gameSettngs` is already the per-game object from `getGameSettings()`, so it carries `flavor_pool` / `flavor_pinned` if set by the dashboard.

**Backwards-compat:** If both DB fields are absent, the function falls back to the existing hardcoded `JESTER_FLAVOR`. Deploying the bot code before any dashboard edits still renders flavor text. No migration needed.

**Dashboard UI:** Already shipped. `Flavor` section on each lobby game has two textarea fields: "Flavor text pool" (one per line) and "Pinned flavor text" (overrides rotation when non-empty).

**Games with flavor editor wired:** roulette, mafia, rps, bombroulette, mines. `guessthecountry` has a different lobby flow and is NOT included. PvP card games (LunaFantasy / LunaFantasyEvent / GrandFantasy / FactionWar) also excluded.

---

**Resolution (2026-04-18):** `LunaJesterMain/util/helpers/start_game.ts` (commit `c6cc78a`) now contains a `pickFlavor(cfg)` helper that resolves: pinned text > admin pool (string newline-separated or array) > hardcoded `JESTER_FLAVOR`. Backwards-compatible — when neither field is set on a game, behaves exactly as before.

---

## 6. Remove unused `circleImageURL` from Jester roulette config — DONE 2026-04-18

**Status:** Dashboard field removed 2026-04-17. Mongo `data.roulette.circleImageURL` also unset. R2 asset `games/roulette_circle.png` deleted.

**Context:** The field was declared in `LunaJesterMain/types/config.ts:221` as `circleImageURL: string;` and set in `LunaJesterMain/config.ts:1432`, but **never read** by `roulette.ts` or `util/canvas/image_worker*` — `generateRouletteGif(sectors, winnerIndex)` builds the wheel from sector data, not a static image URL. Direct grep (2026-04-17) confirmed zero consumers.

**Change needed in `LunaJesterMain`:**

1. Remove the required field from the type:
   ```ts
   // types/config.ts — before
   circleImageURL: string;
   // after: delete the line
   ```
2. Remove from the lobby-game interface:
   ```ts
   // util/helpers/game_config.ts:15 — before
   roulette: { enabled: boolean; name: string; description: string; imageURL: string; circleImageURL?: string; waiting_time: number; ... };
   // after: drop circleImageURL?: string;
   ```
3. Remove from the static `config.ts`:
   ```ts
   // config.ts:1432 — delete the whole line
   "circleImageURL": "https://assets.lunarian.app/games/roulette_circle.png",
   ```

**Backwards-compat:** None needed. The field was already unused by the code path; no renderer referenced it.

**TEST-first:** apply to `JesterTEST` first, restart, spin a roulette lobby, confirm nothing broke → promote to main.

---

**Resolution (2026-04-18):** Removed `circleImageURL` from `LunaJesterMain` (commit `c6cc78a`):
- `types/config.ts` — `RouletteSettings` interface no longer declares the field
- `config.ts` — dropped the `"circleImageURL"` line from the roulette config block
- `util/helpers/game_config.ts` — dropped `circleImageURL?: string` from the inline type

---

## 7. Canvas element layouts (already consumed — for reference only)

**Feature:** Element positions (x, y, fontSize, radiusX/Y) saved via `/admin/v2/media` → bot must read them.

**MongoDB read:** `bot_config.{bot}_canvas_layouts.data.{canvasType}` (nested object, e.g. `layout.top3[1].avatar = { x, y, radiusX, radiusY }`)

**Expected:** Already implemented on the bots as this pre-dates the v2 dashboard. The v2 editor writes to the same nested shape — verify by inspecting the shape of `bot_config.butler_canvas_layouts.data.leaderboard_lunari` in production.

---

## 9. Multi-bot DM dispatch (Jester / Sage / Oracle pollers) — PENDING 2026-04-18

**Status:** Website side updated 2026-04-18 — `/admin/v2/dm` now lets the admin pick which bot identity sends the DM (Butler / Jester / Sage / Oracle). API writes the chosen `bot` field onto each `pending_dms` doc. Until the other bots add a poller, only Butler delivers (existing `util/helpers/dm_poller.ts`).

**Feature:** Admin picks "Send as Jester" / "Send as Sage" / "Send as Oracle" in the dashboard so the recipient sees the DM from that bot's identity, not always Butler.

**MongoDB read:** `pending_dms` docs now include a `bot` field: `'butler' | 'jester' | 'sage' | 'oracle'`. Docs without the field (legacy) default to Butler.

**Change needed (each non-Butler bot):**

Copy the existing Butler poller (`LunaButlerMain/util/helpers/dm_poller.ts`) and adjust the claim filter:

```ts
// Butler — existing, unchanged
const doc = await col.findOneAndUpdate(
    { status: 'pending', $or: [{ bot: 'butler' }, { bot: { $exists: false } }] },
    { $set: { status: 'processing', processingAt: new Date() } },
    { returnDocument: 'after' }
);

// Jester / Sage / Oracle — new
const doc = await col.findOneAndUpdate(
    { status: 'pending', bot: 'jester' /* or sage / oracle */ },
    { $set: { status: 'processing', processingAt: new Date() } },
    { returnDocument: 'after' }
);
```

Then call `startDmPolling(bot)` from each bot's `index.ts` (after MongoDB connection is ready). Same 30s interval, same atomic claim, same error/sent state machine.

**Files to add:**
- `LunaJesterMain/util/helpers/dm_poller.ts` (TypeScript, mirror Butler's)
- `LunaJesterMain/index.ts` — call `startDmPolling(bot)` once
- `LunaOracle/util/helpers/dm_poller.ts` (TypeScript)
- `LunaOracle/index.ts` — call `startDmPolling(bot)`
- `Luna Sage/util/dm_poller.js` (JavaScript ESM — Sage doesn't use TypeScript)
- `Luna Sage/index.js` — call `startDmPolling(client)` (Sage uses discord.js, not Eris — adjust the `getRESTUser` / `getDMChannel` calls accordingly)

**Sage's discord.js port:**
```js
// Sage uses discord.js v14 — adapt these methods:
const user = await client.users.fetch(targetId);
const dm = await user.createDM();
await dm.send({ content: ... }) // or { embeds: [...] }
```

**Backwards-compat:** Existing Butler poller updated to claim docs where `bot === 'butler'` OR field is absent — protects in-flight DMs from before the bot field existed.

**Also update Butler:**
```ts
// Change Butler's poller filter from { status: 'pending' } to:
{ status: 'pending', $or: [{ bot: 'butler' }, { bot: { $exists: false } }] }
```

---

## 11. Orphaned Butler config docs (audit 2026-04-18) — PENDING

Audit of all `bot_config` writes vs bot reads found two configs that the dashboard writes but Butler never reads. Either the bot needs to start consuming them, or the dashboard surface should be removed.

**`bot_config._id: 'butler_leaderboard'`**
- Written by: `/api/admin/config/butler` (key `leaderboard_config`)
- Read by: nothing in `LunaButlerMain/`
- Likely intent: configure leaderboard cosmetics (which channel, how often, what to show)
- Action: either (a) wire `LunaButlerMain/util/canvas/leaderboard_card.ts` and the leaderboard scheduler to read this doc, or (b) remove the `leaderboard_config` mapping from the dashboard writer and any UI section that edits it

**`bot_config._id: 'butler_badges_visuals'`**
- Written by: `/api/admin/config/butler` (key `badges_visuals`)
- Read by: nothing in `LunaButlerMain/`
- Likely intent: customize badge tone colors / glyphs from the dashboard instead of hardcoded `BADGE_TONES` map
- Action: either (a) wire `LunaButlerMain/util/managers/badge_manager.ts` (or wherever badges render) to merge live overrides into the hardcoded defaults, or (b) remove the `badges_visuals` mapping if the feature is shelved

**Triage call needed before bot work** — first decide whether each is "real feature, just unfinished bot side" or "dead UI, drop it". Dashboard removal is faster than bot wiring.

---

## 10. Future: per-user cached "recent activity" for Staff Inbox

**Not yet requested** — leaving as a placeholder. If / when Staff Inbox needs to show "this user's last 10 transactions" quickly, the bots could maintain a capped array on the `discord_users` doc (size ≤ 20, FIFO) to avoid a `lunari_transactions` scan per inbox open.

---

## Note: Multi-bot announce — NO bot work needed

The dashboard `/admin/v2/announce` was extended 2026-04-18 to let admins pick which bot's identity posts the announcement (Butler / Jester / Sage / Oracle). **Implementation is purely website-side** — the API uses each bot's token via env vars (`BUTLER_BOT_TOKEN`, `JESTER_BOT_TOKEN`, `SAGE_BOT_TOKEN`, `ORACLE_BOT_TOKEN`) and posts to Discord REST directly. No bot polling, no MongoDB queue, no bot code changes needed.

**Required env vars (Railway):** Add `BUTLER_BOT_TOKEN`, `JESTER_BOT_TOKEN`, `SAGE_BOT_TOKEN` to Railway env (Oracle's already configured). Each bot's announce capability becomes available the moment its token is present.

Oracle keeps its existing `!announce` Discord command — staff can still announce from Discord chat. Other bots are dashboard-only.

---

## Verification plan

For each change above:

1. Apply to TEST copy first.
2. Restart the TEST bot (PM2 or local `pnpm run dev` depending on env).
3. Trigger the relevant flow from the v2 dashboard:
   - **Canvas override:** upload a trial image on `/admin/v2/media`, click Save, trigger a leaderboard command — the new background should appear.
   - **Trial render:** upload a trial, click "Test render ↗", paste a channel ID — the bot should post the render with the trial bg without saving anything to DB.
   - **Transaction types:** perform a game / gift / trade / shop purchase in TEST Discord, open `/admin/v2/users/<id>` — the action should appear under the right category in the Lunari observation.
4. Verify `admin_audit_log` has no errors / bot errors in PM2 logs.
5. Promote to main bot.
