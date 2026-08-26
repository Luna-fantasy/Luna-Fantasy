# Frontend Sweep — 2026-08-26

> Live findings log from the full-dashboard Playwright sweep (local dev, read-only against prod Atlas).
> Severity: HIGH (broken/blocking) · MED (confusing/inconsistent) · LOW (polish).
> Class: SMALL (fixed this session) · BIG (listed for approval).
> Local-only artifacts (missing env vars on /admin/settings, CSP report-only console spam) are excluded by design.

## Status

- [x] Phase 1 — Media drag bug reproduced (drag right 80px → circle jumped LEFT 4893→4500, pinned; center-grab stretched circle into egg rx 395→2452)
- [x] Phase 2 — Media fix implemented
- [x] Phase 3 — Media fix verified in-browser (read-only; save path verified by typecheck + code review — real save will be the user's own repositioning session)
- [x] Phase 4 — All 34 pages swept (screenshots in session scratchpad `sweep/`)
- [x] Phase 5 — Small fixes applied + re-verified in Playwright
- [x] Phase 6 — Big-ticket list below

## Media fix — what changed (all verified in Playwright)

Files: `src/app/admin/media/CanvasStage.tsx` (largely rewritten), `CanvasEditorPanel.tsx`, `CanvasTestDialog.tsx`, `useCanvasHistory.ts`, `src/app/api/admin/canvas/[bot]/route.ts`, `src/styles/admin-v2.css`.

1. Drag bounds now canvas-relative (was hardcoded ±500/4500 — dead wall on the 10000px levels leaderboard) + element-aware: ≥24 screen px of the shape always stays on-stage so nothing can be dragged fully off and lost. Verified clamps: levels board x∈[249, 9751], rank card x max 954.
2. Server PUT validation is per-canvas (strict superset of old caps — nothing previously savable breaks; levels board becomes savable at all). `startX/startY` bounded too; Number.isFinite/CSRF/rate-limit/audit untouched.
3. Drag scale measured from the real rendered SVG at drag start (was ~2% off due to padding math — cursor lag gone; verified exact: +50px ⇒ +1342 units at 3.73%).
4. Circle resize dot moved from center (was stealing horizontal drags → egg stretching) to the ellipse edge; rect dot to bottom-right corner (grow-out semantics, no more x/y writes on resize); dots screen-constant size, top layer, only on the selected element; CSS r:8/9 overrides removed (they beat the SVG attr).
5. Elements without size props (luna21 card rows) get NO resize dot (it used to cover the whole 50×20 rect and write dead width/height keys); their drags now write `startX/startY` — the keys the bot reads (was writing dead `x/y`). Verified: Start X 185→315 exact.
6. Drag listeners registered once (refs) — no more per-frame teardown that could drop mouseup (sticky drag); Escape cancels + reverts the drag; selection survives drag release; background click still deselects.
7. Trial upload now measures the image and warns in plain words when its shape ≠ canvas shape (letterboxing/misalignment explained); Rules-of-Hooks early-return fixed; `history.push` moved out of the setState updater (StrictMode dupe undo entries); `useCanvasHistory` return memoised; CanvasEditorPanel + CanvasTestDialog migrated to mandated `adminGet/adminPost/adminPut/adminFetch` helpers (deleted both local `fetchCsrf` copies).

## Confirmed findings

| # | Page | Severity | Class | Finding | Status |
|---|------|----------|-------|---------|--------|
| 1 | public site (all pages) | LOW | SMALL | `EditableImage` queried `alts.*` i18n keys that don't exist for every editable image → IntlError console spam on every page (next-intl logs instead of throwing, so the existing try/catch was dead code) | **fixed** — key-existence check via `useMessages()` in `EditableImage.tsx` |
| 2 | /admin/media | HIGH | SMALL | Drag bounds hardcoded ±500/4500 → levels leaderboard circles undraggable + unsavable (+ 6 compounding defects, see Media section above) | **fixed** + verified |
| 3 | dashboard, activity, inbox, passports, leveling | HIGH | SMALL | Doubled avatar URLs (`cdn…/avatars/<id>/https://cdn…`) — bots store full URLs in `discord_users.avatar` while the site cron stores bare hashes; 20 call sites blindly prepended the CDN prefix | **fixed** — new tolerant `discordAvatarUrl()` helper (`src/lib/admin/avatar.ts`) applied to all 20 sites; also fixes animated (gif) avatars that were hardcoded .png |
| 4 | /admin (dashboard) | MED | SMALL | Live Activity rows overflowed their card by ~160px — amount/actor/time clipped (grid column floors exceeded the half-width card) | **fixed** — relaxed `.av-pulse-row` grid floors; 0 overflowing rows verified |
| 5 | /admin (dashboard) | MED | SMALL | Applications Queue counted 44 st.db pointer docs (`_id: user_<id>_<type>`) as "Pending review" → phantom "unknown · just now" queue entries and a wrong donut | **fixed** — same `status+id $exists` discriminator the inbox uses; now shows real 45 total / 0 pending |
| 6 | /admin/inbox | MED | SMALL | USER column crushed to 56px (2-char usernames) while category got 220px + status pill stretched 1fr — row grid had 7 columns for 6 children and never matched the thead | **fixed** — 6-column grid, user gets the flexible share; full names verified |
| 7 | /admin/characters, /admin/site-tabs | MED | SMALL | React hydration errors (server HTML thrown away + re-rendered) caused by inline `<style>` template blocks | **fixed** — 15KB of CSS moved verbatim into `admin-v2.css` (site-tabs' `.av-page-header` overrides scoped so they can't leak to other pages); zero hydration errors verified, styling intact |
| 8 | /admin/inbox + dashboard pulse | LOW | SMALL | Stale Discord avatar hashes 404 → browser broken-image icons | **fixed** — letter-initial fallback on error, plus post-hydration sweep for images that failed before React attached (SSR rows); 0 broken images verified |
| 9 | /admin/characters, /admin/valecroft | MED | SMALL | Native browser `confirm()` popups for delete/revoke — off-brand, no undo window | **fixed** — both now use the themed 5s pending-action countdown (danger tone) like every other destructive action |
| 10 | sidebar | MED | SMALL | Audit Log missing from the sidebar nav entirely (only reachable via topbar pill / `g a`) | **fixed** — added to Overview cluster |
| 11 | /admin/challenges | LOW | SMALL | List refresh failures only went to console — operator never knew the list was stale | **fixed** — error toast + res.ok check |
| 12 | 18 icon-only `×` buttons | LOW | SMALL | No aria-label (screen readers announce nothing) | **fixed** — labels added across 14 files |
| 13 | watchlist/commands/games/inbox/dm/characters | LOW | SMALL | Disabled buttons with no explanation (Flag user, + Add ×2, Reject, Send DM, ID field) | **fixed** — title hints ("Enter a Discord ID above first", "Write a short reason first — the applicant sees it", etc.) |

## Sweep notes (no action needed)

- All 34 pages loaded without console errors (after fixes) and without horizontal page overflow; no `undefined`/`NaN`/`Invalid Date` text anywhere.
- Local-only artifacts excluded by design: `/admin/settings` "6 missing env vars" + "Discord Auth: Broken" (missing local `NEXTAUTH_URL` etc.), CSP report-only spam.
- Games page horizontal game-strip shows 5 of 10 tiles with no scroll hint — LOW, cosmetic, left as-is (tiles do scroll).
- Schedule page shows a healthy empty state; note "Seluna rotation: 0 events in 30d" — if Seluna should appear monthly, the rotation feed may not be wired to the schedule. Data-side question for the owner, not a UI bug.
- Recent Transactions header ("LAST 12 | View all") stacks a bit awkwardly — LOW cosmetic, untouched.
- Dashboard/audit pagination "« First / ‹ Prev" disabled without hints — self-explanatory, left as-is.

## Big-ticket list (needs owner approval — NOT done)

1. **Dead middleware**: `middleware.ts` sits at repo root while the app lives in `src/` — Next.js never loads it (`middleware-manifest.json` is empty). `/admin` is still protected by `requireMastermind()` in the layout + `requireMastermindApi()` on all 117 API routes, so this is defense-in-depth, not an open hole — but the edge layer everyone assumes exists does not run, and `?editMode=1`, `/profile`, `/bazaar` gating in it is also dead. Moving it needs an edge-runtime split (it imports the MongoDB adapter + node crypto) — do NOT move casually.
2. **IA consolidation** 33 → ~19 nav items per `docs/reviews-2026-07/dashboard-simplicity.md` (phases 6–7 of the ecosystem gameplan).
3. **Characters + Site Tabs full restyle** onto av-* primitives (hydration is fixed; pages still look off-brand vs the rest of the shell — bespoke buttons/inputs/modals).
4. **Canvas editor upgrades**: pointer events + capture (touch/pen + drags that leave the window), zoom/pan for the 10000px canvas, per-drag undo granularity (one drag currently = many history entries; `replaceTop` exists unused), auto-fit canvas size to uploaded image (changes bot coordinate space — needs bot-side coordination).
5. **Bot-side avatar convention**: bots write full URLs into `discord_users.avatar`, site cron writes bare hashes — the website now tolerates both, but the bots should standardize (bare hash) and a one-time data normalization would let the tolerant reader be simplified. Touches shared collections → needs the dashboard-sync checklist.
6. Known backlog carried from July audits: `users/list` query weight (5 `$lookup`s per keystroke), legacy `/api/admin/v2/*` path consolidation, StructuredEditor raw-key labels on Challenges, Valecroft's remaining hand-rolled fetches → adminFetch helpers.
