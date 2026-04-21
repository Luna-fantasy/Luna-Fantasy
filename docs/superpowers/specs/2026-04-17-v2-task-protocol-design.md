# v2 & Owner-Dashboard Task Protocol — Design

**Date:** 2026-04-17
**Scope:** Reusable task-execution protocol applied to every request that isn't trivially one-line. Universal layer applies to all Luna projects; v2 Dashboard layer applies inside Luna-Fantasy-Main when v2 triggers match.
**Status:** Approved design, ready for implementation plan.

---

## 1. Problem Statement

Recurring failure modes across v2 dashboard work (confirmed by owner with concrete screenshots):

1. **Reinventing primitives** — rebuilding what `_components/` already provides.
2. **Claiming "done" on half-baked code** — types don't compile, page doesn't mount, API returns 500, no end-to-end proof.
3. **Schema / API drift** — wrong collection, wrong field name (`timestamp` vs `createdAt`), invented fields, forgotten CSRF/auth.
4. **Visual regressions** — mosaic bleed, missing `backdrop-filter`, inline hex, generic Tailwind-ish spacing.
5. **Over-scoping** — diff quietly includes refactors beyond the stated task.
6. **No verification** — no typecheck, no page load, no API hit — "looks good" claims without evidence.
7. **Tonal drift** — generic AI voice, "Let me…" narration, grand language, emoji in code.
8. **Forgetting existing APIs / endpoints** — new route created when v1 already serves.
9. **Context amnesia** — re-reading files already read, re-discovering known facts.
10. **Rendering over broken data** — 404 images, missing refs presented as healthy (*Brimor portrait*).
11. **UI for nonexistent backend** — control surface for a feature with no bot consumer (*Brimor "Abilities" tab*).
12. **Empty state over populated data** — scaffolded list renders "nothing here" without verifying DB state (*Zoldar "no packages" when packages exist*).
13. **Hardcoded registry drift** — game/vendor/bot lists hardcoded, don't update when source changes (*Magic Bot still visible after removal*).
14. **Raw-JSON leak into owner UI** — direct violation of "no raw JSON for owners" (*Games Advanced section*).
15. **Grand-promise generic-delivery** — "extraordinary" language, bland implementation.
16. **Nod-and-execute** — no pushback on flawed plans or ambiguous requests.

These persist across sessions because memory is loaded but not *enforced*. The protocol is the enforcement mechanism.

---

## 2. Goals & Non-Goals

### Goals

