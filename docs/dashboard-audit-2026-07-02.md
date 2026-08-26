# Dashboard Audit — 2026-07-02

**Scope:** Luna-Fantasy-Main `/admin` (Next.js on Railway). Symptom classes: crashes, dead actions, wrong/stale data.
**Method:** Static code hunt (2 parallel Explore agents on 8 priority files) + env cross-reference + DB integrity spot-checks.
**Previous audit:** 2026-04-20 (fixed 4 defects, flagged 11 dead routes). **43 commits** landed since.
**Phase B (live Playwright triage) not run** — requires an active Mastermind browser session that this session can't produce. See "Phase B blocker" section.

---

## Summary

| Severity | Count |
|---|---|
| HIGH | **13** |
| MED | **9** |
| LOW | **3** |
| **TOTAL** | **25** |

**Most affected surfaces (by defect count):**
1. `admin/valecroft/ValecroftClient.tsx` — 8 defects (biggest recent feature churn: properties, items, ownership, slot-rules).
2. `admin/cards/CardEditDialog.tsx` — 4 defects.
3. `admin/characters/CharactersAdminClient.tsx` — 5 defects.
4. `admin/_components/*` primitives — 6 defects (portal CSS scoping, missing hydration guards).
5. `admin/announce` + API route — 3 defects around missing bot tokens.

**Dominant root causes (patterns, not incidents):**
- **`res.json()` called before `res.ok` check** — appears in 12+ places across the mutating flows. Silently swallows server error messages, users see generic "Unknown error" toasts instead of the actual reason, and 5xx HTML responses throw parse errors that hit the wrong catch branch. This is the biggest single class and probably explains a lot of the "actions don't work / no clear reason" reports.
- **Portals rendered to `document.body`** without a scoped container — CmdK, PendingActionPill, PlayerPeek. Loses admin-shell CSS variables. Explains any "the modal opens but looks wrong" symptoms.
- **`$set: { data: {...} }` config-replace pattern** — `mells-butler-mirror.ts` and `seluna-mells-mirror.ts`. Overwrites the entire `data` doc on every save. Concurrent writes (dashboard + bot) will lose fields. Explains intermittent "config field disappeared after save".
- **Missing bot tokens on Railway (likely)** — `JESTER_BOT_TOKEN` and `SAGE_BOT_TOKEN` are not in `.env.local`; their Railway status needs owner confirmation. If missing on Railway too, `/admin/announce` to Jester or Sage returns 500 while the button appears to succeed.

---

## Defect table

