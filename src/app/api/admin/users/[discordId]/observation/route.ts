import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface SourceBreakdown {
  type: string;
  label: string;
  total: number;
  count: number;
}

const LUNARI_LABELS: Record<string, string> = {
  lunari_added:       'Lunari added',
  lunari_spent:       'Lunari spent',
  daily_reward:       'Daily reward',
  daily_bonus:        'Daily bonus',
  daily_streak:       'Daily streak',
  passport_bonus:     'Passport bonus',
  vip_bonus:          'Investor bonus (legacy)',
  investor_bonus:     'Investor bonus',
  trade_win:          'Trade win',
  trade_loss:         'Trade loss',
  shop_purchase:      'Shop purchase',
  store_purchase:     'Store purchase',
  mells_purchase:     'Mells purchase',
  transfer_in:        'Transfer received',
  transfer_out:       'Transfer sent',
  gift_received:      'Gift received',
  gift_sent:          'Gift sent',
  loan_taken:         'Loan taken',
  loan_repaid:        'Loan repaid',
  bank_deposit:       'Bank deposit',
  bank_withdraw:      'Bank withdraw',
  bank_interest:      'Bank interest',
  bank_daily:         'Bank daily',
  bank_loan_taken:    'Bank loan taken',
  bank_loan_repaid:   'Bank loan repaid',
  investment_buy:     'Investment bought',
  investment_sell:    'Investment sold',
  investment_gain:    'Investment gain',
  investment_loss:    'Investment loss',
  investment_payout:  'Investment payout',
  game_win:           'Game win',
  game_loss:          'Game loss',
  trivia_win:         'Trivia win',
  trivia_loss:        'Trivia loss',
  challenge_reward:   'Challenge reward',
  fantasy_win:        'Fantasy win',
  fantasy_loss:       'Fantasy loss',
  faction_war:        'Faction war',
  roulette_win:       'Roulette win',
  roulette_loss:      'Roulette loss',
  mafia_win:          'Mafia win',
  mafia_loss:         'Mafia loss',
  rps_win:            'RPS win',
  rps_loss:           'RPS loss',
  mines_win:          'Mines win',
  mines_loss:         'Mines loss',
  duel_win:           'Duel win',
  duel_loss:          'Duel loss',
  bomb_win:           'Bomb win',
  bomb_loss:          'Bomb loss',
  magic_win:          'Magic win',
  magic_loss:         'Magic loss',
  steal_success:      'Steal success',
  steal_fail:         'Steal failed',
  steal_victim:       'Got stolen from',
  admin_credit:       'Admin credit',
  admin_debit:        'Admin debit',
};

