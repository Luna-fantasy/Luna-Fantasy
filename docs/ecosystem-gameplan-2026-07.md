# Luna Ecosystem — Strategic Gameplan

> Synthesized from 6 area reviews (evidence with exact file:line lists lives in docs/reviews-2026-07/). Each phase is one focused session. Phases 1+2 executed 2026-07-09.
**Ranking rule applied:** (user-visible impact × risk) ÷ effort — money integrity → simplicity → efficiency → code health → ops hygiene. Each phase is one focused session, ordered so earlier phases de-risk later ones.

---

## The One Root Cause Worth Naming First

Five separate findings across Jester, Butler, and the dashboard are the **same bug class**: *non-atomic check-then-deduct on shared money state*. Butler just gained the cure — `deductIfSufficient` (`LunaButlerMain/util/managers/points.ts:180–224`, atomic `$gte`-guarded `findOneAndUpdate` with legacy-string migration). The single root fix is: **make that primitive the only way money leaves an account, in both bots.** Phases 2–4 are that fix applied everywhere.

A second cross-area root cause: *whole-document read-modify-write handoffs* (Seluna stock/caps, Seluna `admin_queue`, Oracle `pendingActions`, Butler bank reserve). Single fix: **per-field atomic Mongo operators (`$inc`/`$pull` with guards), never read→mutate→overwrite the doc.** Phase 4 closes the whole class.

---

## PHASE 1 — Make the pipeline trustworthy (do this before touching money code)

**Goal:** Every fix that follows can be tested in TEST and verified after deploy — right now neither is true.

| Item | Evidence |
|---|---|
| TEST copies are months stale (missing the July escrow work; JesterTEST differs in ~45 files) and not git repos, so "TEST first, promote to main" would silently **revert** the escrow fixes | `TEST/ButlerTEST/.sync_backup_20260418`; diff vs prod HEAD 2026-07-04 (Butler) / 2026-07-02 (Jester) |
| Deploy history records `status:'ok'` when the agent has only *started* — build failures permanently show as successes | `src/app/api/admin/deploy/route.ts:48,78–86`; agent replies `{status:'started'}` at `luna-agent/index.js:244` before running steps; its Verify step result (index.js:296–304) never reaches the record |

**Fix:** Convert TEST dirs to git clones of the prod remotes (test `.env` untracked); have `/api/admin/deploy/status` upsert the agent's terminal status/steps into `admin_deploys`.
**You will see:** TEST bots run current code; the Deploy page history shows real red/green instead of always-green.
**Effort:** S (half session).

---

## PHASE 2 — Jester atomic money core (biggest open exploit surface)

**Goal:** No Jester spend path can go negative, double-pay, or double-grant.

Butler's exploit class was closed last week; **Jester never received any of it**. Every deduct is an unconditional `$inc` behind a cached balance check.

| Item | Evidence | Effort |
|---|---|---|
| Port `deductIfSufficient` + `removeTicketsIfSufficient`; route ALL spend paths through it | `LunaJesterMain/util/managers/points.ts:160–164`, `tickets.ts:63–68` (no `$gte` filter, no floor) | M |
| Trade/gift gates read the 3-min **cached** balance — Butler writes the same `points` doc | `cards_trade.ts:1543`, `stones_trade.ts:1543`, `gift.ts:210`; cache at `cache_manager.ts:128`. Fix falls out of the atomic deduct (the deduct IS the check) | folds in |
| `shop.ts` buy has no `activePurchases` lock (every other shop has one) | `commands/shops/shop.ts:213–245` | S |
| Meluna **sell-duplicates** double-click pays 2× for the same stones (money printing) | `meluna_vendor.ts:519–567` — no lock; `stones.ts:120–135` read-filter-write. Pay strictly on rows actually removed | S |
| Gift transfer has no rollback — giver's Lunari destroyed if credit throws | `gift.ts:210–219`; copy the trade handlers' catch-refund pattern | S |
| **Delete** the dead batch-writer points queue (zero callers; its retry would double-apply `$inc`) | `util/infra/batch_writer.ts:114–129`; only `setPointsManager`/`shutdown` are called (`index.ts:519,1872`). Docs claim it's live — it isn't | S |
| Dashboard side of the same theme: refund failures swallowed with `"Lunari refunded"` shown anyway, and card restore after failed counter-offer silently loses the card | `api/bazaar/luckbox/route.ts:169`, `stonebox:146`, `tickets:96` (`creditLunari(...).catch(()=>{})`); `api/swaps/counter/route.ts:142–147`. Log with full context + optional `refund_failed` tx record | S |

