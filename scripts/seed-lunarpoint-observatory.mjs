// One-shot: add the new top-tier house "Lunarpoint Observatory" at 25M
// (image00007 from the 04-26 wetransfer drop) and demote the previous
// 25M holder ("The Spire of Lunvor") to 20M so there's a single 25M
// flagship in the catalog.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

const {
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME, R2_PUBLIC_URL,
    MONGODB_URI, MONGODB_URL,
} = process.env;
const MONGO = MONGODB_URI ?? MONGODB_URL;
const BUCKET = R2_BUCKET_NAME ?? 'assets';
const PUBLIC = R2_PUBLIC_URL ?? 'https://assets.lunarian.app';

const SOURCE = 'C:/Users/Admin/Desktop/wetransfer_image00001-png_2026-04-26_0243/image00007.png';

const NEW_HOUSE = {
    key: 'lunarpoint_observatory',
    name: 'Lunarpoint Observatory',
    tier: 'palace',
    price: 25_000_000,
    base_income: 750_000,
    description: 'A cliffside palace crowned by a domed observatory — said to be the highest seat the moon itself can be addressed from. Stone stairs cut to the tide, lanterns at every step, a private dock at the foot of the cliff.',
};

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const r2Key = `valecroft/properties/${NEW_HOUSE.key}.png`;
const buffer = readFileSync(SOURCE);
await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buffer,
    ContentType: 'image/png',
    CacheControl: 'public, max-age=31536000, immutable',
}));
const publicUrl = `${PUBLIC}/${r2Key}?v=${Date.now()}`;
console.log(`✓ uploaded ${r2Key}  (${(buffer.length / 1024).toFixed(0)} KB)`);

const mongo = new MongoClient(MONGO);
await mongo.connect();
const col = mongo.db('Database').collection('properties_catalog');

const now = new Date();
await col.updateOne(
    { key: NEW_HOUSE.key },
    {
        $set: {
            key: NEW_HOUSE.key,
            name: NEW_HOUSE.name,
            description: NEW_HOUSE.description,
            tier: NEW_HOUSE.tier,
            price: NEW_HOUSE.price,
            base_income: NEW_HOUSE.base_income,
            image_url: publicUrl,
            active: true,
            slot_rules_override: null,
            updated_at: now,
        },
        $setOnInsert: { created_at: now },
    },
    { upsert: true },
);
console.log(`✓ upserted catalog row "${NEW_HOUSE.key}" at ${NEW_HOUSE.price.toLocaleString()} Lunari`);

// Demote Spire of Lunvor from 25M → 20M so the new house is the flagship.
const spire = await col.findOneAndUpdate(
    { key: 'spire_of_lunvor' },
    { $set: { price: 20_000_000, base_income: 600_000, updated_at: now } },
);
if (spire) {
    console.log('✓ demoted spire_of_lunvor → 20,000,000 Lunari (was 25M)');
} else {
    console.log('  (spire_of_lunvor not found — skipping demote)');
}

await mongo.close();
console.log('\ndone.');
