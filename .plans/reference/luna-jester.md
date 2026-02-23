# LunaJester Bot Reference

> Card games, stone collections, trading, and vendor NPC bot for the Luna Discord server.
> Entry point: `/Users/fahedalahmad/Sites/Luna/LunaJester/index.ts`
> Discord library: Eris (intents: 37379, forceSingleShard: true)

---

## Project Structure

```
LunaJester/
  index.ts                           # Entry point
  config.ts                          # All config values (~2206 lines)
  commands/
    # Games
    roulette.ts                      # Roulette game
    rps.ts                           # Rock-Paper-Scissors
    bomb_roulette.ts                 # Bomb Roulette
    guess_the_country.ts             # Guess the Country
    mafia.ts                         # Mafia / Blood Moon
    fight.ts                         # Fight/Duel
    vote_game.ts                     # Vote game
    roulettetest.ts                  # Roulette test variant
    # Card Games
    LunaFantasy.ts                   # Luna Fantasy PvP duel
    LunaFantasyPull.ts               # Magic Bot pull
    LunaFantasyEvent.ts              # Luna Fantasy event mode
    GrandFantasy.ts                  # Grand Fantasy PvP card battle
    LunaPairs.ts                     # Luna Pairs faction war
    # Trading
    cards_trade.ts                   # Card trading/selling/auction
    stones_trade.ts                  # Stone trading/selling/auction
    # Vendors
    luckboxes.ts                     # Kael Vandar (card luckboxes)
    meluna_vendor.ts                 # Meluna (stone boxes)
    tickets_shop.ts                  # Zoldar (ticket packages)
    seluna_vendor.ts                 # Seluna (limited shop)
    seluna_admin.ts                  # Seluna admin controls
    shop.ts                          # General shop
    # Collections
    book.ts                          # Card book viewer
    tome.ts                          # Stone collection viewer
    chest.ts                         # Stone chest viewer
    # Utility
    gift.ts                          # Gift items to users
    event.ts                         # Event management
    magic_bot.ts                     # Magic Bot AI opponent
    # Slash command wrappers
    slash_duel.ts, slash_pull.ts, slash_vote.ts, slash_pairs.ts
    # Admin
    ticket_admin.ts                  # Ticket admin controls
    register_gift_command.ts         # Register gift slash command
  util/
    # Core
    database_helper.ts               # st.db wrapper
    points.ts                        # Lunari operations
    inventory.ts                     # Purchase records
    cards.ts                         # Card operations
    stones.ts                        # Stone operations
    tickets.ts                       # Ticket operations
    functions.ts                     # Shared utilities
    # Card/Stone
    card_helpers.ts                  # Card utility functions
    card_images.ts                   # Card image generation
    card_logger.ts                   # Card transaction logging
    stone_logger.ts                  # Stone transaction logging
    autocomplete_helpers.ts          # Autocomplete for commands
    # Game Management
    game_session_manager.ts          # Active game sessions
    game_state_persistence.ts        # Game state saving
    start_game.ts                    # Game initialization
    magic_wins.ts                    # Magic Bot win tracking
    magic_leaderboard_manager.ts     # Fantasy leaderboard
    magic_leaderboard_settings.ts    # Leaderboard config
    # Image Generation
    book_image.ts, tome_image.ts, chest_image.ts
    hand_image.ts, mafia_image.ts, roulette_image.ts
    rps_image.ts, luna_pairs_image.ts, winner_image.ts
    fantasy_leaderboard_card.ts
    image_worker_pool.ts, image_worker.ts
    # Performance
    batch_writer.ts, cache_manager.ts, bulk_operations.ts
    memory_monitor.ts, connection_health.ts
    interaction_queue.ts, interaction_helper.ts
    # Discord
    discord_agent.ts
    # Localization
    language_manager.ts, luna_map_translations.ts
```

---

## Database Collections

| Collection | Key Pattern | `data` Type | Operations |
|---|---|---|---|
| `cards` | `userId` | Array of card objects (JSON string or native array) | `get()`, `set()`, `push()` |
| `stones` | `userId` | `{stones: [...]}` (JSON string or native object) | `get()`, `set()` |
| `inventory` | `userId` | Array of purchase records | `push()`, `get()` |
| `points` | `userId` | number (SHARED with LunaButler + Web) | `get()`, `add()`, `subtract()`, `set()` |
| `tickets` | `userId` | number (SHARED with LunaButler + Web) | `get()`, `add()`, `subtract()` |
| `seluna_vendor` | various | mixed (shop state, stock) | `get()`, `set()` |
| `magic_wins` | various | win tracking data | `get()`, `set()` |
| `magic_leaderboard` | various | leaderboard entries | `get()`, `set()` |

### Card Record Schema
```typescript
{
  id: string,            // e.g. "CardName_1234567890_0"
  name: string,
  attack: number,
  rarity: "Common" | "Rare" | "Epic" | "Unique" | "Legendary" | "Secret" | "Forbidden",
  weight: number,
  imageUrl: string,
  source: string,        // rarity label used for luckbox tier
  obtainedDate: string,  // ISO timestamp
}
```