**You will see:** double-clicking any buy/sell/gift/trade button does nothing extra; balances can no longer go negative; failed refunds appear in the transactions feed instead of vanishing.
**Effort:** M (one full session; the pattern already exists in Butler to copy).

---

## PHASE 3 — Butler money remainder (banking is the worst offender)

**Goal:** Close the exact same double-click/mint class in every Butler path the escrow work didn't reach.

| Item | Evidence | Effort |
|---|---|---|
| Banking buttons: withdraw pays 125–130% **twice**, loan-sign double-fires, daily/salary double-claims, all repayments unconditional | `commands/banker_commands.ts` — withdraw 1567–1599, loan sign 1332–1380, daily 977–1019, salary 1084–1102, insurance 1486–1521, deposits/repayments 2503–2528, 1751–2096. Only `trade` is locked (1398–1478). Convert to atomic claims — the pattern already exists in-repo (`tryClaimLeaderboardUpdate`, `points.ts:343`) | M |
| `/give` mints money: 10s-stale check + unconditional remove, attacker controls both sides | `lunari_commands.ts:518–526` → swap to `deductIfSufficient` | S |
| Steal drives the *target* negative | `steal_commands.ts:123–143`; lock only guards the thief | S |
| `checkOverdueLoans` destroys or mints via stale read + `setPoints(0)` — runs hourly on every loan holder | `points.ts:518–650` (lines 541, 573) | M |
| Shop/Valecroft check-then-remove race + **phantom 3rd arg silently dropped** (`removePoints` takes 2 args; untyped `bot` hid it) | `shop.ts:326–357`, `valecroft_commands.ts:1204–1284`, `home_commands.ts:579`, `edit_home_commands.ts:135`; `points.ts:145`. Type `bot.pointsManager` so this becomes a compile error | M |
| interactionLock: 3s self-expiry + no ownership token + cooldowns set at the END defeat the only guard hunt/steal have | `performance_manager.ts:11`; `hunt_commands.ts:107`, `steal_commands.ts:144`. Per-action timeout, token unlock, cooldown-before-payout | S |
| Bank reserve lossy read-modify-write (drifting public panel) | `points.ts:377–383` → migrate `luna_bank_reserve` to numeric `$inc` | S |

**You will see:** bank buttons become double-click-proof; `/give` abuse impossible; the public bank panel stops drifting.
**Effort:** M–L (one focused session; split banking vs the rest if it runs long).

---

## PHASE 4 — Escrow + the lost-update class (one root fix, four symptoms)

**Goal:** Funds are held when promised, and no admin action or stock unit is ever silently dropped.

| Item | Evidence | Effort |
|---|---|---|
| Jester auctions have **no bid escrow** — bidder can snipe with money they don't hold; settle silently voids | `cards_trade.ts:1755–1784` (bid never reserves), settle at 1056–1102, 1382–1436, 1914–1925. Escrow on bid, refund-on-outbid, settle from the hold — the auction analogue of Butler's game escrow | M |
| Seluna stock + per-user caps: two users racing the last unit both get it; cap bypass on rare stock | `seluna_vendor.ts:626–629`, `bumpSelunaPurchase` :22–30 — whole-JSON-doc rewrite → per-item `$inc` with `$gte` guard | M |
| Oracle dashboard `pendingActions`: action pushed mid-poll is wiped unexecuted; failures cleared with zero feedback | dashboard `voice/manage/route.ts:86` `$push`; Oracle `index.ts:255–275` snapshot + unconditional `$set:[]`. Give actions ids, `$pull` only processed ones, write `lastActionResult` | S |
| Seluna `admin_queue` single-overwritten-doc (known backlog — **same defect class**, same fix) plus a delivery-confirmed status pill in the editor | `shops/seluna` route + Jester 30s poll | S |

