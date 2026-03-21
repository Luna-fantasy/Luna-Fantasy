import clientPromise from '@/lib/mongodb';
import type { EconomyOverview, RecentTransaction, AdminUserProfile, AdminUserSearchResult } from '@/types/admin';

const DB_NAME = 'Database';

async function getDb() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

async function resolveTransactionUsernames(db: any, transactions: any[]): Promise<RecentTransaction[]> {
  // Get unique discord IDs that don't already have a username stored
  const idsNeedingLookup = Array.from(new Set(
    transactions
      .filter((t: any) => !t.username)
      .map((t: any) => t.discordId ?? t.userId)
      .filter(Boolean)
  ));

  // Batch lookup from both users (website sign-ins) and discord_users (bot cache) in parallel
  const [webUserDocs, discordUserDocs] = idsNeedingLookup.length > 0
    ? await Promise.all([
        db.collection('users').find({ discordId: { $in: idsNeedingLookup } }).project({ discordId: 1, username: 1, globalName: 1, name: 1, image: 1 }).toArray(),
        db.collection('discord_users').find({ _id: { $in: idsNeedingLookup } }).project({ _id: 1, username: 1, avatar: 1 }).toArray(),
      ])
    : [[], []];

  const userMap = new Map<string, { name: string; avatar: string | null }>();

  // discord_users (bot cache) first — lower priority
  for (const u of discordUserDocs) {
    userMap.set(String(u._id), {
      name: u.username ?? '',
      avatar: u.avatar ?? null,
    });
  }

  // Website users override bot cache (higher quality data)
  for (const u of webUserDocs) {
    userMap.set(u.discordId, {
      name: u.globalName ?? u.name ?? u.username ?? '',
      avatar: u.image ?? null,
    });
  }

  return transactions.map((t: any) => {
    const discordId = t.discordId ?? t.userId ?? '';
    const fallback = userMap.get(discordId);
    return {
      _id: t._id.toString(),
      discordId,
      username: t.username ?? fallback?.name ?? '',
      avatar: t.avatar ?? fallback?.avatar ?? undefined,
      type: t.type ?? 'unknown',
      amount: typeof t.amount === 'string' ? parseFloat(t.amount) || 0 : t.amount ?? 0,
      description: t.description ?? t.reason ?? t.metadata?.itemReceived ?? '',
      timestamp: t.createdAt ?? t.timestamp ?? new Date(),
    };
  }) as RecentTransaction[];
}

/**
 * Aggregate economy overview stats from multiple collections.
 */
export async function getEconomyOverview(): Promise<EconomyOverview> {
  const db = await getDb();

  const [
    memberCountDoc,
    lunariResult,
    systemDoc,
    activeLoansResult,
    debtResult,
    recentTransactions,
  ] = await Promise.all([
    // Server member count from system collection (written by Butler every 5 min)
    db.collection('system').findOne({ _id: 'guild_member_count' as any }),

    // Total Lunari held by all users + count of holders
    db.collection('points').aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$balance', 0] } },
          holders: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$balance', 0] }, 0] }, 1, 0] } },
        },
      },
    ]).toArray(),

    // Bank reserve from system collection
    db.collection('system').findOne({ _id: 'luna_bank_reserve' as any }),

    // Active loans (from bank collection — loans array per user)
    db.collection('bank').aggregate([
      { $unwind: '$loans' },
      { $match: { 'loans.active': true, 'loans.paidAt': { $exists: false } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalValue: { $sum: { $toDouble: { $ifNull: ['$loans.repaymentAmount', 0] } } },
        },
      },
    ]).toArray(),

    // Total outstanding debt (from debt collection — amount per user)
    db.collection('debt').aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } },
        },
      },
    ]).toArray(),

    // Recent transactions (last 100)
    db.collection('lunari_transactions')
      .find()
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
  ]);

  // Server members: prefer guild_member_count, fallback to levels collection count
  let serverMembers = memberCountDoc?.value ?? 0;
  if (!serverMembers) {
    serverMembers = await db.collection('levels').countDocuments();
  }

  const totalLunari = lunariResult[0]?.total ?? 0;
  const activeHolders = lunariResult[0]?.holders ?? 0;
  const bankReserveRaw = systemDoc?.value ?? systemDoc?.data;
  const bankReserve = typeof bankReserveRaw === 'number'
    ? bankReserveRaw
    : typeof bankReserveRaw === 'string'
      ? parseFloat(bankReserveRaw) || 0
      : 0;

  return {
    totalUsers: serverMembers,
    totalLunariCirculation: Math.round(totalLunari),
    activeHolders,
    bankReserve: Math.round(bankReserve),
    activeLoans: activeLoansResult[0]?.count ?? 0,
    activeLoanValue: Math.round(activeLoansResult[0]?.totalValue ?? 0),
    totalDebt: Math.round(debtResult[0]?.total ?? 0),
    recentTransactions: await resolveTransactionUsernames(db, recentTransactions),
  };
}

/**
 * Parse a value that may be a number or stringified number.
 */