### Stone Record Schema
```typescript
{
  id: number,           // Date.now() + Math.random()
  name: string,
  imageUrl: string,
  acquiredAt: string,   // ISO timestamp
}
```

### Purchase Record Schema
```typescript
{
  id: string,
  name: string,
  price: number,
  shopId: string,
  purchaseDate: string,  // ISO timestamp
}
```

---

## Card System

### Rarities and Stats

| Rarity | Count | Attack Range | Weight Range | Notes |
|---|---|---|---|---|
| Common | 25 | 11-59 | 1-10 | Basic cards |
| Rare | 22 | 60-70 | 1-10 | Better stats |
| Epic | 23 | 70-90 | 0.5-10 | |
| Unique | 26 | 91-110 | 0.5-10 | "Luna" themed |
| Legendary | 25 | 110-550 | 0.1-10 | Wide weight variance |
| Secret | 40 | 1-1000 | 0.02-11 | Includes Bumper cards |
| Forbidden | 17 | 1-12 | 0 (all) | Admin-only, unobtainable from luckboxes |

### Notable Cards

| Card | Rarity | Attack | Weight | Notes |
|---|---|---|---|---|
| Ancient Dragon | Secret | 1000 | 0.03 | Highest attack |
| Dark Mastermind | Secret | 1000 | 0.02 | Ultra rare |
| Eclipse Dragon | Secret | 720 | 0.05 | |
| Prime Mastermind | Secret | 650 | 0.1 | |
| Hydra | Secret | 600 | 0.2 | |
| Abyssal Colossus | Legendary | 550 | 0.1 | |
| Cerberus | Secret | 500 | 0.3 | |
| Moon Serpent | Legendary | 500 | 0.1 | |
| Jester | Secret | 10-1000 | 1 | Random attack per draw |
| Bumper 1/2/3 | Secret | 1 | 11/10/9 | Very common Secret cards |

### Weighted Random Algorithm

Both bot and web use identical logic:
```typescript
// Each item gets Math.max(1, Math.round(weight * 1000)) entries in pool
// weight 20    -> 20,000 entries (very common)
// weight 0.05  -> 50 entries (very rare)
// weight 0     -> excluded (admin-only / Forbidden)
```

### Collection Completion Roles

| Rarity Complete | Role ID |
|---|---|
| Common | `1427746750180884542` |
| Rare | `1427746179671916686` |
| Epic | `1427746876769173584` |
| Unique | `1427746976589680640` |
| Legendary | `1427747155250249858` |
| Secret | `1427747447169482842` |
| ALL rarities | `1427759046697422859` ("Trickster!") |

---

## Stone System

### Moon Stones

| Stone | Weight | Sell Price | Drop % | Emoji ID |
|---|---|---|---|---|
| Lunar Stone | 20 | 500 | ~37.1% | `1458987974363713719` |
| Silver Beach Gem | 15 | 750 | ~27.8% | `1458988122216988857` |
| Wishmaster Broken Cube | 10 | 1,000 | ~18.6% | `1458988190361845872` |
| Dragon's Tear | 5 | 1,500 | ~9.3% | `1458987818842849331` |
| Solar Stone | 3 | 2,000 | ~5.6% | `1458988144530817210` |
| Galaxy Stone | 1 | 3,000 | ~1.9% | `1458987881413480489` |
| Stone of Wisdom | 0.5 | 5,000 | ~0.93% | `1458988167037452329` |
| Astral Prism | 0.2 | 7,500 | ~0.37% | `1458987670683389972` |
| Eternal Stone | 0.1 | 10,000 | ~0.19% | `1458987853710233817` |
| Mastermind Stone | 0.05 | 15,000 | ~0.09% | `1458987996987785228` |
| Luna Moon Stone | 0 (admin) | 15,000 | 0% | `1458987950363906195` |
| Moonbound Emerald | 0 (admin) | 20,000 | 0% | `1458988047113654273` |

### Forbidden Stones (all weight=0, staff gifts only)

| Stone | Hint | Giver Role | Give Command | Giver Title |
|---|---|---|---|---|
| Chaos Pearl | "Seek A Mastermind's Seal" | `1416510580038041621` | `mms` | Mastermind |
| Shuran's Heart | "Seek a Sentinel's Seal" | `1416555884141613126` | `ss` | Sentinel |
| Halo Core | "Seek a Guardian's Seal" | `1416556873758277826` | `gs` | Guardian |

### Stone Box Config
- **Price:** 2,000 Lunari
- **Duplicate refund:** 50% chance of 1,000L back
- **Required role:** `1416924081269510225` (level 10)

### Completion Rewards
- All Moon Stones: role `1449032654674654823` (Zenith)
- All Stones (moon + forbidden): role `1458898769343942798` (Luna Chosen)

---

## Vendor NPCs

### Kael Vandar — Card Luckboxes

