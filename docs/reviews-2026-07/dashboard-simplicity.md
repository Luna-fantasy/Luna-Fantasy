# Dashboard Simplicity / IA Audit — Findings

## Current page → data edit map

35 pages (34 routes + `users/[discordId]`), 33 nav items in 7 clusters (`src/app/admin/_components/nav-config.ts`).

| Page | Writes (collection → doc) | Notes |
|---|---|---|
| `/admin` (Dashboard) | read-only | overview stats |
| activity | read-only (`admin_actions`/tx feeds) | |
| analytics | read-only | |
| schedule | read-only (aggregates challenges + Seluna + events) | |
| audit | read-only (`admin_actions`) | |
| users, users/[id] | `points`, passports, DM queue via `/api/admin/users/*`, `/api/admin/dm` | |
| economy | `bot_config` → `butler_economy` (daily/salary/investor) | also read-only holders/flows/simulator |
| banking | `bot_config` → `butler_banking` + reserve ops; also fetches `economy/config` | |
| leveling | `bot_config` → butler leveling sections via `config/butler` | |
| badges | `bot_config` → `butler_badge_thresholds`, `butler_badges_visuals` + R2 upload | |
| passports | `bot_config` (`applications_system` section) + `passports` via `v2/passports` | |
| watchlist | `watchlist` | |
| cards | `cards_config`, `cards`, `luna_pairs_config`, `bot_config.jester_game_settings` via `cards/config` | holders drawer → Peek |
| stones | **triple-write**: `bot_config.jester_moon_stones` + `stones_config.regular/forbidden` + `vendor_config.stonebox` (one PUT syncs all 3) | |
| shops — generic tabs | `vendor_config` → `brimor`, `broker`, `mells_selvair`, `luckbox` (Kael) via `/api/admin/vendors` | |
| shops — Zoldar tab | `vendor_config` → `_id:'tickets'` | |
| shops — Meluna tab | `vendor_config` → `_id:'stonebox'` **only** (price, refund, `stones[]` with weight/sell_price) | |
| shops — Seluna tab | `seluna_vendor` (+ reads `cards_config`, `jester_moon_stones`, `mells_selvair`) | |
| shops — Trading panel | `bot_config` jester trade sections via `config/jester` | |
| games | `bot_config` → `butler_games`, `butler_baloot`, `jester_game_settings`, `jester_points_settings`, **`jester_commands`** (stop-command) via `v2/bot-config` | |
| commands | `bot_config` → **`jester_commands`**, `butler_auto_reply`, `butler_auto_images` | |
| challenges | `challenges` + `bot_config.hall_of_fame` + texts/templates | uses StructuredEditor (auto-prettified raw keys) |
| inbox | tickets/applications | |
| characters | `characters` (full CRUD) | |
| website | **`characters`** (lore edits) + `translation_overrides` via `content/save`; live-site editMode links | |
| site-tabs | `bot_config` (site tabs doc) | |
| media | `bot_config` → `butler_canvas_layouts`/`jester_canvas_layouts` + R2 browse/upload | |
| info | `partners`, `bot_config.footer_config`, Luna map via `shop-config` | |
| notifications | `bot_config` → butler `notifications` section (DM templates) | |
| dm | DM send queue | |
| announce | Oracle announce | |
| voice | `bot_config` → `oracle_vc_*` (6 docs) + music | |
| sage | `bot_config` → `sage_*` (4 docs) + live-chat config/memories | |
| logging | `bot_config` → `butler_channels`, `butler_tickets`, `butler_applications`, `jester_channels`, `oracle_vc_setup` (channel-ID fields cherry-picked from 5 docs) | |
| ops | PM2/server/deploy status + deploy trigger | |
| deploy | deploy trigger + live stepper (same VPS agent) | |
| settings | read-only env-var checklist | |

## TOP OPPORTUNITIES (ranked)

**1. Stone data has two editors with different write scopes — silent desync risk. [M]**
Evidence: `stones/config/route.ts:161-190` deliberately syncs 3 stores ("write moon_stones to ALL collections the bot reads from"); `shops/meluna/route.ts:129-151` writes the same logical `stones[]` (weight, sell_price) into `vendor_config.stonebox` **only**. Jester reads box drops from `vendor_config.stonebox.data.stones` (`vendor_config_db.ts:202-207`) but other paths read `stones_config` (`stones_config_db.ts:22-32`). An admin editing weights in the Meluna tab leaves `stones_config`/`jester_moon_stones` stale; editing in Stones overwrites Meluna's list. Zero cross-links between the two surfaces (grep confirmed). Fix: make Stones page the single owner of the stone list; Meluna tab keeps only box price/refund/portrait and links to Stones.

**2. Vendor triple-identity naming (meluna↔stonebox, zoldar↔tickets, Kael↔luckbox). [S-M]**
Evidence: `vendor-registry.ts` labels `luckbox:'Kael Vandar'`, `stonebox:'Stonebox'`; `SPECIAL_OWNED_IDS = ['tickets','stonebox']` hides those docs from generic tabs; audit action is `meluna_stonebox_update`. An admin reading the audit log sees "stonebox" for a Meluna edit; a dev-doc reader sees three names for one shop. Fix: canonical display-name map used everywhere (audit labels included); long-term migrate `_id`s (`tickets`→`zoldar`, `stonebox`→`meluna`) with bot fallback reads.