function label(type: string): string {
  return LUNARI_LABELS[type] ?? type
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Semantic category each type falls into
type CategoryKey = 'games' | 'gifts' | 'trades' | 'bank' | 'investments' | 'shop' | 'daily' | 'admin' | 'steal' | 'cards_stones' | 'other';
const CATEGORY_META: Record<CategoryKey, { label: string; color: string; glyph: string }> = {
  games:        { label: 'Games',          color: '#a78bfa', glyph: '◈' },
  gifts:        { label: 'Gifts',          color: '#fb7185', glyph: '✉' },
  trades:       { label: 'Trades',         color: '#22d3ee', glyph: '⇄' },
  bank:         { label: 'Bank & Loans',   color: '#fbbf24', glyph: '◇' },
  investments:  { label: 'Investments',    color: '#4ade80', glyph: '▲' },
  shop:         { label: 'Shop purchases', color: '#c084fc', glyph: '◆' },
  daily:        { label: 'Daily & passive', color: '#38bdf8', glyph: '☼' },
  admin:        { label: 'Admin actions',  color: '#fde68a', glyph: '⚙' },
  steal:        { label: 'Heists',         color: '#f43f5e', glyph: '◉' },
  cards_stones: { label: 'Cards & Stones', color: '#b066ff', glyph: '◆' },
  other:        { label: 'Other',          color: '#94a3b8', glyph: '•' },
};

function categoryOf(type: string): CategoryKey {
  const t = type.toLowerCase();
  if (t.startsWith('steal_')) return 'steal';
  if (t.startsWith('gift_') || t === 'transfer_in' || t === 'transfer_out') return 'gifts';
  if (t.startsWith('trade_')) return 'trades';
  if (t.startsWith('bank_') || t === 'loan_taken' || t === 'loan_repaid') return 'bank';
  if (t.startsWith('investment_')) return 'investments';
  if (t.endsWith('_purchase') || t.startsWith('shop_') || t.startsWith('store_') || t === 'mells_purchase') return 'shop';
  if (t.includes('daily') || t === 'passport_bonus' || t === 'vip_bonus' || t === 'investor_bonus') return 'daily';
  if (t.startsWith('admin_')) return 'admin';
  if (t.startsWith('card_') || t.startsWith('stone_') || t === 'luckbox') return 'cards_stones';
  // Games — catch-all for win/loss and specific game names
  if (t.endsWith('_win') || t.endsWith('_loss') || t === 'game_win' || t === 'game_loss' ||
      t === 'challenge_reward' || t === 'faction_war' || t.startsWith('trivia_') ||
      t.startsWith('fantasy_') || t.startsWith('roulette_') || t.startsWith('mafia_') ||
      t.startsWith('rps_') || t.startsWith('mines_') || t.startsWith('duel_') ||
      t.startsWith('bomb_') || t.startsWith('magic_')) return 'games';
  return 'other';
}

export async function GET(_req: NextRequest, { params }: { params: { discordId: string } }) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const discordId = String(params.discordId).replace(/[^0-9]/g, '').slice(0, 32);
  if (!discordId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db('Database');

    const [lunariAgg, cardsAgg, stonesAgg, firstLunari, lastLunari] = await Promise.all([
      db.collection('lunari_transactions').aggregate([
        { $match: { discordId } },
        { $group: {
          _id: '$type',
          total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } },
          count: { $sum: 1 },
        } },
      ]).toArray(),
      db.collection('cards_transactions').aggregate([
        { $match: { discordId } },
        { $group: {
          _id: { type: '$type', rarity: '$metadata.rarity' },
          total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } },
          count: { $sum: 1 },
        } },
      ]).toArray(),
      db.collection('stones_transactions').aggregate([
        { $match: { discordId } },
        { $group: {
          _id: { type: '$type', tier: '$metadata.tier' },
          total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } },
          count: { $sum: 1 },
        } },
      ]).toArray(),
      db.collection('lunari_transactions').find({ discordId })
        .project({ createdAt: 1, timestamp: 1 }).sort({ createdAt: 1 }).limit(1).toArray(),
      db.collection('lunari_transactions').find({ discordId })
        .project({ createdAt: 1, timestamp: 1 }).sort({ createdAt: -1 }).limit(1).toArray(),
    ]);

    // ── Lunari breakdown ──
    // Classification is TYPE-based, not sign-based. The Luna DB stores `lunari_spent`
    // with POSITIVE amounts (the "amount" is the magnitude, the "type" conveys direction).
    // Spending types: ends in _spent/_loss/_out/_purchase/_repaid/_debit/_fee
    // Earning types: everything else (_added/_reward/_win/_in/_credit/_gift_received/etc.)
    const isSpendingType = (t: string) => /(_spent|_loss|_out|_purchase|_repaid|_debit|_fee|_tax)$|^(shop_|store_)/i.test(t);

    const earnedBy: SourceBreakdown[] = [];
    const spentBy: SourceBreakdown[] = [];
    let totalEarned = 0;
    let totalSpent = 0;
    let totalTx = 0;

    // Per-category aggregation
    const catMap = new Map<CategoryKey, { earned: number; spent: number; count: number; items: SourceBreakdown[]; earnedItems: SourceBreakdown[]; spentItems: SourceBreakdown[] }>();

    for (const row of lunariAgg as any[]) {
      const type = String(row._id ?? 'unknown');
      const total = Number(row.total ?? 0);
      const count = Number(row.count ?? 0);
      totalTx += count;
      const magnitude = Math.abs(total);
      const entry = { type, label: label(type), total: magnitude, count };
      const isSpend = isSpendingType(type) || total < 0;
      if (isSpend) {
        totalSpent += magnitude;
        spentBy.push(entry);
      } else {
        totalEarned += magnitude;
        earnedBy.push(entry);
      }

      const cat = categoryOf(type);
      const bucket = catMap.get(cat) ?? { earned: 0, spent: 0, count: 0, items: [], earnedItems: [], spentItems: [] };
      bucket.count += count;
      bucket.items.push(entry);
      if (isSpend) {
        bucket.spent += magnitude;
        bucket.spentItems.push(entry);
      } else {
        bucket.earned += magnitude;
        bucket.earnedItems.push(entry);
      }
      catMap.set(cat, bucket);
    }
    earnedBy.sort((a, b) => b.total - a.total);
    spentBy.sort((a, b) => b.total - a.total);

    const categories = Array.from(catMap.entries())
      .map(([key, v]) => ({
        key,
        label: CATEGORY_META[key].label,
        color: CATEGORY_META[key].color,
        glyph: CATEGORY_META[key].glyph,
        earned: v.earned,
        spent: v.spent,
        net: v.earned - v.spent,
        count: v.count,
        earnedItems: v.earnedItems.sort((a, b) => b.total - a.total).slice(0, 6),
        spentItems: v.spentItems.sort((a, b) => b.total - a.total).slice(0, 6),
      }))
      .sort((a, b) => (b.earned + b.spent) - (a.earned + a.spent));

    // ── Cards breakdown ──
    const cardsByRarity = new Map<string, { pulled: number; earned: number; spent: number }>();
    let cardsPulled = 0;
    let cardsEarned = 0;
    let cardsSpent = 0;
    for (const row of cardsAgg as any[]) {
      const type = String(row._id?.type ?? 'unknown');
      const rarity = String(row._id?.rarity ?? 'UNKNOWN').toUpperCase();
      const total = Number(row.total ?? 0);
      const count = Number(row.count ?? 0);
      const magnitude = Math.abs(total);
      const bucket = cardsByRarity.get(rarity) ?? { pulled: 0, earned: 0, spent: 0 };
      if (type.includes('pull') || type === 'luckbox') { bucket.pulled += count; cardsPulled += count; }
      if (isSpendingType(type) || total < 0) {
        bucket.spent += magnitude; cardsSpent += magnitude;
      } else if (magnitude > 0) {
        bucket.earned += magnitude; cardsEarned += magnitude;
      }
      cardsByRarity.set(rarity, bucket);
    }
    const cardsRarityArr = Array.from(cardsByRarity.entries())
      .map(([rarity, v]) => ({ rarity, ...v }))
      .sort((a, b) => b.pulled - a.pulled);

    // ── Stones breakdown ──
    const stonesByTier = new Map<string, { chests: number; earned: number; spent: number; count: number }>();
    let stoneChests = 0;
    let stonesEarned = 0;
    let stonesSpent = 0;
    for (const row of stonesAgg as any[]) {
      const type = String(row._id?.type ?? 'unknown');
      const tier = String(row._id?.tier ?? 'UNKNOWN').toUpperCase();
      const total = Number(row.total ?? 0);
      const count = Number(row.count ?? 0);
      const magnitude = Math.abs(total);
      const bucket = stonesByTier.get(tier) ?? { chests: 0, earned: 0, spent: 0, count: 0 };
      if (type.includes('chest')) { bucket.chests += count; stoneChests += count; }
      if (isSpendingType(type) || total < 0) {
        bucket.spent += magnitude; stonesSpent += magnitude;
      } else if (magnitude > 0) {
        bucket.earned += magnitude; stonesEarned += magnitude;
      }
      bucket.count += count;
      stonesByTier.set(tier, bucket);
    }
    const stonesTierArr = Array.from(stonesByTier.entries())
      .map(([tier, v]) => ({ tier, ...v }))
      .sort((a, b) => b.count - a.count);

    // ── Activity window ──
    const firstSeen = (firstLunari[0] as any)?.createdAt ?? (firstLunari[0] as any)?.timestamp ?? null;
    const lastActive = (lastLunari[0] as any)?.createdAt ?? (lastLunari[0] as any)?.timestamp ?? null;

    // ── Game win/loss from lunari types ──
    const gameWin = (lunariAgg as any[]).find((r) => r._id === 'game_win') as any;
    const gameLoss = (lunariAgg as any[]).find((r) => r._id === 'game_loss') as any;
    const wins = gameWin?.count ?? 0;
    const losses = gameLoss?.count ?? 0;
    const played = wins + losses;

    return NextResponse.json({
      lunari: {
        totalEarned,
        totalSpent,
        net: totalEarned - totalSpent,
        totalTransactions: totalTx,
        earnedBy: earnedBy.slice(0, 8),
        spentBy: spentBy.slice(0, 8),
        categories,
      },
      cards: {
        pulled: cardsPulled,
        lunariEarned: cardsEarned,
        lunariSpent: cardsSpent,
        byRarity: cardsRarityArr,
      },
      stones: {
        chests: stoneChests,
        lunariEarned: stonesEarned,
        lunariSpent: stonesSpent,
        byTier: stonesTierArr,
      },
      games: {
        wins,
        losses,
        played,
        winRate: played > 0 ? Math.round((wins / played) * 1000) / 10 : null,
      },
      activity: {
        firstSeen: firstSeen ? new Date(firstSeen).toISOString() : null,
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
      },
    });
  } catch (err) {
    console.error('[observation] Error:', err);
    return NextResponse.json({ error: 'Internal error', detail: sanitizeErrorMessage((err as Error).message) }, { status: 500 });
  }
}