| Tier | Name | Price | Rarity Filter |
|---|---|---|---|
| Common | Common Card | 250 | COMMON |
| Rare | Rare Card | 500 | RARE |
| Epic | Epic Card | 750 | EPIC |
| Unique | Unique Card | 1,000 | UNIQUE |
| Legendary | Legendary Card | 1,500 | LEGENDARY |
| Secret | Secret Card | 2,000 | SECRET |

- 1 card per box opening
- Weighted random from matching rarity pool
- Duplicates: Lunari deducted, card NOT added to collection

### Meluna — Stone Boxes

- **Price:** 2,000 Lunari
- 1 stone per box opening
- Duplicates: Stone IS still added (unlike cards)
- 50% chance of 1,000L refund on duplicate

### Zoldar — Ticket Packages

| Package | Name | Tickets | Price |
|---|---|---|---|
| pack1 | Moon Dust | 1 | 1,000 |
| pack2 | Luna Potion | 2 | 2,000 |
| pack3 | Lunar Orb | 3 | 3,000 |
| pack4 | Pegasus Thigh | 4 | 4,000 |
| pack5 | Dragon Eyes | 5 | 5,000 |

### Seluna — Limited Shop

- Title: "Seluna - The Moonlight Merchant"
- Duration: 24 hours
- Reappears every 30 days
- NOT yet on web (deferred)

| Item ID | Type | Name | Price | Stock |
|---|---|---|---|---|
| luna_cerberus_card | Card | Luna Cerberus | 50,000 | 2 |
| fullmoon_role | Role | Full Moon | 500,000 | unlimited |
| tickets_bundle | Tickets | 10 Tickets Bundle | 3,000 | unlimited |
| luna_moon_stone | Stone | Luna Moon Stone | 15,000 | 5 |
| moonbound_emerald | Stone | Moonbound Emerald | 20,000 | 5 |

---

## Games

### Reward Structure by Player Count

**Roulette / Bomb Roulette:**
| Players | Winner Reward |
|---|---|
| 5 | 2,500 |
| 10+ | 5,000 |

**RPS:**
| Players | Winner Reward |
|---|---|
| 2 | 500 |
| 10+ | 5,000 |

**Mafia / Blood Moon:**
| Players | Winner Reward |
|---|---|
| 5 | 2,000 |
| 8 | 4,000 |
| 10+ | 5,000 |

### Fixed Rewards

| Game | Reward |
|---|---|
| Guess the Country | 1,000 |
| Luna Fantasy (PvP duel) | 5,000 |
| Luna Fantasy (vs Bot) | 2,500 |
| Grand Fantasy | 15,000 |
| Luna Pairs (base) | 12,500 |
| Luna Pairs (bonus) | 15,000 |
| Luna Pairs (double) | 20,000 |
| Magic Bot (pull) | 5 |
| Luna Fantasy Event | 250 |

### Game Settings

| Game | Ticket Cost | Min/Max Players | Wait Time |
|---|---|---|---|
| Roulette | 0 | 2/40 | 40s |
| Bomb Roulette | 0 | 3/40 | 30s |
| Mafia | 0 | 4/25 | 30s |
| RPS | 0 | 2/20 | 30s |
| Guess the Country | 0 | — | 30s per guess, 3 rounds |
| Luna Fantasy (duel) | 1 ticket | 2/2 | 60s invite, 80s round |
| Grand Fantasy | 2 tickets | 2/2 | 60s invite, 60s round |
| Luna Pairs | 2 tickets | 2+ | 60s invite, 120s turn |
| Magic Bot (pull) | 0 | 1 | — |
| Luna Fantasy Event | 0 | — | 60s invite, 80s round |

Grand Fantasy extras: `mercenary_cost=1000`, `imp_penalty=500`, `guardian_split_amount=2500`

---

## Trading System

### Card Trading (`cards_trade.ts`)

| Operation | Access | Description |
|---|---|---|
| Give | Admin | Gift card to user |
| Remove | Admin | Remove card from user |
| Give All | Admin | Give all cards to user |
| Remove All | Admin | Remove all cards from user |
| Mass Give | Admin | Give card to multiple users |
| Sell | User | Direct sale at user-set price |
| Buy | User | Buy from another user's listing |
| Auction | User | Public bidding with starting price |
| Swap | User | Direct 1:1 card exchange |

Auction channel: `1433903304496250982`

### Stone Trading (`stones_trade.ts`)

Same operations as card trading. Stones can also be sold back to Meluna at configured `sell_price`.

---

## Log Channels

| Log Type | Channel ID |
|---|---|
| Lunari transactions | `1448928321240039557` |
| Card transactions | `1448928494900875314` |
| Stone transactions | `1450536515305214064` |

---

## Key Config

| Config | Value |
|---|---|
| Server IDs | `["1243327880478462032", "1423498579057578118"]` |
| MongoDB database | `"Database"` |
| Stone box required role | `1416924081269510225` (level 10) |
