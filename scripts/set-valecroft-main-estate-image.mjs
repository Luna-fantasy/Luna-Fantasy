// One-shot: set bot_config.valecroft_lore.home.imageUrl to the existing
// RealEstateCassian portrait (already on R2 at butler/vendors/).

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
const PUBLIC = process.env.R2_PUBLIC_URL ?? 'https://assets.lunarian.app';

const url = `${PUBLIC}/butler/vendors/RealEstateCassian.png?v=${Date.now()}`;

const mongo = new MongoClient(MONGO);
await mongo.connect();
const cfg = mongo.db('Database').collection('bot_config');

const existing = await cfg.findOne({ _id: 'valecroft_lore' });
let res;
if (existing) {
    res = await cfg.updateOne(
        { _id: 'valecroft_lore' },
        { $set: { 'home.imageUrl': url, updatedAt: new Date() } },
    );
} else {
    res = await cfg.insertOne({
        _id: 'valecroft_lore',
        home: {
            name: { en: 'Valecroft Manor', ar: '' },
            description: { en: '', ar: '' },
            imageUrl: url,
            gallery: [],
        },
        family: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

console.log(`✓ valecroft_lore.home.imageUrl → ${url}`);
console.log(`  ${existing ? 'updated existing doc' : 'created new doc'}`);

await mongo.close();