**You will see:** auctions can't be griefed by fake bids; limited Seluna items can't oversell; VC admin actions from the dashboard visibly succeed or visibly fail.
**Effort:** M.

---

## PHASE 5 — Secure the deploy agent (the key to everything travels in plaintext)

**Goal:** The one credential that can restart/deploy every bot stops being sniffable.

| Item | Evidence |
|---|---|
| Agent runs plaintext HTTP on the public internet with a static Bearer key; one sniffed Railway→VPS request = full control of all bots + log tailing (which can leak tokens) | `src/lib/admin/vps-agent.ts` → `http://2.56.165.113:3100` |
| Key comparison is non-timing-safe (the website's webhook already got `timingSafeEqual` — the agent didn't) | `luna-agent/index.js:65` |
| `luna-agent` itself has no version control — the thing that deploys everything has no deploy path | not a git repo (verified) |

**Fix:** TLS via Caddy/nginx + Let's Encrypt on a subdomain, or a Cloudflare Tunnel (fits the existing Cloudflare setup); `crypto.timingSafeEqual`; `git init` + remote.
**You will see:** ops/deploy pages work identically, but over `https://`; for a security-first owner this is the single biggest gap closed.
**Effort:** M.

---

## PHASE 6 — Single-owner rule: one Mongo doc, one editing surface

**Goal:** No admin edit can ever be silently overwritten by a different page editing the same data.

| Item | Evidence | Effort |
|---|---|---|
| **Stone split-brain** (worst): Stones page syncs 3 stores; Meluna tab writes the same logical `stones[]` into `vendor_config.stonebox` only — edits in one silently desync or clobber the other. Make Stones the sole owner of the stone list; Meluna keeps box price/refund/portrait + a link | `stones/config/route.ts:161–190` vs `shops/meluna/route.ts:129–151`; Jester reads at `vendor_config_db.ts:202–207` vs `stones_config_db.ts:22–32`. Also fixes the backlog "meluna writes `_id:'stonebox'` identity confusion" | M |
| `jester_commands` edited from two pages (last-save-wins) → Commands owns it; Games shows a read-only chip | `games/GamesClient.tsx:231–256` vs `commands/CommandsClient.tsx:137` | S |
| Characters edited via two routes/validation layers → one editor | `/admin/characters` vs `website/CharactersPanel.tsx:135–151` (`content/save`) | S |
| Vendor triple-identity naming (meluna↔stonebox, zoldar↔tickets, Kael↔luckbox) — canonical display-name map everywhere incl. audit labels. **Do not migrate `_id`s yet** (see Do-NOT list) | `vendor-registry.ts`; audit action `meluna_stonebox_update` | S |

**Enforceable rule going forward:** no doc `_id` may appear in write paths of two page directories.
**You will see:** editing stone weights in one place updates everywhere the bot reads; audit log says "Meluna" when you edited Meluna.
**Effort:** M.

---

## PHASE 7 — IA consolidation: 33 nav items → ~19

**Goal:** A zero-dev-knowledge admin finds everything in one obvious place.

- **Content sprawl** (7 pages, 3 jobs) → **Site** (Pages/editMode · Characters · Info/Partners/Footer · Site Tabs · Media) + **Messaging** (Send DM+Announce · Templates)
- **System merge**: Ops + Deploy + Settings → one **System** page (Bots & Deploy · Health · Integrations), with the env checklist reworded as "Discord login: OK / Storage: OK" (`settings/page.tsx:14–44` is currently dev jargon)
- **Explore merge**: Dashboard stays; Activity/Analytics/Schedule/Audit become tabs of one page (currently 5 places to "see what happened")
- **Money merge**: Economy + Banking → one Economy page with tabs (loan summary currently lives on the wrong page)
- **Seluna editor**: item pickers deep-linking to Cards/Stones/Shops catalogs (currently requires tribal knowledge of 3 other catalogs — `shops/seluna/route.ts`)
- **Challenges**: replace raw-key `StructuredEditor` with schema-driven fields like `games/game-schema.ts`

