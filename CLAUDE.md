# Luna Fantasy — Project Instructions

## Bot Reference Documentation

Before implementing or modifying any feature that touches economy, cards, stones, tickets, banking, games, or shared MongoDB data, **always** read the relevant reference docs first:

- `.plans/reference/luna-butler.md` — LunaButler bot: economy, banking, XP/levels, config values, earning/spending sources
- `.plans/reference/luna-jester.md` — LunaJester bot: cards, stones, vendors (Kael/Meluna/Zoldar/Seluna), games, trading
- `.plans/reference/shared-data.md` — Shared data layer: collection schemas, BSON types, write patterns, concurrency, price tables

These docs contain the exact values, schemas, and behaviors from the bot codebases. Do not guess or assume prices, collection formats, reward amounts, or game mechanics — look them up in the references.

### When to check references

- Adding or modifying any bazaar/vendor feature → check luna-jester.md for vendor prices and mechanics
- Touching `points`, `tickets`, `cards`, `stones`, or `system` collections → check shared-data.md for schemas and write patterns
- Working with Lunari operations (credit, debit, balance) → check shared-data.md for concurrency patterns and string-data fallbacks
- Adding new game integrations or reward displays → check luna-jester.md for game rewards and luna-butler.md for economy values
- Modifying banking, loans, debt, or investment features → check luna-butler.md for exact tiers, rates, and durations
- Working with XP, levels, or role rewards → check luna-butler.md for formulas and role IDs
