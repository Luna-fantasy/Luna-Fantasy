# Dashboard Health Audit — 2026-07-03

Fresh sweep of the admin dashboard: 35 admin pages, 117 admin API routes (165 total).
Scope: route/fetch cross-check, config pipelines, security chain, known-fragile areas.

## Fixed in this batch (2026-07-03)

| Area | Fix |
|------|-----|
| Seluna shop save | `shops/seluna/route.ts` — legacy capitalized item types (`"Card"`, `"Stone"`, …) written by the old `vendors/seluna` route failed the lowercase-only validator, 400-ing **every** save. Cleaner + validator now normalize to lowercase; the first save migrates the stored doc. Background-permanence guard also fixed (sanitized-id + case comparison). |
| Legacy Seluna route | `vendors/seluna/route.ts` — disabled with 410 (env-gated `ENABLE_LEGACY_SELUNA_ADMIN=1` to re-enable). This route produced the poisoned data. |
| Stonebox refund key drift | `lib/bazaar/shop-config.ts` read `refundAmount` (camelCase) while the live writers (meluna, stones/config) write `refund_amount` (snake_case) — dashboard refund config **never reached the bazaar**. Reader now prefers snake_case with camelCase fallback. `types/bazaar.ts` updated to match. |
| Dead shops/config writers | `shops/config/route.ts` — luckbox/stonebox/tickets/mells PUT branches had zero callers and wrote the conflicting camelCase keys / 0-100 weight bounds. Now 410-gated (`ENABLE_LEGACY_SHOP_CONFIG_WRITES=1` to re-enable). lunamap branch stays live (used by InfoClient). |
| Stone weight bounds | `stones/config/route.ts` — add_stone was unbounded above, update_stone had **no** weight validation. Both now enforce 0–1000, matching the meluna route and Jester's `weight * 1000` entry math. |
| camelCase shadowing hardening | `shops/meluna/route.ts` — deletes any stale `refundAmount` key on save; Jester reads camelCase *first*, so a stale key would silently shadow every future `refund_amount` save. |

Also fixed (bot side, LunaButlerMain): Luna21 bet escrow — see `LunaButlerMain/docs/progress.md`.

## Verified clean

- **Security chain**: all 72 mutating handlers (POST/PUT/PATCH/DELETE) under `api/admin` call `requireMastermindApi()` **and** `validateCsrf()`; rate limit + audit log present on sampled mutations. No missing-auth route found.
- **Route ↔ fetch cross-check**: ~90 distinct `/api/admin/*` fetch targets in admin pages all resolve to existing routes with matching methods. No 404-class mismatches (unlike the 2026-04-20 audit).
- The 2026-07-02 audit's findings (portal scoping for CmdK/PendingActionPill/PlayerPeek, `safeFetchJson` adoption, mirror dot-path `$set`s, Topbar fetch race) are confirmed landed in commits `30877b7` + `b0554a6`.

## Fixed in the polish batch (2026-07-03, second batch)

- **Cache invalidation wired everywhere**: card catalog (`lib/cards.ts` — was frozen until redeploy, now 5-min TTL + invalidator), `vendor-config.ts` + `live-bank-config.ts` gained invalidators, and all 9 admin write routes now bust the matching caches on save. "Saved but nothing changed" is gone; public bazaar reflects saves immediately.
- **Portal conversion complete**: all 21 remaining components converted to `getAdminPortalTarget()`; zero `document.body` portals remain under `app/admin`. Undo drawer z-index raised 210/211 → 500/501 per the documented scale.
- **HTTP standardization**: 21 files migrated to `adminGet/adminPost/adminPut/adminDelete`; ~15 duplicate `fetchCsrf` helpers deleted (saves are now one round-trip); `adminFetch` gained a one-shot CSRF-refresh retry on 403. Only intentional raw fetch left: `AssetsPanel.uploadFile` (FormData), ok-check-first.
- **Vendors PUT clobber fixed**: dot-path `$set` per field; `saveMoonStones` step 3 likewise (stones-page saves no longer wipe Meluna's title/image).
- **PendingActionProvider data-loss fix**: queuing a second save inside the undo window now commits the first instead of silently cancelling it (was most-recent-wins).
- **Announce**: missing jester/sage token now returns 503 with the env-var name (was generic 500). Env vars themselves still pending on Railway — see below.
- **Dashboard home**: `getEconomyOverview()` micro-cached (20s) — stops re-running 6 aggregations per visit.
- **Dead `ticket_shop_settings` mapping removed** from `config/jester/route.ts`.

## Open findings (not fixed — future work, roughly by priority)

1. **MED — Railway env vars.** `NEXTAUTH_URL`, `DISCORD_GUILD_ID`, `NEXT_PUBLIC_GUILD_ID` and the 7 pending env vars (`R2_*`, `ORACLE_BOT_TOKEN`, `TRANSACTION_WEBHOOK_KEY`, `JESTER_BOT_TOKEN`/`SAGE_BOT_TOKEN` for announce) still need confirming/entering in the Railway dashboard — user action.
2. **MED — Users list query weight.** `api/admin/users/list/route.ts:103-138` runs 5 `$lookup`+`$unwind` over the whole `points` collection before `$match`/`$facet` on every debounced search keystroke. Restructure to filter/sort/paginate on `points` first, then `$lookup` only the page.
3. **LOW — Meluna identity confusion.** `shops/meluna/route.ts` reads/writes `vendor_config._id='stonebox'`; there is no `_id='meluna'` doc. Works, but the dual identity is a trap for future schema work — document or rename deliberately.
4. **LOW — R2 presign version bump race.** `assets/presign/route.ts:73-85` — `asset_versions` bump is read-modify-write; concurrent bulk uploads can lose version stamps → stale Discord image-proxy cache for some keys.
5. **LOW — Seluna admin_queue overwrite.** Single overwritten doc polled every 30s by Jester — two admin actions inside one poll window drop the earlier one. Fix needs both sides (array queue + bot consumer).
6. **LOW — Heavy snapshots.** `lib/admin/cards-v2.ts` / `stones-v2.ts` `$unwind` entire ownership collections on every page open; fine today, add short TTL caches as collections grow. Unpaginated `find({}).toArray()` in characters/vendors/cards-config routes — same story.
7. **INFO — Error swallowing.** 13 `catch(() => ({}))` / empty-catch sites across `app/admin` + `lib/admin`. Mostly the intentional "parse error body defensively" pattern, but worth a spot pass when touching those dialogs.
8. **INFO — Next 14 params inconsistency.** 25 dynamic routes use `params: Promise<...>`, 4 use plain `params: {...}`. Both valid on 14.2 — cosmetic, but unify before any Next 15 upgrade (Promise form becomes mandatory).
9. **INFO — Z-index consolidation.** Two coexisting scales (`--av-z-*` tokens vs hardcoded 300/420 values) resolve sanely post-portal-conversion, but a future pass should retire the hardcoded values.