Full target IA is in the dashboard-simplicity review; adopt it as written.
**You will see:** the sidebar shrinks by ~40%; every job has exactly one page.
**Effort:** M–L (can split: merges first, Seluna/Challenges polish second).

---

## PHASE 8 — Database quick wins (pure speed, near-zero risk)

**Goal:** Kill the collscans, mystery 429s, and idle polling load in one small session.

| Item | Evidence | Effort |
|---|---|---|
| **Zero secondary indexes** on every hot collection; `ensureAuditIndexes()` is defined and never called (verified live: only `_id_` everywhere) | `src/lib/admin/audit.ts:110–118`; create `{discordId,createdAt}` / `{createdAt}` / `{type,createdAt}` on tx collections, `points {balance:-1}`, `card_marketplace {status,expiresAt}` via a startup hook | S |
| Shared `admin_read` rate bucket: the 5s pulse eats users/list's 30/min budget → mystery 429s | `rate-limit.ts:44–47`; `users/list:38` (30/min) vs `activity/stream:26` (120/min) share one window → per-route keys | S |
| Live Activity Pulse: ~96 Mongo queries/min per open tab, keeps polling in background tabs | `LiveActivityPulse.tsx:83,119`, `activity/stream/route.ts:38–51` → 5s module micro-cache + `visibilitychange` pause | S |
| game-data ships the entire ~50KB card catalog per profile view, bypassing an existing invalidated cache | `api/profile/game-data/route.ts:74` vs `lib/cards.ts:13–23` | S |

**You will see:** admin search stops 429ing; profile pages load visibly faster.
**Effort:** S (execute in the order listed).

---

## PHASE 9 — Heavy-query rewrites + shared TTL cache

**Goal:** The slowest admin page becomes the fastest, and one cache helper replaces ten copy-pastes.