- Kill all 16 failure modes by construction, not by hope.
- Charitable Complexity: assume every task is part of a larger system, scan for impact the user didn't mention.
- Mandatory pushback on red flags; refuse-to-execute until resolved.
- Evidence-based done verdicts: literal `VERIFIED` or `BLOCKED: <reason>`, never hedging.
- Reusable across future projects that share the owner-dashboard layout.
- Zero bloat on unrelated sessions (bot projects don't see v2-specific rules).
- User input stays simple natural language; Claude does all detective work.

### Non-Goals

- Not a slash command. No manual invocation — auto-activation from request content.
- Not a silver bullet for bot-code rules — bots have their own TEST-first workflow; this protocol covers the *generic* engineering hygiene plus v2 layout specifics only.
- No enforcement on trivial one-line tasks (e.g. single CSS tweak, single string fix) — full protocol would be pure ceremony.

---

## 3. Architecture — R4 Split by Universality

Three artifacts, three scopes:

| Artifact | Scope | Loaded when |
|---|---|---|
| `~/CLAUDE.md` — Universal Engineering Protocol block appended | All projects, all sessions | Always |
| `Luna-Fantasy-Main/CLAUDE.md` — v2 Dashboard Layer appended | Only inside that repo when v2 triggers match | Auto on trigger |
| `~/.claude/templates/owner-dashboard-protocol.md` — Portable template | Future projects with same layout | Never auto-loaded; copy-paste reference |

**Rationale:** Process discipline (pushback, pre-flight, charitable complexity, verify verdicts, voice rules) is project-agnostic — bot work benefits equally. Only layout-specific rules (v2 primitives, `--av-*` tokens, vendor-style tabs, Peek/Undo/Toast action flow) are truly project-local. Splitting by universality avoids bloating bot sessions while still eliminating cross-session repetition.

---

## 4. Universal Engineering Protocol (§ 2)

Lives in `~/CLAUDE.md`. Always active. Applies to Butler, Jester, Oracle, Sage, Luna-Fantasy-Main, any future project.

### 4.1 Scope of Application

Applies to any request that:
- Touches more than one file, OR
- Introduces new behavior / new feature, OR
- Touches shared state (MongoDB collections, config, VPS deploy), OR
- Is ambiguous enough to need pushback.

Does NOT apply to true one-liners (single CSS value change, single string fix, single typo). When skipped, Voice Rules still apply.

### 4.2 Charitable Complexity Rule

> Assume every request is part of a larger system. Scan for impact the user did not mention: related pages sharing primitives/styles/APIs, bot-side consumers, shared MongoDB collections, canvas/render paths, v1 dashboard duplicates, Railway prod implications. Flag everything found; surface in Plan §2 (scope) or §3 (out of scope) or §11 (risks & unknowns).

### 4.3 Six Phases

#### Phase 0 — PUSHBACK (conditional)

Before any work begins, audit the request against 11 mandatory triggers. **Any trigger → HALT, post a structured `[PUSHBACK]` report, refuse to proceed until resolved.** Not a polite question — a stop-work order.

**Triggers:**

1. **Ambiguity** — task has more than one reasonable interpretation.
2. **Dead-UI risk** — control surface for a feature with no bot consumer.
3. **Schema conflict** — field / collection names in request don't match current DB shape.
4. **Raw-JSON smell** — request would expose a JSON editor to owner.
5. **Scope creep** — one-sentence request that touches 3+ clusters.
6. **Removed-feature reference** — assumes a feature that was deleted.
7. **Self-hype smell** — Claude's own draft plan uses "stunning/extraordinary/world-class/next-level" without specifics → auto-reject and rewrite before posting.
8. **Destructive to prod** — touches live Railway-shared MongoDB collections consumed by bots.
9. **Unverified claim** — request cites a file/function/feature Claude can't confirm exists.
10. **Missing context** — needs info Claude can't derive alone ("fix the broken one" when multiple candidates exist).
11. **Architecture violation** — contradicts a core rule (no raw JSON for owners, no client-side IP, TEST-first for bot code, etc.).

#### Phase 1 — PRE-FLIGHT (always)

Mandatory 13-step sequence. Each must complete or produce explicit "not applicable."

**Load context (in order):**

1. Read `~/CLAUDE.md`.
2. Read project-level `CLAUDE.md` (if present in current repo).
3. Read relevant auto-memory entries for the target area (`project_v2_dashboard.md`, `railway_dashboard_safeguard.md`, `feedback_dashboard_bot_sync.md`, `feedback_shared_mongodb.md`, `feedback_validation_keys.md`, `feedback_config_pipeline.md`, etc.).
4. Read cross-cutting memories referenced by the target's location.

**Scan for reuse (forbidden to duplicate):**

5. Grep `src/app/admin/v2/_components/` (or project equivalent) for primitives that could handle part of the task.
6. Grep `src/app/api/admin/` + `src/app/api/admin/v2/` for endpoints already serving the data.
7. Grep `src/lib/admin/` for helper functions.

**Existence check (Abilities-for-Brimor gate):**

8. If task controls a bot feature → grep Butler / Jester / Oracle / Sage source for the consumer. No consumer found → **auto-escalate STOP**.

**State check (Zoldar-empty gate):**

9. If task renders a collection or config → read current state via `mcp__mongodb__find` / `collection-schema` or server-side helper. Page cannot render "empty" unless proven empty.

**Impact scan (Charitable Complexity):**

10. Identify related v2 / admin pages that share primitives, styles, or APIs with the target.
11. Identify shared MongoDB collections any mutation will touch (`users`, `points`, `nemesis`, `bot_config`, transaction logs).
12. Identify Railway prod consumers — dashboard is LIVE; schema changes are prod risk.
13. Identify v1 duplicates in `/admin/` (or equivalent legacy path) that may drift.

**Red-flag tripwires** (auto-escalate to hard-stop):

- DB state doesn't match expected shape from memory.
- Any Phase 0 trigger that surfaces retroactively.
- More than one reasonable consumer for a schema change.
- Unclear whether bot-side changes are required.

Phase 1 ends with a `[PRE-FLIGHT]` report: loaded files, reuse candidates, existence/state check results, impact scan findings.

#### Phase 2 — PLAN (hard-stop gate)

Post a 12-section Plan inline in chat. User replies with `approve` / `reject: <reason>` / `amend: <change>`.

1. **Task restatement** — one sentence, Claude's own words, no hype language.
2. **Scope contract** — every file, component, API route, CSS block, Mongo field that will change.
3. **Out of scope** — every file / feature near the target that will NOT change despite proximity.
4. **Reuse list** — primitives, APIs, helpers being reused with exact paths.
5. **New surfaces** — anything created from scratch; each justified with "reuse-option-X didn't fit because Y."
6. **Data flow** — read path → transform → write path, with shape at each step.
7. **Bot-side impact** — `none` / `required-now` / `deferred-to-BOT_CHANGES.md`, with snippets + file paths.
8. **Shared Mongo risk** — collections touched + Railway prod implication (reference `railway_dashboard_safeguard` checklist when live collections are involved).
9. **Verification plan** — exact commands, URLs, clicks, MCP calls that will prove success in Phase 5.
10. **Rollback path** — for destructive / stateful ops, the `undo.push` wire-up or DB restore approach.
11. **Risks & unknowns** — honest list; "I don't know" is valid and required when true.
12. **Size estimate** — small (≤5 files, ≤200 LOC) / medium (≤15 files, ≤800 LOC) / large (more — triggers sub-task decomposition).

**Auto-escalation triggers** (force sub-task split before asking user):

- Size estimate = large.
- More than 3 new surfaces (§ 5).
- Bot-side impact = `required-now` on more than one bot.
- Any blocker risk in § 11.

#### Phase 3 — IMPLEMENT

Rules below are universal principles. Any layer (e.g. v2 Dashboard § 5) binds them to specific primitives and file paths.

1. **No mid-flight scope expansion.** New need discovered → halt, escalate.
2. **Reuse tripwire.** If caught writing something that already exists in the project's primitive catalog → stop, delete, use the existing one.
3. **Mutation discipline.** Every mutation follows the project's defined mutation pattern (for v2 Dashboard: `pending.queue()` → API call → `toast.show()` → `undo.push()` — see § 5.2). Skipping any required step = Phase 4 reject.
4. **Design tokens only.** Use the project's CSS token system exclusively. No inline hex or stray framework utilities.
5. **No raw-JSON editor in owner-facing code.** Use the project's structured editing primitive (for v2: `StructuredEditor`).
6. **No hype language in UI strings or comments.** "Stunning / extraordinary / world-class / next-level" banned.
7. **No emoji in code files.** Emoji in UI strings only if user explicitly specified.
8. **Image fallbacks required.** Every `<img>` / background handles 404 via `onError` + placeholder OR defers render until URL confirmed healthy.
9. **Empty states only after DB proof.** Failed fetch → show error, not empty state.
10. **No hardcoded registries.** Game / vendor / bot / channel / role lists derive from runtime source (DB / config / API).
11. **Types compile after each significant change.** Incremental `pnpm typecheck` at logical checkpoints.
12. **No narration.** Terse status updates only.

#### Phase 4 — SELF-REVIEW

Before Phase 5. Claude audits its own diff. Any fail → escalate, don't paper over.

Checks:

1. **Diff vs scope contract.** Every file in diff MUST appear in Plan § 2. Extra file → drift, halt.
2. **Out-of-scope honored.** Every item in Plan § 3 confirmed untouched.
3. **Reuse confirmation.** For each new component: re-grep `_components/` to prove nothing similar exists.
4. **Action-flow present** on every mutation handler. Enumerate them explicitly.
5. **Raw-JSON scan.** No raw JSON leak in any new page.
6. **Hype-language grep.** Banned words absent from comments + UI strings.
7. **Image-fallback check.** Every new `<img>` has fallback.
8. **Empty-state gate.** Every new list has DB-proof branch.
9. **Hardcoded-registry scan.** Any literal array defining games/vendors/bots/channels gets flagged.
10. **Comment audit.** Any comment explaining WHAT (not WHY) gets deleted.

Output: `[SELF-REVIEW]` report listing each check with pass/fail/evidence.

#### Phase 5 — VERIFY (terminal)

"I ran X" without output is rejected. Every claim needs pasted or linked evidence.

Mandatory evidence set:

- `pnpm typecheck` — last ~10 lines pasted, zero errors.
- `pnpm build` if API routes changed — success confirmation.
- Page-load proof via `mcp__playwright__browser_navigate` + `browser_snapshot` showing expected elements.
- API-hit proof for new/changed routes — call via `WebFetch` or `browser_evaluate` fetch, confirm shape.
- DB-state proof after mutation — `mcp__mongodb__find` read showing expected state.
- Undo proof — trigger undo, verify state reverts via another Mongo read.
- **Charitable Complexity side-effect sweep** — load one nearby page to prove no regression from shared-primitive drift.

Final verdict: literally the token `VERIFIED` or `BLOCKED: <reason>`. No hedging ("mostly working", "should be fine").

### 4.4 Gate Model C

Hard-stops at Phase 0 (if triggered) and Phase 2. Phases 1 / 3 / 4 / 5 auto-proceed with reports unless a red flag auto-escalates. Quiet when healthy, loud when broken.

### 4.5 Voice Rules

**Banned hype tokens** (grep-check in Phase 4):
> stunning, extraordinary, world-class, next-level, cutting-edge, revolutionary, seamless, robust, comprehensive, powerful, game-changing, best-in-class, beautifully-crafted, delightful, magical, blazing-fast, state-of-the-art

**Banned narration phrases** (chat only):
> "Let me…", "I'll now…", "Great!", "Perfect!", "Excellent!", "Absolutely!", "Sure thing!", "Happy to help"

**Banned hedging** (chat only — replace with either a pass or a `BLOCKED` verdict):
> "should work", "probably fine", "looks good", "mostly done", "nearly there"

**Positive rules:**
- Concrete over grand — describe the mechanism, not the vibe.
- Evidence over claim — numbers, paths, line refs.
- Terse updates; one-sentence status between tool calls.

### 4.6 Input Format

Free-form natural language. Ambiguity / missing info → Phase 0 pushback (trigger 1 or 10).

**Optional lightweight hints** (ignorable; Claude still does pre-flight):
- `--no-bot-touch` — user asserts pure dashboard scope.
- `--priority=high` — surfaces in Plan; does not skip phases.

### 4.7 Output Format Markers

```
[PUSHBACK]            (Phase 0, only if triggered)
[PRE-FLIGHT]          (Phase 1, always)
[PLAN]                (Phase 2, hard-stop gate)
[CHECKPOINT n/N]      (Phase 3, silent unless red flag)
[SELF-REVIEW]         (Phase 4, always)
[VERIFY]              (Phase 5, always — terminal)
```

No emoji in markers or code. Terminal verdict is `VERIFIED` or `BLOCKED: <reason>`.

---

## 5. v2 Dashboard Layer (§ 3)

Lives in `Luna-Fantasy-Main/CLAUDE.md`. Activates on top of the Universal Protocol when any of 7 triggers match.

### 5.1 Activation Triggers

1. Touches any file under `src/app/admin/v2/**`.
2. Mentions "v2 dashboard", "the dashboard", "admin v2", `/admin/v2`.
3. New owner-facing control surface in this repo.
4. Described as "like v2" / "same layout as v2" / "owner dashboard" / "admin control panel".
5. Bug or polish on any existing v2 page (Shops, Games, Cards, Stones, Users, Economy, Passports, Leveling, Bot Config, Settings, Inbox, Challenges, Commands, Info, Media, Announce, Logging, Sage, Oracle, Audit, Ops, Activity).
6. Touches `src/app/admin/v2/_components/**` primitives.
7. Touches any `src/app/api/admin/v2/**` route.

Ambiguous match → Claude asks once: *"This looks like v2-protocol territory — apply the full v2 layer, or treat as normal?"*

### 5.2 Layer-Specific Rules

On top of the Universal Protocol:

- **Auth contract**: `requireMastermindApi()` on every new API route. No exceptions.
- **No raw-JSON for owners** — `StructuredEditor` or button-driven surfaces.
- **Mutation action-flow (mandatory)**: `pending.queue()` → API call → `toast.show()` → `undo.push({ label, revert })`.
- **Reuse the primitive catalog first** — catalog: `PeekProvider`, `CmdK`, `ContextMenu`, `UndoProvider`, `PendingActionProvider`, `InlineEdit`, `BulkSelect`, `StructuredEditor`, `Toast`, `GuildDataProvider`, `ChannelPicker`, `RolePicker`, `ChannelChips`, `RoleChips`, `Skeleton`, `Sparkline`, `Counter`, `HourlyBars`, `RatioMeter`, `JsonDiff`, `Tooltip`, `SpotlightCursor`, `ErrorBoundary`. Duplicating = violation.
- **Design tokens only** — `--av-*` vars; rank tones from `src/lib/admin/ranks.ts`; rarity tones from `src/lib/admin/cards-v2-types.ts`; vendor + bot tone palettes.
- **Mosaic bleed-through rule** — any new card surface uses `backdrop-filter: blur()` + opaque background ≥ 95%.
- **Page layout contract (vendor-style)** — tab-cards row on top → hero with portrait + title + description → content area with wrapper class. New owner pages follow this unless justified.
- **Image fallback rule (Brimor gate)** — every `<img>` / background has `onError` fallback OR defers render until URL confirmed.
- **Empty-state gate (Zoldar gate)** — list surfaces read current DB before rendering "No X yet."
- **No hardcoded registries (Magic Bot gate)** — lists derive from `bot_config` / runtime source.
- **Dead-UI gate (Abilities gate)** — before building a control surface, grep bot source for a consumer. Zero consumer → STOP + report.
- **Shared-Mongo risk (Railway gate)** — writes to `users`, `points`, `nemesis`, `bot_config`, transaction collections must reference `railway_dashboard_safeguard` checklist in Plan § 8.
- **Bot-side deferral** — bot work deferred to `docs/BOT_CHANGES.md` when Plan § 7 = `deferred`. Dashboard ships first; bot follows via TEST-first path.

### 5.3 Gotcha Pocket

Inline reminders for Claude during pre-flight:

- `lunari_transactions` uses `createdAt` NOT `timestamp`.
- `admin_audit_log` uses `timestamp` (opposite of lunari_transactions).
- Stones source of truth: `bot_config._id="jester_moon_stones".data`.
- Cards source of truth: `cards_config` collection, `_id: RARITY`, SPECIAL folded into SECRET.
- `getUserRank()` hits Discord API live (5-min cache).
- SSR/client split: types-only files must be separate from mongodb-importing files (see `cards-v2-types.ts` split).
- `.av-surface` default padding applies via exact-class match only — wrapper classes set their own.

---

## 6. Portable Template (§ 4)

Lives at `~/.claude/templates/owner-dashboard-protocol.md`. Never auto-loaded. Pure reference for copy-paste into future projects with the same owner-dashboard layout.

### 6.1 Contents

1. Full 6-phase protocol (copy of Universal Protocol in § 4).
2. Owner-dashboard layer (copy of § 5 minus Luna-specific lore — primitives, tokens, rules, with placeholders like `<PROJECT_DASHBOARD_ROOT>`, `<PROJECT_COMPONENTS_PATH>`, `<PROJECT_API_PREFIX>`).
3. Activation trigger template (7 triggers, parameterized on new project's dashboard path).
4. Fill-in checklist at top:
   - `[ ]` Project dashboard root (e.g. `src/app/admin/v2`)
   - `[ ]` Primitives folder
   - `[ ]` API prefix
   - `[ ]` Shared MongoDB collections
   - `[ ]` Bot-consumer list
   - `[ ]` Design token prefix (e.g. `--av-*`, `--dash-*`)
   - `[ ]` Page layout convention (tab-cards → hero → content? other?)

---

## 7. Rollout Plan

Four file operations after approval:

1. **Append to `C:\Users\Admin\CLAUDE.md`** — "## Universal Engineering Protocol" section (~150 lines), inserted after the Rules block and before the "Luna Project Bible" block.
2. **Append to `C:\Users\Admin\Desktop\Luna Bot\Luna-Fantasy-Main\CLAUDE.md`** — "## v2 Dashboard Layer" section (~200 lines), including 7 activation triggers, layer rules, gotcha pocket.
3. **Create `C:\Users\Admin\.claude\templates\owner-dashboard-protocol.md`** — portable template (~350 lines including fill-in checklist).
4. **Create `C:\Users\Admin\Desktop\Luna Bot\Luna-Fantasy-Main\docs\superpowers\specs\2026-04-17-v2-task-protocol-design.md`** — this design doc.

### 7.1 Verification

- Re-read all four files; diff each against this design.
- Confirm root CLAUDE.md and project CLAUDE.md parse cleanly (no malformed markdown).
- No code changes — protocol infrastructure only. Real verification is the next task session using the protocol.

---

## 8. Failure Modes Addressed

Mapping of the 16 observed failure modes to protocol countermeasures:

| # | Failure | Countermeasure |
|---|---|---|
| 1 | Reinventing primitives | Phase 1 step 5 (grep `_components/`), Phase 3 rule 2 (reuse tripwire), Phase 4 check 3 (reuse confirmation) |
| 2 | Half-baked done claims | Phase 5 mandatory evidence + binary verdict (`VERIFIED` \| `BLOCKED`) |
| 3 | Schema/API drift | Phase 1 steps 1-4 + 9 (state check), gotcha pocket |
| 4 | Visual regressions | Phase 3 rules 4-5, v2 layer mosaic + token rules |
| 5 | Over-scoping | Phase 2 § 3 out-of-scope contract, Phase 3 rule 1, Phase 4 check 1 (diff vs scope) |
| 6 | No verification | Phase 5 mandatory evidence set |
| 7 | Tonal drift | Voice Rules § 4.5 + Phase 4 check 6 (hype grep) |
| 8 | Forgotten APIs | Phase 1 step 6 (grep `api/admin/`) |
| 9 | Context amnesia | Phase 1 steps 1-4 (load context) |
| 10 | Rendering over broken data | Phase 3 rule 8 (image fallbacks), Phase 4 check 7, v2 § 5.2 Brimor gate |
| 11 | UI for nonexistent backend | Phase 1 step 8 (existence check), Phase 0 trigger 2 |
| 12 | Empty state over populated data | Phase 1 step 9 (state check), Phase 3 rule 9 |
| 13 | Hardcoded registry drift | Phase 3 rule 10, Phase 4 check 9 |
| 14 | Raw-JSON leak | Phase 0 trigger 4, Phase 3 rule 5, Phase 4 check 5 |
| 15 | Grand-promise generic-delivery | Voice Rules + Phase 0 trigger 7 (self-hype smell) |
| 16 | Nod-and-execute | Phase 0 pushback triggers 1-11 + refuse-to-execute semantics |

---

## 9. Risks & Open Questions

- **Ceremony tax on medium tasks.** Six phases for a single-page edit may feel heavy. Mitigation: Phases 1/3/4/5 auto-proceed under gate model C; only Phase 2 plan approval is routine user friction. If this still feels heavy after a few real-world runs, revisit with a carved-out "medium-task" path.
- **Self-hype self-reject reliability.** Phase 0 trigger 7 depends on Claude recognizing its own hype language before posting. Grep-check in Phase 4 catches it downstream but at higher cost.
- **Gate model C's "auto-escalate on red flag" edge cases.** Which red flags mid-Phase-3 escalate vs. are handled silently? Plan is to default to escalate-on-uncertainty; refine after first few tasks surface real patterns.
- **Protocol creep into the wrong sessions.** If the Universal Protocol ends up too heavy for simple bot tweaks (Butler one-line fixes), revisit scope § 4.1.

---

## 10. Approvals

- Design approved by owner: 2026-04-17 (section-by-section, five sections).
- Implementation plan: produced next via writing-plans skill.
