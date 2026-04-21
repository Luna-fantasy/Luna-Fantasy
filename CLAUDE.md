# Luna Fantasy — Project Instructions

> **RSS Version**: 1.3 | **Last updated**: 2026-04-13
> **Parent config**: `~/CLAUDE.md` (read that first for ecosystem context)

## Overview

Next.js 14 (App Router) website for the Luna ecosystem at `lunarian.app`.
Admin dashboard, bazaar (shops/trading), economy overview, user profiles.
Shares MongoDB Atlas ("Database") with LunaButlerMain and LunaJesterMain bots.

## Commands

```bash
pnpm run dev        # next dev
pnpm run build      # next build
pnpm run typecheck  # tsc --noEmit
```

## Bot Reference Documentation

Before implementing or modifying any feature that touches economy, cards, stones, tickets, banking, games, or shared MongoDB data, **always** read the relevant reference docs first:

- `.plans/reference/luna-butler.md` — LunaButler bot: economy, banking, XP/levels, config values, earning/spending sources
- `.plans/reference/luna-jester.md` — LunaJester bot: cards, stones, vendors (Kael/Meluna/Zoldar/Seluna), games, trading
- `.plans/reference/shared-data.md` — Shared data layer: collection schemas, BSON types, write patterns, concurrency, price tables

### When to check references

- Adding or modifying any bazaar/vendor feature → check luna-jester.md for vendor prices and mechanics
- Touching `points`, `tickets`, `cards`, `stones`, or `system` collections → check shared-data.md for schemas and write patterns
- Working with Lunari operations (credit, debit, balance) → check shared-data.md for concurrency patterns and string-data fallbacks
- Adding new game integrations or reward displays → check luna-jester.md for game rewards and luna-butler.md for economy values
- Modifying banking, loans, debt, or investment features → check luna-butler.md for exact tiers, rates, and durations
- Working with XP, levels, or role rewards → check luna-butler.md for formulas and role IDs

## Key Architecture

### Transaction System (added 2026-03-12)

Three MongoDB collections for transaction logs:
- `lunari_transactions` — Lunari economy (purchases, daily, loans, trades, games)
- `cards_transactions` — Card operations (pulls, luckboxes, sells, auctions, swaps, gifts)
- `stones_transactions` — Stone operations (chests, sells, auctions, swaps, gifts)

**Sources**: Both bots write with `source: 'discord'`, website writes with `source: 'web'`

Key files:
- `src/lib/bazaar/lunari-ops.ts` — `logTransaction()` routes records to correct collection, sends Discord embeds for web transactions
- `src/lib/admin/discord-logger.ts` — Sends embeds to Discord log channels for web-originated transactions
- `src/app/api/webhooks/transactions/route.ts` — Webhook receiver for external integrations (timing-safe API key auth)

### Admin Dashboard

- `src/app/admin/` — Admin pages (promoted from v2 on 2026-04-19; v1 UI deleted)
- Protected by `requireMastermindApi()` from `src/lib/admin/auth.ts`
- Rate limited via in-memory sliding window (`src/lib/bazaar/rate-limit.ts`)
- Styles in `src/styles/admin-v2.css` — vendor-style av-* primitives, aurora/constellation backdrops

### Security Patterns

- CSRF: `validateCsrf(req)` from `src/lib/bazaar/csrf.ts` — required on all mutation endpoints
- Rate limiting: `checkRateLimit(key, id, limit, windowMs)` — in-memory sliding window
- Auth: `requireMastermindApi()` for admin routes, timing-safe comparison for webhooks
- Input sanitization: regex metacharacters escaped before constructing RegExp, metadata sanitized (no `$` or `.` keys)
- Discord embeds: `escapeDiscord()` strips @mentions to prevent injection

### Economy Config

- `src/lib/bank/bank-config.ts` — canonical source for daily reward amounts, VIP bonuses, etc.
- `DAILY_BASE = 4_000`, `DAILY_VIP_BONUS = 2_000`
- Frontend components should import from config, not hardcode values

## Deployment

Website is deployed on **Railway** (https://railway.app).

- **Auto-deploy**: Pushing to git triggers an automatic Railway build and deploy
- **No staging**: Every push goes straight to production — be careful
- **Environment variables**: Configured in Railway dashboard (NOT in `.env.local` for production)
  - 15 env vars already configured
  - 7 env vars pending manual entry: `ORACLE_BOT_TOKEN`, `TRANSACTION_WEBHOOK_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- **Local development**: Uses `.env.local` for local env vars (gitignored)

### Deployment Checklist

Before pushing changes that go to production:
1. Run `pnpm run build` locally — verify no build errors
2. Run `pnpm run typecheck` — verify no type errors
3. If you changed any API route, verify CSRF protection is still in place
4. If you changed any MongoDB query patterns, verify they match what Butler/Jester write
5. If you added new env vars, tell the user to add them in Railway dashboard first

### Passport System (updated 2026-04-13)

- **Passport variants**: Normal (1004x762), VIP (1518x1018), Staff: Guardian/Sentinel/Mastermind (1536x1024)
- **Staff detection**: `passport.staffRole` field OR inferred from `passport.number` (GUARDIAN/SENTINEL/MASTERMIND)
- **Priority**: Staff > VIP > Normal — staff check is pure data (no Discord API call), VIP skipped for staff
- **Canvas editor**: 10 passport canvas definitions (normal/vip/guardian/sentinel/mastermind × bot/web)
- **Dashboard config**: `/admin/passport` → "Staff Passport Cosmetics" section → role pickers for each staff type
- **Profile rendering**: `ProfileContent.tsx` selects template/badge/glow by variant. Badge colors: Mastermind=purple, Sentinel=gold, Guardian=deep blue
- **API validation**: Passport number regex accepts `LUNA-110317#####` and `GUARDIAN`/`SENTINEL`/`MASTERMIND`
- **Passport list API**: Constructs full CDN avatar URLs from `discord_users` avatar hashes

### Bazaar Passport Discount (added 2026-04-13)

- All 6 bazaar shops apply 10% passport discount server-side via `getPassportDiscount()` from `src/lib/bazaar/passport-discount.ts`
- Client shows discount via `<PassportPrice>` component (cyan discounted + strikethrough original + gold -10% pill)
- `hasPassport` flag sent via catalog API → all vendor components
