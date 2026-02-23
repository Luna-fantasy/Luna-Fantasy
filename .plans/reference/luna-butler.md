# LunaButler Bot Reference

> Economy, banking, leveling, and support ticket bot for the Luna Discord server.
> Entry point: `/Users/fahedalahmad/Sites/Luna/LunaButler/index.ts`
> Discord library: Eris (intents: 53608447)

---

## Project Structure

```
LunaButler/
  index.ts                         # Entry point
  config.ts                        # All config values (~450 lines)
  commands/
    lunari_commands.ts             # Leaderboard, balance checks
    level_commands.ts              # Level/XP system
    ticket_commands.ts             # Support ticket create/close/reopen
    application_commands.ts        # Staff applications
    xo_commands.ts                 # Tic-tac-toe PvP
    rps_commands.ts                # Rock-Paper-Scissors
    connect4_commands.ts           # Connect 4
    coinflip_commands.ts           # Coin flip betting
    hunt_commands.ts               # Hunt minigame
    roulette_commands.ts           # Roulette game
    luna21_commands.ts             # Luna 21 (Blackjack variant)
    steal_commands.ts              # Steal/robbery from other users
    banker_commands.ts             # Banking (loans, deposits, insurance, trades)
    chat_commands.ts               # Chat engagement tracking
    chat_event_commands.ts         # Event management
  util/
    database_helper.ts             # st.db wrapper around MongoDB
    points.ts                      # Lunari operations, investment maturity, overdue loans
    levels.ts                      # XP/level calculations
    tickets.ts                     # Support ticket logic
    config_helper.ts               # Config loading
    functions.ts                   # Shared utilities
    xo_game.ts                     # Tic-tac-toe engine
    rps_game.ts                    # RPS engine
    connect4_game.ts               # Connect 4 engine
    coinflip_game.ts               # Coinflip engine
    luna21_game.ts                 # Luna 21 engine
    chat_tracker.ts                # Chat engagement tracking
    chat_event_tracker.ts          # Event point tracking
    voice_tracker.ts               # Voice XP tracking
    leaderboard_card.ts            # Leaderboard image generation
    leaderboard_card_levels.ts     # Level leaderboard image
    level_up_card.ts               # Level up announcement image
    loan_card.ts                   # Loan status image
    luna21_card.ts                 # Luna 21 game image
    chat_chart_card.ts             # Chat stats chart image
    performance_manager.ts         # Perf monitoring
    leaderboard_manager.ts         # Lunari leaderboard cache
    leaderboard_manager_levels.ts  # Level leaderboard cache
    analyze_leaderboard_image.ts   # Leaderboard analysis
    analyze_loan_image.ts          # Loan analysis
    applications.ts                # Staff application logic
```

---

## Database Collections

All collections use the st.db document format: `{ _id: key, data: value }`

| Collection | Key Pattern | `data` Type | Description |
|---|---|---|---|
| `points` | `userId` | number (or string legacy) | Lunari balance |
| `levels` | `userId` | `{xp, level, messages, voiceTime}` | XP/level data |
| `tickets` | `ticket_${threadId}` or `userticket_${userId}_${categoryId}` | ticket object | Support tickets |
| `ticket_stats` | `staff_${staffId}` | `{claimed, closed}` | Staff ticket stats |
| `cooldowns` | `${type}_${userId}` | timestamp (number) | Command cooldowns |
| `system` | various (see below) | mixed | System-wide data |

### System Collection Keys

| Key | Type | Purpose |
|---|---|---|
| `luna_bank_reserve` | number | Total Lunari in bank reserve |
| `loans_${userId}` | array of loan objects | Active/completed loans |
| `insurances_${userId}` | array of insurance objects | Active insurance policies |
| `investment_${userId}` | `{amount, startDate, lastDepositDate, depositLocked, active}` | Investment tracker |
| `debt_${userId}` | number | Outstanding debt (>0 = has debt) |
| `leaderboard_message_id` | string | Discord message ID for leaderboard |
| `bank_message_data` | `{channelId, messageId, lastUpdate}` | Bank display message |

---

## st.db to MongoDB Mapping

| st.db Method | MongoDB Operation | Example |
|---|---|---|
| `db.get(key)` | `findOne({ _id: key })` → returns `doc.data` | `db.get(userId)` → balance |
| `db.set(key, value)` | `updateOne({ _id: key }, { $set: { data: value } }, { upsert: true })` | `db.set(userId, obj)` |
| `db.add(key, amount)` | `updateOne({ _id: key }, { $inc: { data: amount } }, { upsert: true })` | `db.add(userId, 500)` |
| `db.subtract(key, amount)` | `updateOne({ _id: key }, { $inc: { data: -amount } })` | `db.subtract(userId, 100)` |
| `db.push(key, value)` | Read array → push → `$set: { data: newArray }` | `db.push(key, item)` |
| `db.delete(key)` | `deleteOne({ _id: key })` | `db.delete(key)` |

---

## Economy System

### Earning Lunari

