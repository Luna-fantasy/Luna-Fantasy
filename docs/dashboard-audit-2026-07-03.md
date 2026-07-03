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

## Open findings (not fixed — future work, roughly by priority)

1. **MED — Portal CSS scoping incomplete.** The `portal-root.ts` fix was applied to only 3 of ~24 portal components. **21 components still `createPortal(..., document.body)`** and escape `.admin-v2-shell`, losing every `--av-` token + font: `CardEditDialog`, `StoneEditDialog`, `VendorItemDialog`, `LunaMapButtonDialog`, `PartnerDialog`, `CanvasTestDialog`, `AssetPreviewDialog`, `ModeratorConsole`, `BulkBalanceDialog`, `BulkMessageDialog`, `RolePicker`, `ChannelPicker` (`:158`), `ThemePicker` (`:280`), `UndoDrawer` (`:53,108`), `Shortcuts` (`:132`), `ContextMenu`, `Toast`, `Tooltip`, + more. Mechanical conversion to the existing `portal-root.ts` helper.
2. **MED — Generic vendor PUT clobber risk.** `api/admin/vendors/route.ts:134` still does whole-doc `$set: { data: finalData }`. A concurrent bot write to any `vendor_config` field is lost on save. Same defect class as the already-fixed mells/seluna mirrors — apply the surgical dot-path pattern. (Note: `shops/meluna/route.ts` also whole-doc replaces, though it spreads `beforeData` first, so the window is smaller.)
3. **MED — Announce route env fallback.** `api/admin/announce/route.ts:24-25` — `getBotToken('jester'|'sage')` returns null with no fallback (only Butler falls back to `DISCORD_BOT_TOKEN`). If `JESTER_BOT_TOKEN`/`SAGE_BOT_TOKEN` aren't set on Railway, announce 500s. Related: `NEXTAUTH_URL`, `DISCORD_GUILD_ID`, `NEXT_PUBLIC_GUILD_ID` and the 7 pending env vars (`R2_*`, `ORACLE_BOT_TOKEN`, `TRANSACTION_WEBHOOK_KEY`) still need confirming in the Railway dashboard.
4. **LOW — Meluna identity confusion.** `shops/meluna/route.ts` reads/writes `vendor_config._id='stonebox'`; there is no `_id='meluna'` doc. Works, but the dual identity is a trap for future schema work — document or rename deliberately.
5. **LOW — R2 presign version bump race.** `assets/presign/route.ts:73-85` — `asset_versions` bump is read-modify-write; concurrent bulk uploads can lose version stamps → stale Discord image-proxy cache for some keys.
6. **LOW — Placeholder role ID.** `lib/admin/ranks.ts:60` — `LA_LUNA_ROLE_ID = 'XXXXXXXXXXXXXXXXXX'` stub; confirm nothing reads it before badge work.
7. **INFO — Error swallowing.** 13 `catch(() => ({}))` / empty-catch sites across `app/admin` + `lib/admin`. Mostly the intentional "parse error body defensively" pattern, but worth a spot pass when touching those dialogs.
8. **INFO — Next 14 params inconsistency.** 25 dynamic routes use `params: Promise<...>`, 4 use plain `params: {...}`. Both valid on 14.2 — cosmetic, but unify before any Next 15 upgrade (Promise form becomes mandatory).
