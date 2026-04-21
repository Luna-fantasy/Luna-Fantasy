import clientPromise from '@/lib/mongodb';

export interface PassportRow {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  number: string | null;
  fullName: string | null;
  faction: string | null;
  staffRole: string | null;
  issuedAt: number | null;
}

export interface PassportStats {
  total: number;
  staff: { mastermind: number; sentinel: number; guardian: number };
  byFaction: Record<string, number>;
}

function extractPassport(doc: any): any {
  return doc?.data?.passport ?? doc?.passport ?? null;
}

export async function getPassportStats(): Promise<PassportStats> {
  const client = await clientPromise;
  const db = client.db('Database');

  const rows = await db.collection('profiles')
    .find({ $or: [
      { 'data.passport.number': { $exists: true, $nin: [null, ''] } },
      { 'passport.number': { $exists: true, $nin: [null, ''] } },
    ] })
    .project({ 'data.passport': 1, passport: 1 })
    .toArray();

  const byFaction = new Map<string, number>();
  let mastermind = 0, sentinel = 0, guardian = 0;

  for (const doc of rows) {
    const p = extractPassport(doc);
    if (!p) continue;
    const faction = String(p.faction ?? 'Unknown');
    byFaction.set(faction, (byFaction.get(faction) ?? 0) + 1);

    const role = String(p.staffRole ?? '').toLowerCase();
    if (role === 'mastermind') mastermind++;
    else if (role === 'sentinel') sentinel++;
    else if (role === 'guardian') guardian++;
  }

  return {
    total: rows.length,
    staff: { mastermind, sentinel, guardian },
    byFaction: Object.fromEntries(Array.from(byFaction).sort((a, b) => b[1] - a[1])),
  };
}

export async function listPassports(options: {
  faction?: string;
  staffOnly?: boolean;
  q?: string;
  limit?: number;
  skip?: number;
} = {}): Promise<{ rows: PassportRow[]; total: number }> {
  const { faction, staffOnly, q, limit = 36, skip = 0 } = options;
  const client = await clientPromise;
  const db = client.db('Database');

  const filter: Record<string, any> = {
    $or: [
      { 'data.passport.number': { $exists: true, $nin: [null, ''] } },
      { 'passport.number': { $exists: true, $nin: [null, ''] } },
    ],
  };
  const extra: Record<string, any>[] = [];
  if (faction) {
    extra.push({ $or: [
      { 'data.passport.faction': new RegExp(faction, 'i') },
      { 'passport.faction': new RegExp(faction, 'i') },
    ] });
  }
  if (staffOnly) {
    extra.push({ $or: [
      { 'data.passport.staffRole': { $exists: true, $nin: [null, ''] } },
      { 'passport.staffRole': { $exists: true, $nin: [null, ''] } },
    ] });
  }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    extra.push({ $or: [
      { 'data.passport.number': rx },
      { 'data.passport.fullName': rx },
      { 'passport.number': rx },
      { 'passport.fullName': rx },
    ] });
  }
  const matchStage = extra.length > 0 ? { $and: [filter, ...extra] } : filter;

  const pipeline: any[] = [
    { $match: matchStage },
    { $lookup: { from: 'discord_users', localField: '_id', foreignField: '_id', as: 'discord' } },
    { $unwind: { path: '$discord', preserveNullAndEmptyArrays: true } },
    { $addFields: {
      passportDoc: { $ifNull: ['$data.passport', '$passport'] },
    } },
    { $sort: { 'passportDoc.issuedAt': -1, _id: 1 } },
    { $facet: {
      rows: [
        { $skip: skip },
        { $limit: limit },
      ],
      total: [{ $count: 'n' }],
    } },
  ];

  const agg = await db.collection('profiles').aggregate(pipeline).toArray();
  const { rows = [], total = [] } = (agg[0] as any) ?? { rows: [], total: [] };
  const totalCount = total[0]?.n ?? 0;

  const out: PassportRow[] = rows.map((r: any) => {
    const discordId = String(r._id);
    const passport = r.passportDoc ?? {};
    const d = r.discord ?? {};
    const image = d.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${d.avatar}.png?size=128`
      : null;
    return {
      discordId,
      username: d.username ?? null,
      globalName: d.globalName ?? null,
      image,
      number: passport.number ?? null,
      fullName: passport.fullName ?? null,
      faction: passport.faction ?? null,
      staffRole: passport.staffRole ?? null,
      issuedAt: typeof passport.issuedAt === 'number' ? passport.issuedAt : null,
    };
  });

  return { rows: out, total: totalCount };
}