| Source | Amount | Cooldown | Details |
|---|---|---|---|
| Daily Reward | 3,000 | 24h (86,400,000ms) | Fixed (min=3000, max=3000) |
| Monthly Salary | 80,000 | 30d (2,592,000,000ms) | Staff role required |
| Hunt Success | 50-100 random | 3s (3,000ms) | 60% success chance |
| XO Win | 500 | 60s game timeout | Tic-tac-toe |
| XO Draw | 250 | — | |
| RPS Win | 200 | 60s game timeout | Rock-Paper-Scissors |
| RPS Draw | 50 | — | |
| Connect4 Win | 500 | 60s game timeout | |
| Connect4 Draw | 250 | — | |
| Coinflip Win | bet x 2 | 10s (10,000ms) | min_bet=1, max_bet=250 |
| Luna21 Win | varies | 10s (10,000ms) | min_bet=10, max_bet=500 |
| Roulette Win | dynamic (0.5x mult) | 10s | chambers=6, min/max_bet=1/250 |
| Steal Success | 1-5% of target balance | 24h (86,400,000ms) | 50% success rate |
| Investment Maturity | principal + 30% | Auto after 30d | Check every 15min |
| VIP Reward | 2,000 | 24h | |

### Losing Lunari

| Source | Amount |
|---|---|
| Hunt Failure | 100-200 (40% chance) |
| Coinflip Loss | bet amount |
| Luna21 Loss | bet amount |
| Roulette Loss | bet amount |
| Steal Failure | varies |
| Being Stolen From | 1-5% of balance |

### Automatic Background Processes

1. **Investment Maturity Payout** — Runs every 15min (`check_interval: 900000`). Pays principal + 30% after 30 days. File: `util/points.ts` lines 458-506.
2. **Chat Event Tracker** — Awards 5 points per 10 messages during active events. Flushes every 5s. File: `util/chat_event_tracker.ts`.
3. **Overdue Loan Auto-Deduction** — Runs every 60min. Deducts overdue amounts from balance. File: `util/points.ts` lines 267-398.

---

## Banking System

### Loan Tiers (all: 20% interest, 7 day duration, level 1 requirement)

| Tier | Amount | Repayment (with 20% interest) |
|---|---|---|
| 1 | 5,000 | 6,000 |
| 2 | 10,000 | 12,000 |
| 3 | 15,000 | 18,000 |
| 4 | 20,000 | 24,000 |
| 5 | 25,000 | 30,000 |
| 6 | 30,000 | 36,000 |
| 7 | 40,000 | 48,000 |
| 8 | 50,000 | 60,000 |
| 9 | 75,000 | 90,000 |
| 10 | 100,000 | 120,000 |

Loan schema: `{amount, interest, duration, takenAt, dueDate, repaymentAmount, active, overdue, paidAt}`

### Investment

| Config | Value |
|---|---|
| Maturity period | 30 days (2,592,000,000ms) |
| Profit rate | 30% |
| Minimum amount | 20,000 |
| Early withdrawal fee | 5,000 |
| Check interval | 15 min (900,000ms) |
| Deposit lock | After 7 days of first deposit, no more additions |

### Insurance

- **Type:** `steal_protection` ("Protection from Theft")
- **Price:** 500,000 Lunari
- **Duration:** Lifetime (-1)

### Debt System

- Overdue debt role: `1450896401650155641`
- Role added when loan becomes overdue, removed when debt is cleared
- Users with debt are blocked from web bazaar purchases (`checkDebt()`)

---

## Level/XP System

### Text XP
- Per message: 10-25 XP (random)
- Cooldown: 60 seconds between qualifying messages

### Voice XP
- Rate: 0.1 XP per minute
- Requires microphone active
- Check interval: 5 minutes (300,000ms)

### Level Formula
```
level = floor(0.1 * sqrt(xp))
xp = (level / 0.1)^2
```

### XP Multiplier Roles

| Role ID | Multiplier |
|---|---|
| `1419173035185016852` | 1.20x |
| `1419173032710111242` | 1.40x |
| `1419173030222889053` | 1.60x |
| `1419173027224096870` | 1.80x |
| `1419173019724808333` | 2.00x |

### Level Rewards (Role Assignment)

| Level | Role ID |
|---|---|
| 10 | `1416924081269510225` |
| 20 | `1417329078301757532` |
| 30 | `1416922907933675570` |
| 40 | `1416559284455608350` |
| 50 | `1416559000127803543` |
| 60 | `1416558557893103717` |
| 70 | `1416925479650459648` |
| 80 | `1416558457418551348` |
| 90 | `1417265436545781841` |
| 100 | `1416925075193724949` |

Level up announcement channel: `1435387148864979045`

---

## Key Config Values

| Config | Value |
|---|---|
| Server IDs | `["1243327880478462032"]` |
| MongoDB database | `"Database"` |
| Lunari log channel | `1448928321240039557` |
| VIP daily reward | 2,000 |
| VIP deposit role | `1450899585206845470` |
| VIP interest rate | 15% |
| Steal required roles | `1417704454869745715` or `1416510580038041621` |
