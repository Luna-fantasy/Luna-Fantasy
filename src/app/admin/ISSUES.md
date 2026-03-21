# Admin Dashboard — Known Issues

## To Fix After All Phases

1. **Card removal "Card not found"** — CSRF was not initialized (now fixed), but card ID matching may still fail for some cards. Need to test after CSRF fix. If still broken, investigate card ID format mismatches between DB and frontend.

2. **Audit Log page** — Needs verification once admin write actions start populating `admin_audit_log`. Schema/query may need adjustment.

## Fixed

- Lunari in Circulation showed 0 — was aggregating non-existent `$data` field, fixed to use `$balance`
- Bank Reserve showed 0 — was querying `{ id: 'bank_reserve' }`, fixed to `{ _id: 'luna_bank_reserve' }` with `value` field
- Emoji icons showed as `\u{...}` text — fixed unicode escapes in JSX
- Admin layout nested html/body broke CSS — removed, now renders inside root layout
- CSRF cookie not initialized — added `AdminCsrfInit` client component
- Inventory read wrong field — was `doc.data`, fixed to `doc.items`
- Cards/Stones read wrong field — was `doc.data`, fixed to `doc.cards`/`doc.stones`