function parseNumericValue(val: unknown): number {
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
}

/**
 * Parse a value that may be an array or JSON string of an array.
 */
function parseArrayField(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

/**
 * Search users by Discord ID (exact) or username (regex).
 */
export async function searchUsers(query: string): Promise<AdminUserSearchResult[]> {
  const db = await getDb();
  const isId = /^\d{17,20}$/.test(query);

  // Find matching user accounts from NextAuth users collection
  let userDocs: any[] = [];
  if (isId) {
    userDocs = await db.collection('users').find({ discordId: query }).limit(10).toArray();
  } else {
    // Escape regex metacharacters to prevent ReDoS attacks
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    // Search both website users and bot's discord_users cache in parallel
    const [webResults, discordResults] = await Promise.all([
      db.collection('users').find({
        $or: [{ username: regex }, { globalName: regex }, { name: regex }],
      }).limit(50).toArray(),
      db.collection('discord_users').find({
        $or: [{ username: regex }, { globalName: regex }],
      }).limit(50).toArray(),
    ]);

    // Merge and deduplicate by Discord ID (website users take priority)
    const seen = new Set<string>();
    for (const u of webResults) {
      const id = u.discordId ?? String(u._id);
      if (!seen.has(id)) {
        seen.add(id);
        userDocs.push(u);
      }
    }
    for (const u of discordResults) {
      const id = String(u._id);
      if (!seen.has(id)) {
        seen.add(id);
        userDocs.push({
          discordId: id,
          username: u.username,
          globalName: u.globalName,
          image: u.avatar
            ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128`
            : undefined,
        });
      }
    }
  }

  // Also check points/levels/cards/discord_users collections for IDs without website accounts
  if (isId && userDocs.length === 0) {
    const [pointsDoc, discordUserDoc, levelsDoc, cardsDoc] = await Promise.all([
      db.collection('points').findOne({ _id: query as any }),
      db.collection('discord_users').findOne({ _id: query as any }),
      db.collection('levels').findOne({ _id: query as any }),
      db.collection('cards').findOne({ _id: query as any }),
    ]);
    if (pointsDoc || discordUserDoc || levelsDoc || cardsDoc) {
      userDocs = [{
        discordId: query,
        username: discordUserDoc?.username,
        globalName: discordUserDoc?.globalName,
        image: discordUserDoc?.avatar
          ? `https://cdn.discordapp.com/avatars/${query}/${discordUserDoc.avatar}.png?size=128`
          : undefined,
      }];
    }
  }

  // Batch fetch supplementary data for all results at once (avoid N+1 queries)
  const discordIds = userDocs.map(u => u.discordId ?? u._id?.toString()).filter(Boolean) as string[];
  if (discordIds.length === 0) return [];

  const [pointsDocs, levelsDocs, cardsDocs] = await Promise.all([
    db.collection('points').find({ _id: { $in: discordIds } as any }).toArray(),
    db.collection('levels').find({ _id: { $in: discordIds } as any }).toArray(),
    db.collection('cards').find({ _id: { $in: discordIds } as any }).toArray(),
  ]);

  const pointsMap = new Map(pointsDocs.map(d => [String(d._id), d]));
  const levelsMap = new Map(levelsDocs.map(d => [String(d._id), d]));
  const cardsMap = new Map(cardsDocs.map(d => [String(d._id), d]));

  const results: AdminUserSearchResult[] = [];
  for (const user of userDocs) {
    const discordId = user.discordId ?? user._id?.toString();
    if (!discordId) continue;

    const pointsDoc = pointsMap.get(discordId);
    const levelsDoc = levelsMap.get(discordId);
    const cardsDoc = cardsMap.get(discordId);

    const rawBalance = pointsDoc?.balance ?? parseNumericValue(pointsDoc?.data);
    const balance = typeof rawBalance === 'number' && !Number.isNaN(rawBalance) ? rawBalance : 0;
    // Level: check root fields first (native format), then legacy data field
    let level: number | undefined;
    if (levelsDoc) {
      if (levelsDoc.level !== undefined) {
        level = levelsDoc.level;
      } else if (levelsDoc.data) {
        const raw = typeof levelsDoc.data === 'string' ? (() => { try { return JSON.parse(levelsDoc.data); } catch { return null; } })() : levelsDoc.data;
        level = raw?.level;
      }
    }
    const cardsArr = cardsDoc ? parseArrayField(cardsDoc.cards ?? cardsDoc.data) : [];

    results.push({
      discordId,
      username: user.username,
      globalName: user.globalName ?? user.name,
      image: user.image,
      balance: Math.round(balance),
      level,
      cardCount: cardsArr.length,
    });
  }

  return results;
}

/**
 * Get a full user profile by Discord ID, aggregating from all collections.
 */
export async function getUserProfile(discordId: string): Promise<AdminUserProfile | null> {
  const db = await getDb();

  const [userDoc, discordUserDoc, pointsDoc, levelsDoc, ticketsDoc, cardsDoc, stonesDoc, inventoryDoc, cooldownsDoc, debtDoc, loansDoc, transactionsArr] = await Promise.all([
    db.collection('users').findOne({ discordId }),
    db.collection('discord_users').findOne({ _id: discordId as any }),
    db.collection('points').findOne({ _id: discordId as any }),
    db.collection('levels').findOne({ _id: discordId as any }),
    db.collection('tickets').findOne({ _id: discordId as any }),
    db.collection('cards').findOne({ _id: discordId as any }),
    db.collection('stones').findOne({ _id: discordId as any }),
    db.collection('inventory').findOne({ _id: discordId as any }),
    db.collection('cooldowns').findOne({ _id: discordId as any }),
    db.collection('debt').findOne({ _id: discordId as any }),
    db.collection('bank').findOne({ _id: discordId as any }),
    db.collection('lunari_transactions')
      .find({ discordId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
  ]);

  // If user doesn't exist anywhere
  if (!userDoc && !discordUserDoc && !pointsDoc && !levelsDoc && !cardsDoc) return null;

  const rawBalance = pointsDoc?.balance ?? parseNumericValue(pointsDoc?.data);
  const balance = typeof rawBalance === 'number' && !Number.isNaN(rawBalance) ? rawBalance : 0;

  // Levels: Butler writes root-level fields { xp, level, messages, voiceTime }
  // Legacy st.db format stores them under { data: { xp, level, ... } } or { data: "json string" }
  let level: number | undefined;
  let xp: number | undefined;
  let messages: number | undefined;
  let voiceTime: number | undefined;
  if (levelsDoc) {
    if (levelsDoc.xp !== undefined || levelsDoc.level !== undefined) {
      // Native format (Butler's setUserData writes root fields)
      level = levelsDoc.level ?? 0;
      xp = levelsDoc.xp ?? 0;
      messages = levelsDoc.messages ?? 0;
      voiceTime = levelsDoc.voiceTime ?? 0;
    } else if (levelsDoc.data !== undefined) {
      // Legacy st.db format
      const raw = typeof levelsDoc.data === 'string' ? (() => { try { return JSON.parse(levelsDoc.data); } catch { return null; } })() : levelsDoc.data;
      if (raw && typeof raw === 'object') {
        level = raw.level ?? 0;
        xp = raw.xp ?? 0;
        messages = raw.messages ?? 0;
        voiceTime = raw.voiceTime ?? 0;
      }
    }
  }

  // Cards: stored as doc.cards (array) or legacy doc.data
  const cards = cardsDoc ? parseArrayField(cardsDoc.cards ?? cardsDoc.data) : [];

  // Stones: stored as doc.stones (array) or legacy doc.data.stones
  let stones: any[] = [];
  if (stonesDoc) {
    if (Array.isArray(stonesDoc.stones)) {
      stones = stonesDoc.stones;
    } else if (stonesDoc.data) {
      const stonesRaw = stonesDoc.data;
      if (typeof stonesRaw === 'string') {
        try { const parsed = JSON.parse(stonesRaw); stones = parsed?.stones ?? []; } catch {}
      } else if (typeof stonesRaw === 'object' && stonesRaw !== null) {
        stones = (stonesRaw as any).stones ?? [];
      }
    }
  }

  const inventory = inventoryDoc ? parseArrayField(inventoryDoc.items ?? inventoryDoc.data) : [];

  let cooldowns: Record<string, any> = {};
  if (cooldownsDoc?.data) {
    if (typeof cooldownsDoc.data === 'string') {
      try { cooldowns = JSON.parse(cooldownsDoc.data); } catch {}
    } else if (typeof cooldownsDoc.data === 'object') {
      cooldowns = cooldownsDoc.data as Record<string, any>;
    }
  }

  const debt = parseNumericValue(debtDoc?.amount ?? 0);
  const loans = loansDoc ? (Array.isArray(loansDoc.loans) ? loansDoc.loans : []) : [];

  // Resolve username/avatar: prefer website users, fall back to bot's discord_users cache
  const resolvedUsername = userDoc?.username ?? discordUserDoc?.username;
  const resolvedGlobalName = userDoc?.globalName ?? userDoc?.name ?? discordUserDoc?.globalName;
  const resolvedImage = userDoc?.image ?? (discordUserDoc?.avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUserDoc.avatar}.png?size=128`
    : undefined);

  return {
    discordId,
    username: resolvedUsername,
    globalName: resolvedGlobalName,
    image: resolvedImage,
    balance: Math.round(balance),
    tickets: typeof ticketsDoc?.balance === 'number' ? ticketsDoc.balance : 0,
    level,
    xp,
    messages,
    voiceTime,
    cards,
    stones,
    inventory,
    cooldowns,
    debt: Math.round(debt),
    loans,
    transactions: transactionsArr.map((t) => ({
      _id: t._id.toString(),
      type: t.type,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      timestamp: t.createdAt ?? t.timestamp,
      metadata: t.metadata,
    })),
  };
}