**3. `jester_commands` edited from two pages. [S]**
Evidence: `games/GamesClient.tsx:231-256` patches `jester_commands.stop`; `commands/CommandsClient.tsx:137` patches the whole `jester_commands` doc. Last-save-wins across pages; an admin can't know the stop-word lives in both. Partial mitigation exists (commands links to Games, `JesterTriggersPanel.tsx:90`). Fix: one owner (Commands), Games shows read-only chip + link.

**4. Characters edited in two places. [S]**
Evidence: `/admin/characters` does full CRUD on `characters`; `/admin/website` → Characters tab (`website/CharactersPanel.tsx:135-151`) edits the same collection through a different route (`content/save`, `translation_overrides`). Two save paths, two validation layers, no cross-link. Fix: fold the Website characters tab into `/admin/characters` (or vice versa) — one editing surface.

**5. Content cluster sprawl: 7 pages, 3 distinct jobs. [M]**
Characters / Site Tabs / Media / Website / Info / Notifications / DM. "Notifications" is actually Butler DM **templates** (`config/butler` section `notifications`) while "DM" is a send tool — related, separate pages, no link. Site Tabs + Info + Website are all "public site content." Fix: merge to **Site** (tabs: Pages/editMode, Characters, Info/Partners/Footer, Site Tabs) and **Messaging** (tabs: Send DM, Templates, Announce).

**6. Ops / Deploy / Settings are one "System" page split in three. [S]**
Evidence: ops subtitle "bot processes, deployments, and server health"; deploy is the same VPS agent with a stepper (`/api/admin/deploy` used by both); settings is a read-only env checklist full of dev jargon (`NEXTAUTH_URL`, `R2_ACCESS_KEY_ID` — `settings/page.tsx:14-44`) that a zero-dev admin can't act on. Fix: one **System** page — Bots tab (PM2 + deploy button per bot with stepper), Health tab, Integrations tab (env checklist reworded as "Discord login: OK / Storage: OK", details collapsed).

**7. Overview cluster: 4 read-only dashboards with overlapping feeds. [M]**
Dashboard shows recent transactions + hourly activity; Activity is the full feed; Analytics repeats economy/game charts; Schedule is a 30-day timeline; Audit is a fifth read-only log under a different cluster. An admin has 5 places to "see what happened." Fix: Dashboard + one **Explore** page with tabs (Activity, Analytics, Schedule, Audit) — or at minimum move Audit next to Activity.

**8. Money settings split across Economy and Banking with cross-reads. [S]**
Evidence: banking page fetches both `banking/config` and `economy/config` (`banking` grep); economy page edits daily/salary/investor; loans summary lives on economy page (`LoanSummaryCard`) while loan tuning lives on banking. Fix: single **Economy** page with tabs (Overview, Rewards, Bank & Loans, Simulator) — or move LoanSummaryCard to Banking and cross-link.

**9. Challenges detail still exposes raw-key StructuredEditor. [S]**
Evidence: `StructuredEditor` (only consumer: `challenges/ChallengeDetail.tsx`) renders auto-prettified raw config keys — better than JSON but still shows whatever key names exist ("Anti Alt Min Account Age Days"-style), violating the no-jargon bar met elsewhere (Games: "Every value is a button, no JSON"; Logging has per-field help text). Fix: schema-driven fields like `games/game-schema.ts`.

**10. Seluna editor requires tribal knowledge of three other catalogs. [M]**
Evidence: `shops/seluna/route.ts` reads `cards_config`, `bot_config.jester_moon_stones`, and `vendor_config.mells_selvair` to resolve item images/prices; the editor doesn't link to Cards/Stones/Shops pages where those items are defined, and the admin_queue single-doc handoff (known backlog) means a save can silently be dropped within Jester's 30s poll. Fix: item pickers that deep-link to the source catalog + a delivery-confirmed status pill.

## Proposed target IA (33 nav items → ~19)

**Home** — Dashboard | **Explore** — Activity · Analytics · Schedule · Audit (tabs)
**Players** — Users (+detail) · Passports · Watchlist
**Money** — Economy (Overview · Rewards · Bank & Loans · Simulator)
**Collection** — Cards · Stones (sole stone-list owner) · Valecroft
**Shops** — one page, per-vendor tabs (Kael · Brimor · Broker · Mells · Zoldar · Meluna[box-settings only] · Seluna · Trading), canonical names everywhere
**Play** — Games · Challenges · Commands (sole `jester_commands` owner) · Leveling · Badges
**Messaging** — Send (DM + Announce) · Templates (notifications)
**Staff** — Inbox
**Bots** — Sage · Oracle · Logging
**Site** — Pages/editMode · Characters (single editor) · Info/Partners/Footer · Site Tabs · Media
**System** — Bots & Deploy · Health · Integrations (humanized env status)

Biggest wins for "peak simple": #1/#2 (kills the meluna/stonebox split-brain), #5/#6 (10 pages → 3), #3/#4 (single-owner rule for every Mongo doc — enforceable as a lint: no doc `_id` may appear in write paths of two page dirs).

Key files: `src/app/admin/_components/nav-config.ts`, `src/app/admin/shops/vendor-registry.ts`, `src/app/admin/shops/MelunaEditor.tsx`, `src/app/api/admin/shops/meluna/route.ts`, `src/app/api/admin/stones/config/route.ts`, `src/app/admin/games/GamesClient.tsx`, `src/app/admin/commands/CommandsClient.tsx`, `src/app/admin/website/CharactersPanel.tsx`, `src/app/admin/characters/page.tsx`.