| # | Sev | Surface | File:line | Symptom | Root cause hypothesis | Repro |
|---|---|---|---|---|---|---|
| 1 | HIGH | /admin/valecroft — Properties tab load | `ValecroftClient.tsx:85` | Empty table when API errors, no error banner | `data.rows` accessed without `res.ok` check; `setRows(data.rows ?? [])` silently hides 500 | Force `/api/admin/v2/valecroft/properties` to 500 (bad query), reload page |
| 2 | HIGH | /admin/valecroft — Property delete | `ValecroftClient.tsx:102-108` | Delete toasts "Unknown error" when server returns HTML 500 | `await res.json()` before `res.ok` guard; parses HTML as JSON | Delete a property while offline/500 |
| 3 | HIGH | /admin/valecroft — Property owner count | `ValecroftClient.tsx:373-376` | Owner-count warning never shows even when count > 0 | Fetch missing `cache: 'no-store'` + missing `res.ok` check + `.catch()` silences | Open property edit form, watch Network tab |
| 4 | HIGH | /admin/valecroft — Property save | `ValecroftClient.tsx:449-450` | Save error toast reads "Unknown error" instead of server message | Parse-before-ok pattern | Save a property with an invalid slot rule (server rejects) |
| 5 | HIGH | /admin/valecroft — Item save | `ValecroftClient.tsx:779-780` | Same as #4 for items | Same pattern | Save an item with invalid data |
| 6 | HIGH | /admin/valecroft — Force-foreclose | `ValecroftClient.tsx:1019-1029` | UI doesn't update after successful foreclose; user thinks it failed | No `router.refresh()` after mutation; background refresh has no cache-bust | Foreclose a property, look at the list |
| 7 | HIGH | /admin/cards — CSRF fetch | `CardEditDialog.tsx:30, 200` | Silent empty CSRF token used in later mutations | `res.ok` not checked; empty string stored, still sent in `x-csrf-token` header | Rare — only when `/api/admin/csrf` errors |
| 8 | HIGH | /admin/cards — Rename | `CardEditDialog.tsx:109-112` | Rename toast shows opaque error on 500 (HTML response) | Parse-before-ok | Rename a card while server errors |
| 9 | HIGH | /admin/characters — CSRF | `CharactersAdminClient.tsx:30-32` | Empty CSRF sent silently, mutation may be rejected or (worse) accepted | Same pattern | Same as #7 |
| 10 | HIGH | /admin/characters — Save | `CharactersAdminClient.tsx:86-87` | Save shows "Unknown error" on 500 | Parse-before-ok | Save with server 500 |
| 11 | HIGH | /admin/characters — Image auto-save | `CharactersAdminClient.tsx:413` | Local state updates with new image URL but server never confirms; refresh reveals loss | Fire-and-forget onSave with no error handling / rollback | Replace image → refresh page → image reverts |
| 12 | HIGH | /admin/_components — CmdK modal | `CmdK.tsx:186` | Modal styles look wrong (wrong colors/fonts) inside CmdK search | `createPortal(portal, document.body)` escapes `.admin-v2-shell` scope | Open ⌘K, inspect element |
| 13 | HIGH | /admin/_components — PendingActionPill | `PendingActionPill.tsx:44` | Countdown pill loses shell styling | Same portal-scope issue | Trigger any confirm-pending action |
| 14 | MED | /admin/info — Save error paths | `InfoClient.tsx:33, 44` | Save errors show "HTTP {status}" without server message on HTML 500 | `.catch(() => ({}))` swallows parse failure of HTML | Cause 500 on `/api/admin/config/footer` or Luna-map save |
| 15 | MED | /admin/cards — Auto-save orphan | `CardEditDialog.tsx:237-250` | Image uploaded to R2 but card record not updated when `putRarityItems` fails; user sees "Image is on R2" but can't retry cleanly | Two-phase update, no rollback on step-2 failure | Kill network between upload finish and card save |
| 16 | MED | /admin/announce — Bot tokens | `.env.local` vs `route.ts:24-25` | Announce to Jester/Sage returns 500 with generic message if Railway also lacks the tokens | `getBotToken('jester'\|'sage')` returns null → 500 | Try to announce to Jester on prod |
| 17 | MED | /admin/announce — Success timing | `AnnounceClient.tsx:167-176` | Rare: success toast fires before Discord API error surfaces | Order of await/toast — needs runtime verification | Rate-limit or permission error from Discord |
| 18 | MED | /admin/_components — ChannelPicker portal | `ChannelPicker.tsx:115-119` | Portal may fail before hydration on slow-render pages | No `typeof document !== 'undefined'` guard (contrast: ContextMenu:86 does) | Slow first paint |
| 19 | MED | /admin/_components — Topbar health poll | `Topbar.tsx:56-62` | Orphan fetches pile up on rapid nav; strict-mode warnings; possible stale setState | `fetch` without `AbortController` on pathname-change deps | Navigate quickly between admin pages |
| 20 | MED | Butler shop mirror | `mells-butler-mirror.ts:43-55` | Concurrent write (dashboard save while bot writes) loses a `data.*` field | `$set: { data: {...} }` replaces whole doc; not surgical `data.field: ...` | Save Mells while bot updates same doc — hard to repro |
| 21 | MED | Seluna mirror | `seluna-mells-mirror.ts:121-125` | Same as #20 | Same pattern | Save Seluna config in a race |
| 22 | MED | Seluna mirror concurrency | `seluna-mells-mirror.ts:77-128` | Two rapid reconcile calls: second overwrites first | Non-atomic read → mutate → write | Fire two saves in quick succession |
| 23 | LOW | Butler shop mirror upsert | `mells-butler-mirror.ts:44` | Ghost doc creation if `_id` ever drifts | `upsert: true` without shape validation | Only if the hardcoded `_id` changes |
| 24 | LOW | PendingActionPill interval | `PendingActionPill.tsx:14-23` | Rare stale tick when `action` recreated with same id but new props | `setInterval` dep only on `action` object identity, not fields | Recreate action rapidly |
| 25 | LOW | Legacy `admin_audit` collection | (DB) | 2 orphan docs in `admin_audit` while code writes to `admin_audit_log` (1556 docs) | Old collection name before rename | Purely cosmetic — collection can be dropped |

