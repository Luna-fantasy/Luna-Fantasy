All seven areas verified with fresh evidence. Findings below; paths relative to `C:\Users\Admin\Desktop\Luna Bot\Luna-Fantasy-Main\`.

# TOP OPPORTUNITIES — Dashboard Code Health (ranked)

## 1. Silent asset-loss error swallows in bazaar refund/restore paths — **S**, correctness
The three shop purchase routes refund with `creditLunari(...).catch(() => {})` then tell the user "Lunari refunded" even if the refund itself threw — money vanishes with zero trace:
- `src/app/api/bazaar/luckbox/route.ts:169`
- `src/app/api/bazaar/stonebox/route.ts:146`
- `src/app/api/bazaar/tickets/route.ts:96`
- Worse: `src/app/api/swaps/counter/route.ts:142-147` — card restore after failed counter-offer is `try{...}catch{}`; user's card is permanently gone, unlogged.

**Spec**: no new helper needed — replace `.catch(() => {})` with `.catch(err => console.error('[luckbox] REFUND FAILED', { discordId, finalPrice }, err))` (same for the card restore, logging the full card object for manual recovery). Optionally write a failed-op record to `lunari_transactions` with type `refund_failed` so the admin transactions page surfaces it.

## 2. Dead API routes — 18 confirmed zero-caller routes (April audit said ~11; it grew) — **S–M**
Verified by extracting every route path, wildcarding `[params]`, and grepping all non-API src (dynamic constructions like `analytics/${section}`, `server/${action}`, `swaps/${tab}`, valecroft `${baseUrl}/${discordId}` were chased down and excluded as false positives). Zero client fetch sites for:

| Route | Note |
|---|---|
| `api/admin/overview` | admin home imports `getEconomyOverview` directly (`src/app/admin/page.tsx:3`) |
| `api/admin/users/search` | CmdK uses `/api/admin/search` instead (`CmdK.tsx:75`) |
| `api/admin/users/recent`, `users/batch` (POST!) | |
| `api/admin/users/[discordId]/cards` (POST+DELETE), `/stones` (POST+DELETE), `/inventory` (POST+DELETE) | reads go via `peek/[discordId]` (`UserDetailClient.tsx:92`); ModeratorConsole only uses balance/level/tickets/cooldowns/passport/debt/loans (`ModeratorConsole.tsx:318-339`) |
| `api/admin/users/[discordId]/transactions`, `/level-rewards` (GET) | |
| `api/admin/passports/list` | superseded by `v2/passports` (1 client file) |
| `api/admin/audit/actions` | |
| `api/admin/economy/transactions/recent`, `transactions/reverse` (mutation!) | |
| `api/admin/config/oracle/upload` | |
| `api/admin/v2/valecroft/stats`, `v2/valecroft/upload` | uploads go via `v2/r2/upload` (7 client files) |
| `api/admin/vendors/seluna` | already 410-gated behind `ENABLE_LEGACY_SELUNA_ADMIN` (`route.ts:16`) — prime full-delete candidate |
| `api/bank/insurance` (public POST) | bank UI only calls daily/debt/investment/loan/trade — no insurance purchase flow exists |

NOT dead despite looking it: `marketplace/auction/auto-resolve` (external cron via `CRON_SECRET`, `src/app/admin/settings/page.tsx:142`). Dead **mutation** endpoints (`users/batch`, `users/[id]/cards|stones|inventory`, `transactions/reverse`, `bank/insurance`) are live attack surface guarded only by auth — per deprecate pattern, list blast radius and get owner OK, then delete or 410-gate.

## 3. `writeBotConfig` / `writeVendorConfig` chokepoint + data-driven invalidation — **M**
Inline `db.collection('bot_config'|'vendor_config').updateOne` appears in ~18 route files, each hand-rolling upsert + `updatedAt/updatedBy` + cache invalidation. Consequences already visible:
- `config/butler/route.ts:309-314` hardcodes which docIds bust `live-bank-config` (known backlog item).
- `config/jester/route.ts:274` logs `docId: mapping.docId` = `'jester_shops'` for brimor/broker saves that actually write `vendor_config.brimor/broker` (`route.ts:212-236`) — **audit log records the wrong document**.
- Non-vendor jester writes (e.g. `jester_game_settings`) invalidate nothing; only `cards/config` ever calls `invalidateFactionWarCache` (`cards/config/route.ts:112`).

**Spec** — `src/lib/admin/config-write.ts`:
```ts
writeBotConfig(docId, { set?: Record<dotPath, any>, root?: any, adminId }): Promise<{before}>
writeVendorConfig(shopId, { set?, root?, adminId }): Promise<{before}>
```
Each: reads `before` for audit, `$set`s dot-paths (never whole-`data` unless `root`), stamps `updatedAt/updatedBy`, then consults one exported map `DOC_CACHE_INVALIDATORS: Record<docId, (() => void)[]>` (butler_banking/economy/games → live-bank-config; butler_shop → shop-config; vendor_config:* → `invalidateVendorConfigCache(id)`; footer_config → footer; etc.). Returns `{ before, docId, collection }` so `logAdminAction` gets the true docId.
**Adopters**: `config/butler` (PUT :288-314), `config/jester` (PUT :229-268), `banking/config:254`, `economy/config:142/266`, `shops/zoldar:59/105`, `shops/meluna:56/129`, `shops/seluna`, `stones/config:152/184`, `vendors:107`, `challenges/config:117-125`, `challenges/texts:67`, `config/footer:143`, `sage-live-chat/config:380`, `canvas/[bot]:176`, `config/oracle:44/188`, `config/sage:45/139`, `v2/bot-config/[id]:68`, `assets/presign:75`, plus lib mirrors `mells-butler-mirror.ts:43`, `seluna-mells-mirror.ts:78`. The existing `shop-config.ts` save helpers (:209-241, :296, :367) become thin wrappers or move onto it.

## 4. `unwrapStDbData<T>` shared helper — ~25 copy-pasted unwrap sites — **S/M**
The st.db legacy `data`-may-be-JSON-string unwrap is pasted everywhere, in three inconsistent flavors (bare ternary that can throw, try/catch-null, try/catch-default). No shared helper exists (grep confirmed). Profile-specific sites (the "~5 copies" from backlog):
- `src/app/api/bazaar/mells/route.ts:55-56, 297`
- `src/app/api/profile/game-data/route.ts:149, 263-264`
- `src/lib/bazaar/passport-discount.ts:52-54`
- `src/app/api/admin/passports/list/route.ts:57`
- `src/app/api/admin/users/[discordId]/passport/route.ts:96-97, 195-197, 275-277`

Plus the same pattern for levels/stones/cooldowns/cards/inventory/points/config: `src/lib/admin/db.ts:284, 350, 371, 383`, `src/lib/bazaar/lunari-ops.ts:28, 60`, `src/lib/bank/bank-ops.ts:87-89`, `src/lib/faction-war.ts:29`, `src/lib/bazaar/vendor-config.ts:57`, `src/lib/bazaar/shop-config.ts:72, 102, 149, 191`, `src/app/api/admin/cards/config/route.ts` (10 sites: 70, 352, 384, 482, 673, 689, 786, 892, 965...), `src/app/api/admin/users/[discordId]/level/route.ts:63`, `/stones/route.ts:12`, `/inventory/route.ts:15`, `/cards/route.ts:13`.

**Spec** — `src/lib/st-db.ts`:
```ts
export function unwrapStDbData<T>(doc: { data?: unknown } | null | undefined, fallback: T): T
// string → JSON.parse in try/catch → fallback; object → as-is; null/missing → fallback
export function unwrapProfile(doc): ProfileData | null   // thin typed wrapper used by the 5 profile sites
```
Bare-ternary sites (`mells:55`, `faction-war:29`, `cards/config:70`) currently **throw on corrupt JSON** — the helper also fixes that failure mode.

## 5. SECTION_MAP hygiene (config/butler + config/jester) — **S**
- `ALLOWED_SECTIONS` and `SECTION_MAP` are two hand-synced lists in both routes (`config/butler/route.ts:14-31` vs `:34-80`; jester `:13-21` vs `:24-51`). Currently 1:1, but the double-guard at butler `:243` + `:272` proves the drift fear. **Fix**: `const ALLOWED_SECTIONS = new Set(Object.keys(SECTION_MAP))`.
- Jester `shop_brimor`/`shop_broker` map values (`docId: 'jester_shops'`) are dead — PUT special-cases them to `vendor_config` (`:212-219`) and the audit log records the fake docId (`:274`). Fold the real target into the map: `{ collection: 'vendor_config', docId: 'brimor', field: '_root' }` and delete the special case.
- Butler GET (`:91-111`) hand-lists 19 `findOne`s and manually re-maps every section — derivable from `SECTION_MAP` (unique docIds → parallel fetch → invert map). Kills ~100 lines and makes adding a section a one-line change.
- Invalidation should move into opportunity #3's `DOC_CACHE_INVALIDATORS`.

## 6. Snowflake + DOB validation duplication — **S**
`/^\d{17,20}$/` is inlined at 16+ sites — 12 client dialogs (`ReservePanel.tsx:51`, `CreateDialog.tsx:145/148/161`, `DmClient.tsx:86`, `CanvasTestDialog.tsx:85`, `SelunaEditor.tsx:166/188`, `StoneEditDialog.tsx:112`, `ValecroftClient.tsx:865/1140`, `WatchlistClient.tsx:82`) and API routes (`announce:169`, `banking/reserve:108`, `canvas/test-deploy:34`, `webhooks/transactions:19` as `SNOWFLAKE_RE`). DOB regex is duplicated between `PassportDialog.tsx:34` and `passport/route.ts:24`.
**Spec** — `src/lib/validation.ts` (importable from both client and server): `SNOWFLAKE_RE`, `isSnowflake(s)`, `DOB_RE`. Note the passport **number** already uses the right pattern — the route publishes `numberPattern` and the dialog consumes it (`passport/route.ts:130`, `PassportDialog.tsx:90-95`); DOB just never got the same treatment. Shared-constants module is simpler than server-provided patterns for these.

## 7. Shared TTL cache helper — 9 hand-rolled caches (backlog said ~5) — **M**
`src/lib/admin/footer-defaults.ts`, `admin/site-tabs.ts`, `bank/discord-roles.ts`, `bank/live-bank-config.ts`, `bazaar/passport-discount.ts`, `bazaar/shop-config.ts`, `bazaar/vendor-config.ts`, `cards.ts`, `faction-war.ts` — each re-implements `cache`/`cacheTime`/`CACHE_TTL`/`invalidateXCache()`.
**Spec** — `src/lib/ttl-cache.ts`: `createTtlCache<T>(name, ttlMs)` returning `{ get, set, invalidate }` with a registry so invalidators can be looked up by name — this is exactly what opportunity #3's `DOC_CACHE_INVALIDATORS` map wants to reference. Adopt file-by-file; no behavior change.

## 8. Full-delete of 410-gated legacy per deprecate pattern — **S** (owner OK required)
- `src/app/api/admin/vendors/seluna/route.ts` — env-gated 410 since Seluna type-normalization work, zero clients, superseded by `admin/shops/seluna`. Blast radius: none found (grep clean).
- `src/app/api/admin/shops/config/route.ts:275` — the deprecated-writer 410 branch; GET is still live (used by `InfoClient.tsx`), so only the dead PUT branches can go.
- NOT deletable: `src/lib/admin/config-writer.ts` (still imported by `cards/config` + `deploy` routes) and `src/lib/admin/github.ts` (used by `content/save`).

## 9. Benign-looking but wrong `catch {}` at revalidate/site-tabs — **S** (low priority)
`src/app/api/admin/site-tabs/route.ts:71, 76` swallows `revalidatePath` failures — a tab open/close that silently doesn't reach the public site violates the CONNECTED goal; log it. The remaining `catch {}` sites checked (`cooldowns:95`, `debt:34`, `loans:34` body-parse; `shops/seluna:98/113` image-map building; `profile/game-data` parse fallbacks) are acceptable parse-fallbacks — don't churn them.

---
**Suggested order**: #1 (ship today, pure logging), #5 + #6 (small, self-contained), #3 → #7 (#3's invalidation map wants #7's registry, so do #7 first or together), #4 (mechanical), #2 + #8 (needs your explicit delete-approval list per deprecate pattern).