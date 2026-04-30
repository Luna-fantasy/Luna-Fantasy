import clientPromise from '@/lib/mongodb';
import { coerceLore, type ValecroftLore } from './valecroft-lore-types';

const DB_NAME = 'Database';
const DOC_ID = 'valecroft_lore';

export async function getValecroftLore(): Promise<ValecroftLore> {
  const client = await clientPromise;
  const doc = await client.db(DB_NAME).collection('bot_config').findOne({ _id: DOC_ID as any });
  return coerceLore(doc?.data);
}

export async function saveValecroftLore(lore: ValecroftLore): Promise<void> {
  const client = await clientPromise;
  await client
    .db(DB_NAME)
    .collection('bot_config')
    .updateOne(
      { _id: DOC_ID as any },
      { $set: { data: coerceLore(lore), updatedAt: new Date() } },
      { upsert: true },
    );
}

export { coerceLore };
export type { ValecroftLore };
