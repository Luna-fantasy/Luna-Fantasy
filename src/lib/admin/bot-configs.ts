import clientPromise from '@/lib/mongodb';

export interface BotConfigDoc {
  _id: string;
  data: any;
  updatedAt: Date | null;
  updatedBy: string | null;
}

const KNOWN_DOCS = [
  'butler_settings',
  'jester_game_settings',
  'jester_moon_stones',
  'oracle_settings',
  'sage_config',
  'shop_config',
  'cards_config_meta',
  'leaderboard_config',
] as const;

export async function getBotConfigDocs(): Promise<BotConfigDoc[]> {
  const client = await clientPromise;
  const db = client.db('Database');
  const docs = await db.collection('bot_config').find({}).toArray();
  return docs.map((d: any) => ({
    _id: String(d._id),
    data: d.data ?? null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt) : null,
    updatedBy: d.updatedBy ? String(d.updatedBy) : null,
  }));
}

export async function getBotConfigDoc(id: string): Promise<BotConfigDoc | null> {
  const client = await clientPromise;
  const db = client.db('Database');
  const doc = await db.collection('bot_config').findOne({ _id: id as any });
  if (!doc) return null;
  return {
    _id: String((doc as any)._id),
    data: (doc as any).data ?? null,
    updatedAt: (doc as any).updatedAt ? new Date((doc as any).updatedAt) : null,
    updatedBy: (doc as any).updatedBy ? String((doc as any).updatedBy) : null,
  };
}