| Item | Evidence | Effort |
|---|---|---|
| **users/list rewrite**: up to 24 Discord REST calls per page (3–5s cold, re-fired per keystroke pause), join-everything `$lookup` before `$match`, and a **silently broken sort** (`'points.balance'`/`'levels.level'` don't exist on joined docs — "Top balance" is a no-op) | `api/admin/users/list/route.ts:57,60,103–115,173`; `discord-roles.ts:37`. Filter-first + one `GET /guilds/{gid}/members?limit=1000` cached 5 min | M |
| **Shared `createTtlCache` helper** — *one item, reported by two areas* (efficiency said 10 files, code-health said 9 — same finding): none dedupe in-flight loads (thundering herd on Discord roles). Build with promise memoization + stale-on-error + named registry (Phase 11's invalidator map needs the registry) | `lib/cards.ts`, `faction-war.ts`, `admin/db.ts`, `bank/live-bank-config.ts`, `bank/discord-roles.ts`, `bazaar/passport-discount.ts`, `shop-config.ts`, `vendor-config.ts`, `admin/footer-defaults.ts`, `admin/site-tabs.ts` | M |
| cards/stones snapshots `$unwind` entire ownership collections per navigation; holders drawer unwinds-then-matches (backwards) | `lib/admin/cards-v2.ts:19–37`, `stones-v2.ts:12`, `v2/cards/holders/route.ts:34–47` → ttlCache-wrap + `$match` before `$unwind` | S |
| Analytics/voice full-collection reads to enrich ≤20 rows | `analytics/games/route.ts:46,52`, `voice/stats:17–35` → `$in` + projections | S |

**You will see:** the Users page loads in well under a second and "Top balance" sort actually sorts.
**Effort:** M–L.

---

## PHASE 10 — Image bandwidth (needs one owner decision)

**Goal:** Grids stop downloading full-resolution card art to render 150px thumbnails.

`next.config.js:16` `images.unoptimized: true` disables all resizing — the single biggest public-page bandwidth cost (admin grid ~500 cards, public bazaar, profiles). **Decision needed:** (a) Cloudflare Image Resizing + custom loader (zero Railway CPU — assets already sit behind Cloudflare), or (b) generate `*_thumb.webp` at upload time. Respect the existing `?v=` cache-bust pattern either way.
**You will see:** bazaar and card grids load dramatically faster on mobile.
**Effort:** M.

---

## PHASE 11 — Code-health chokepoints (make future changes safe by construction)

**Goal:** One write path, one unwrap helper, one validation module — so the next feature can't reintroduce the bugs above.

| Item | Evidence | Effort |
|---|---|---|
| `writeBotConfig`/`writeVendorConfig` chokepoint with a `DOC_CACHE_INVALIDATORS` map — **this is the single root fix** for three backlog items at once: hardcoded live-bank-config invalidation (`config/butler/route.ts:309–314`), the audit log recording the **wrong docId** for brimor/broker saves (`config/jester/route.ts:274` logs `jester_shops` while writing `vendor_config.brimor`), and non-vendor jester writes invalidating nothing. ~18 route files adopt it | full adopter list in code-health review | M |
| SECTION_MAP hygiene: derive `ALLOWED_SECTIONS` from `SECTION_MAP` keys; fold the brimor/broker special-case into the map; derive butler GET from the map (~100 lines gone) | `config/butler/route.ts:14–80,91–111,243,272`; jester `:13–51,212–219` | S |
| `unwrapStDbData<T>` helper — backlog said ~5 copies; it's **~25 sites in 3 inconsistent flavors**, and the bare-ternary ones throw on corrupt JSON | `mells:55`, `faction-war:29`, `cards/config:70` + ~22 more (list in review) | S–M |
| Shared `SNOWFLAKE_RE`/`isSnowflake`/`DOB_RE` (16+ inlined copies) | `src/lib/validation.ts`, list in review | S |
| Log the `revalidatePath` swallow (a tab change silently not reaching the public site violates CONNECTED) | `site-tabs/route.ts:71,76` | S |

**You will see:** every admin save invalidates the right caches automatically; audit log always names the true document.
**Effort:** M. (Do Phase 9's ttlCache registry first — the invalidator map references it.)

---

## PHASE 12 — Dead-route cleanup (needs your explicit approval per deprecate pattern)

**Goal:** Remove 18 confirmed zero-caller API routes — several are **live mutation endpoints** guarded only by auth (attack surface).

April's audit flagged ~11; fresh verification found **18** (list with per-route notes in the code-health review). Highest priority: dead mutations `users/batch`, `users/[id]/cards|stones|inventory` (POST+DELETE), `economy/transactions/reverse`, public `bank/insurance`. Also full-delete the 410-gated `vendors/seluna` (grep-clean) and the dead PUT branches of `shops/config`. **Keep:** `marketplace/auction/auto-resolve` (external cron via `CRON_SECRET`), `config-writer.ts`, `github.ts` (still imported).
**Process:** present the blast-radius list → owner OK → delete or 410-gate.
**Effort:** S–M.

---

## PHASE 13 — Ops & bot hygiene polish

**Goal:** The bots stop having avoidable restarts and the ops page tells the truth about them.

| Item | Evidence | Effort |
|---|---|---|
| Oracle's 256M PM2 cap is undersized for a music+canvas bot (Sage, lighter, gets 512M) — plausible cause of mid-song VC drops and the memory note "deploy agent may fail to restart Oracle" | `LunaOracle/ecosystem.config.cjs` → raise to 512–768M, watch restart count a week | S |
| Butler's "354 restarts" is mostly the daily `cron_restart: '0 4 * * *'` — but the ops card reads as "buggy" | `OpsClient.tsx:302` → surface `unstable_restarts`, label the cron | S |
| Sage has no provider fallback — any Google 429/5xx becomes a canned Arabic apology, never logged to the activity feed, OpenRouter never tried | `Luna Sage/ai/handler.js:86–197` → retry once, fail over, `logActivity` | M |
| Sage inlines up to 25MB images as base64 under a 512M cap (~33MB string per image) | `mentionHandler.js:217–223`, `handler.js:258–268` → cap at ~8MB with a friendly Arabic rejection (copy existing phrasing — never write original Arabic) | S |

**You will see:** Oracle stops dropping VC mid-song; ops page restart counts make sense; Sage recovers from quota errors instead of going quiet.
**Effort:** S–M.

---

## Do NOT Do (plausible-sounding, evidence says skip)

1. **Don't wire up Jester's batch_writer points queue** — delete it. It has zero callers, its retry re-applies `$inc` with no idempotency, and docs falsely claim it's active. Wiring it would *add* a money bug.
2. **Don't migrate vendor_config `_id`s** (`tickets`→`zoldar`, `stonebox`→`meluna`) now. A display-name map fixes 95% of the confusion at S effort; an `_id` migration needs bot fallback reads in both directions and risks the shared-DB dashboard for cosmetic gain. Revisit after Phase 6 lands.
3. **Don't add TTL indexes or archive transaction collections.** Total DB is ~23MB / 18k docs — years of headroom. This would be premature ops work.
4. **Don't refactor game-data's 16 parallel reads** — verified: all `_id` point lookups, no N+1 (except the catalog, fixed in Phase 8).
5. **Don't touch the three.js bundle** — already dynamic-imported with reduced-motion bail-out; not a bundle problem.
6. **Don't churn the acceptable `catch {}` sites** (body-parse fallbacks in cooldowns/debt/loans, seluna image-map building) — only the money-path and revalidate swallows matter.
7. **Don't build a message queue / event bus for cross-bot sync.** At 1,400 users, atomic Mongo operations (Phases 2–4) solve every consistency problem found. A broker is complexity with no payoff.
8. **Don't delete `config-writer.ts` or `github.ts`** — still imported by live routes despite looking legacy.
9. **Don't unify Butler onto the raw mongodb driver** (dropping st.db). The `unwrapStDbData` helper (Phase 11) neutralizes the legacy-shape pain at 1/50th the risk of a storage-layer migration.
10. **Don't rewrite the rank/leaderboard as real-time.** `countDocuments({xp:{$gt:userXp}})+1` with an index (Butler review #7) fixes the full-collection scans; anything fancier is over-engineering.

---

## Completeness Check — what this review did NOT cover deeply

- **Dashboard authentication itself** — all reviews assumed `requireMastermindApi()`/NextAuth session handling is sound; nobody audited the login flow, session expiry, or CSRF token lifecycle end-to-end.
- **In-Discord permission model** — who can invoke admin/staff bot commands inside the guild (role checks in Butler/Jester command handlers) was not audited.
- **Jester game logic correctness** beyond money paths — GrandFantasy/Mafia/FactionWar internal state machines, collector leaks, and the image worker pool were not reviewed.
- **Butler canvas rendering pipeline** (profile/rank card generation performance and correctness) — untouched.
- **MongoDB Atlas configuration** — network allowlist, DB user roles, backup/restore posture, disaster recovery. Given TEST and prod share one database, this matters.
- **Railway platform config** — resource limits, secrets rotation, the 7 still-pending env vars.
- **R2 lifecycle and cost** — object sprawl from the `?v=` cache-bust pattern was not measured.
- **Sage prompt-injection resistance** — the abuse filter was noted as healthy, but adversarial prompt handling (persona-break beyond the existing guard, tool misuse) wasn't probed.
- **Public website non-API UX** — bazaar/profile frontend flows, mobile behavior, accessibility beyond the admin a11y pattern.
- **sticky-bot and rich-destiny** — not reviewed at all (standalone, likely fine to leave).
- **Swaps/marketplace public flows** — only the counter-offer restore bug surfaced; the full swap/auction public lifecycle wasn't traced.

Recommend a follow-up pass on dashboard auth + Atlas config once Phases 1–5 (money + security) are shipped.