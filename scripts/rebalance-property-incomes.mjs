// One-shot: scale every property's base_income down to 15% of current
// (≈85% reduction). Round to the nearest 100 so numbers stay tidy.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';

const envContent = readFileSync(resolve('.env.local'), 'utf8');
for (const raw of envContent.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.substring(0, eq);
    const v = line.substring(eq + 1).replace(/^["']|["']$/g, '').trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(k)) process.env[k] = v;
}

const MONGO = process.env.MONGODB_URI ?? process.env.MONGODB_URL;
const MULTIPLIER = 0.15;          // 85% reduction
const ROUND_TO   = 100;

const mongo = new MongoClient(MONGO);
await mongo.connect();
const col = mongo.db('Database').collection('properties_catalog');

const rows = await col.find({}).toArray();
console.log(`scaling base_income on ${rows.length} properties (×${MULTIPLIER})\n`);

let updated = 0;
for (const r of rows) {
    const before = Number(r.base_income) || 0;
    if (before === 0) continue;
    const scaled = Math.round((before * MULTIPLIER) / ROUND_TO) * ROUND_TO;
    await col.updateOne(
        { _id: r._id },
        { $set: { base_income: scaled, updated_at: new Date() } },
    );
    console.log(`  ${r.key.padEnd(28)} ${String(before).padStart(10)} → ${String(scaled).padStart(8)}`);
    updated++;
}

console.log(`\ndone. updated=${updated}`);
await mongo.close();
