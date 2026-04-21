import clientPromise from '@/lib/mongodb';

export interface LevelStats {
  totalLeveled: number;
  avgLevel: number;
  maxLevel: number;
  totalXp: number;
  totalMessages: number;
  totalVoiceMinutes: number;
}

export interface TopLeveled {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  level: number;
  xp: number;
  messages: number;
  voiceMinutes: number;
}

export interface LevelBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface RecentLevelUp {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  level: number;
  admin: string;
  amount: number;
  timestamp: string;
}

function readLevels(doc: any): { level: number; xp: number; messages: number; voiceMinutes: number } {
  const data = doc?.data ?? doc ?? {};
  return {
    level: Number(data.level ?? doc?.level ?? 0),
    xp: Number(data.xp ?? doc?.xp ?? 0),
    messages: Number(data.messages ?? doc?.messages ?? 0),
    voiceMinutes: Math.round(Number(data.voiceTime ?? doc?.voiceTime ?? 0) / 60),
  };
}

export async function getLevelStats(): Promise<LevelStats> {
  const client = await clientPromise;
  const db = client.db('Database');

  const rows = await db.collection('levels')
    .find({})
    .project({ _id: 1, level: 1, xp: 1, messages: 1, voiceTime: 1, data: 1 })
    .toArray();

  let totalLeveled = 0, totalLevel = 0, maxLevel = 0, totalXp = 0, totalMessages = 0, totalVoice = 0;
  for (const doc of rows) {
    const { level, xp, messages, voiceMinutes } = readLevels(doc);
    if (level > 0 || xp > 0) totalLeveled++;
    totalLevel += level;
    if (level > maxLevel) maxLevel = level;
    totalXp += xp;
    totalMessages += messages;
    totalVoice += voiceMinutes;
  }

  return {
    totalLeveled,
    avgLevel: totalLeveled > 0 ? totalLevel / totalLeveled : 0,
    maxLevel,
    totalXp,
    totalMessages,
    totalVoiceMinutes: totalVoice,
  };
}

export async function getTopLeveled(n = 25): Promise<TopLeveled[]> {
  const client = await clientPromise;
  const db = client.db('Database');

  const rows = await db.collection('levels')
    .find({})
    .project({ _id: 1, level: 1, xp: 1, messages: 1, voiceTime: 1, data: 1 })
    .toArray();

  // Normalize + sort client-side (legacy format support)
  const normalized = rows.map((doc: any) => ({
    discordId: String(doc._id),
    ...readLevels(doc),
  }))
  .filter((r) => r.level > 0 || r.xp > 0)
  .sort((a, b) => b.level - a.level || b.xp - a.xp)
  .slice(0, Math.min(100, Math.max(1, n)));

  const ids = normalized.map((r) => r.discordId);
  const discord = await db.collection('discord_users')
    .find({ _id: { $in: ids } as any })
    .project({ _id: 1, username: 1, globalName: 1, avatar: 1 })
    .toArray();
  const byId = new Map(discord.map((d: any) => [String(d._id), d]));

  return normalized.map((r) => {
    const d = byId.get(r.discordId) as any;
    const image = d?.avatar
      ? `https://cdn.discordapp.com/avatars/${r.discordId}/${d.avatar}.png?size=128`
      : null;
    return {
      discordId: r.discordId,
      username: d?.username ?? null,
      globalName: d?.globalName ?? null,
      image,
      level: r.level,
      xp: r.xp,
      messages: r.messages,
      voiceMinutes: r.voiceMinutes,
    };
  });
}

export async function getLevelDistribution(): Promise<LevelBucket[]> {
  const client = await clientPromise;
  const db = client.db('Database');

  const rows = await db.collection('levels')
    .find({})
    .project({ level: 1, data: 1 })
    .toArray();

  // Buckets: 0 (unlevelled), 1-9, 10-24, 25-49, 50-74, 75-99, 100+
  const buckets: LevelBucket[] = [
    { label: 'Unlevelled', min: 0, max: 0, count: 0 },
    { label: '1–9',   min: 1,  max: 9,   count: 0 },
    { label: '10–24', min: 10, max: 24,  count: 0 },
    { label: '25–49', min: 25, max: 49,  count: 0 },
    { label: '50–74', min: 50, max: 74,  count: 0 },
    { label: '75–99', min: 75, max: 99,  count: 0 },
    { label: '100+',  min: 100, max: Infinity, count: 0 },
  ];

  for (const doc of rows) {
    const { level } = readLevels(doc);
    const bucket = buckets.find((b) => level >= b.min && level <= b.max);
    if (bucket) bucket.count++;
  }
  return buckets;
}

export async function getRecentLevelChanges(n = 10): Promise<RecentLevelUp[]> {
  const client = await clientPromise;
  const db = client.db('Database');

  const audit = await db.collection('admin_audit_log')
    .find({ action: 'level_modify' })
    .project({ targetDiscordId: 1, adminUsername: 1, 'metadata.amount': 1, after: 1, timestamp: 1 })
    .sort({ timestamp: -1 })
    .limit(Math.min(50, Math.max(1, n)))
    .toArray();

  const ids = Array.from(new Set(audit.map((a: any) => String(a.targetDiscordId)))).filter(Boolean);
  const discord = ids.length === 0 ? [] : await db.collection('discord_users')
    .find({ _id: { $in: ids } as any })
    .project({ _id: 1, username: 1, globalName: 1, avatar: 1 })
    .toArray();
  const byId = new Map(discord.map((d: any) => [String(d._id), d]));

  return audit.map((a: any) => {
    const id = String(a.targetDiscordId ?? '');
    const d = byId.get(id) as any;
    const image = d?.avatar ? `https://cdn.discordapp.com/avatars/${id}/${d.avatar}.png?size=128` : null;
    const resultLevel = Number(a.after?.level ?? a.after ?? 0);
    return {
      discordId: id,
      username: d?.username ?? null,
      globalName: d?.globalName ?? null,
      image,
      level: resultLevel,
      admin: a.adminUsername ?? '—',
      amount: Number(a.metadata?.amount ?? 0),
      timestamp: new Date(a.timestamp).toISOString(),
    };
  });
}