---

## Phase C — Environment

**Set locally (`.env.local`):** MONGODB_URI, AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, AUTH_SECRET, DISCORD_BOT_TOKEN, ORACLE_BOT_TOKEN, TRANSACTION_WEBHOOK_KEY, CRON_SECRET, R2_* (all 5), CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN, VPS_AGENT_URL, VPS_AGENT_KEY, BUTLER_PROJECT_PATH, JESTER_PROJECT_PATH.

**Referenced in server code but NOT in `.env.local`** (Railway status must be confirmed by owner):

| Var | Used by | Impact if missing on Railway |
|---|---|---|
| `NEXTAUTH_URL` | `admin/challenges/page.tsx:20`, `admin/voice/page.tsx:11` | SSR fetches to `${NEXTAUTH_URL}/api/...` build a bad URL; SSR crashes → page 500s |
| `DISCORD_GUILD_ID` | 5 API routes (announce, discord/guild, challenges, cron) | Guild lookups fail; announce channel picker empty; challenges list empty |
| `NEXT_PUBLIC_GUILD_ID` | `api/admin/v2/valecroft/grant-special/route.ts:11` | Valecroft special-grant refuses (no guild ID) |
| `BUTLER_BOT_TOKEN` | `announce/route.ts:23` (falls back to `DISCORD_BOT_TOKEN`) | Announces still work via fallback |
| `JESTER_BOT_TOKEN` | `announce/route.ts:24` (no fallback) | Announce to Jester → 500 |
| `SAGE_BOT_TOKEN` | `announce/route.ts:25` (no fallback) | Announce to Sage → 500 |
| `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` | `lib/admin/github.ts` | Any GitHub-write action fails (currently no callers surfaced in admin, but grep the file's exports before assuming safe) |
| `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` | `lib/admin/r2.ts:9-10` | R2 cache-purge on upload silently fails → stale images |
| `NEXT_PUBLIC_BUILD_ID/BUILD_SHA/VERCEL_GIT_COMMIT_SHA/RAILWAY_DEPLOYMENT_ID` | Footer + faction-war/cards content | Cosmetic only (footer shows "unknown") |

**Action for user:** In Railway → Settings → Variables, confirm which of the ones marked "no fallback" are set. The most likely dashboard-breaking gaps are `NEXTAUTH_URL`, `DISCORD_GUILD_ID`, `NEXT_PUBLIC_GUILD_ID`, and the Jester/Sage bot tokens.

`next.config.js`: CSP is in **Report-Only** mode (won't block anything, correct for now); no redirects that could loop; `trailingSlash: true` — worth remembering. No `middleware.ts` at all — auth runs inside each layout/page.

---

## Phase D — DB integrity spot-checks

Sampled collections that the dashboard reads. All shapes match UI expectations except where noted:

| Collection | Count | Observations |
|---|---:|---|
| `discord_users` | 1,406 | Populated. Avatar hydration in passport list should work. |
| `characters` | 245 | Populated. |
| `community_challenges` | 11 | Populated. Small enough to review manually. |
| `properties_catalog` | 19 | Populated. |
| `user_properties` | 4 | Very low — verify with owner this matches expectation (only 4 users own a property?). |
| `bot_config` (sage_*) | 4 docs (all four sage_* keys) | Populated. `sage_live_chat` channels: 3 IDs. **Note:** `sage_settings.openrouter_model` = `anthropic/claude-3.5-sonnet:online` — this model was deprecated by Anthropic. Should be `anthropic/claude-sonnet-4.6` or newer. Not a dashboard bug but a config staleness worth flagging. |
| `vendor_config` | 6 (`brimor`, `broker`, `mells_selvair`, `luckbox`, `tickets`, `stonebox`) | **Meluna missing** — per memory `feedback_vendor_config_schema.md` this is expected (Meluna reads from a different collection), but the shops dashboard tab may render an empty Meluna panel. Verify. |
| `bot_config.butler_shop` | Yes, populated | Mells mirror is currently in sync. |
| `admin_audit_log` | 1,556 | Populated — actions ARE being written. Good. |
| `admin_audit` | 2 | Legacy collection; safe to drop (see defect #25). |

No shape drift found in the sampled reads. The "data wrong/missing" symptoms in the report are more likely UI-side (the parse-before-ok pattern hiding real 5xxs) than DB-side.

---

## Phase B — blocker note (skipped this pass)

Phase B needed a browser session logged in as Mastermind. That's a per-owner session cookie on the Windows Firefox Dev profile — not something this Playwright instance can produce (fresh headless Chromium starts unauthenticated). Options for the next pass:

1. **User logs in on their Firefox Dev profile, then keeps it open** while I run a Playwright-in-Firefox-connect walk (needs Playwright config, not the default Chromium session).
2. **User records specific broken pages** — I re-do Phase A on those files.
3. **I run Playwright anonymously** and only cover the login/302 behavior — verifies the site is up but misses everything auth-gated (~95% of the audit target).

None of these blocks the batch fix — the static findings above already cover the dominant symptom classes.

---

## Suggested batch-fix ordering

**Batch 1 — Env (fastest, biggest possible unlock — do first, together with owner)**
- Confirm/set on Railway: `NEXTAUTH_URL`, `DISCORD_GUILD_ID`, `NEXT_PUBLIC_GUILD_ID`, `JESTER_BOT_TOKEN`, `SAGE_BOT_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` (if not already).
- Zero code changes. Redeploy.
- May single-handedly fix a large fraction of "actions don't work" reports on `/admin/announce`, `/admin/challenges`, `/admin/voice`, `/admin/valecroft` (grant-special).

**Batch 2 — Ok-check-then-parse (largest cluster, one systematic pass)**
- Fixes: #1, #2, #4, #5, #8, #10, #14. Also revisit `res.json()` sites in the flagged files that weren't in the audit table.
- Pattern: introduce a `safeFetchJson(url, init)` helper in `src/lib/admin/http.ts` that checks `res.ok`, tries to parse the error body (JSON, then text), and returns `{ ok: true, data }` or `{ ok: false, status, message }`. Replace call sites.
- Also updates client toast messages to show the server-provided error string.

**Batch 3 — Portal CSS scoping (visible UX)**
- Fixes: #12, #13, and PlayerPeek if same pattern confirmed.
- Pattern: introduce a `<PortalRoot />` inside `.admin-v2-shell` at layout mount, ref-forwarded to a context. All portals target that node instead of `document.body`. Reuse per `feedback_portal_css_scoping.md`.

**Batch 4 — Config-mirror atomicity (data integrity)**
- Fixes: #20, #21, #22. Switch to dot-path `$set` (`{ 'data.field': value, 'data.otherField': value }`) instead of replacing the whole `data`. Where reconcile needs read-then-write, wrap in a MongoDB session/transaction or use an `arrayFilters` update.

**Batch 5 — Individual page/state bugs**
- Fixes: #3, #6, #7, #9, #11, #15, #17, #18, #19. Small independent commits; one commit per fix so each is easy to revert.

**Batch 6 — Cosmetic / cleanup**
- Fix #23, #24, drop `admin_audit` collection, refresh the deprecated `openrouter_model` value in `bot_config.sage_settings`.

---

## What was NOT audited (limits of this pass)

- **35 admin pages — spot-checked, not each individually walked.** The static hunt focused on the 8 highest-churn files. The other 27 pages have not been individually screened; they may have their own defects. Phase B (browser walk) would have caught these but is blocked.
- **API auth chain per-route.** Prior audit (2026-04-20) verified all mutating routes have `requireMastermindApi()` + `validateCsrf()`; the second Explore agent confirmed no regressions. But we did not re-verify the audit-log write on every route.
- **The 11 dead routes** flagged in the 2026-04-20 audit — status unchanged; not defects, but should be pruned before they get callers.

---

## Verification checklist (post-fix)

For each batch, before shipping:
1. `pnpm run typecheck` clean.
2. `pnpm run build` clean.
3. Manually reproduce the top-2 HIGH defects in the batch, confirm fixed.
4. Grep for the anti-pattern that produced the defect (e.g., `res.json` uses without a nearby `res.ok` check) to catch missed sites in the same file.
5. Railway deploy → smoke-test the fixed page.

---

## Owner action items right now

1. **Confirm Railway env**: Are `NEXTAUTH_URL`, `DISCORD_GUILD_ID`, `NEXT_PUBLIC_GUILD_ID`, `JESTER_BOT_TOKEN`, `SAGE_BOT_TOKEN` set? If any are missing, that alone likely explains a chunk of the reports.
2. **Approve batch ordering** above, or reshuffle.
3. Then I write a **separate batch-fix plan** file and start executing. No code changes until you approve.
