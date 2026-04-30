// One-shot: seed the 4 legitimate items found in images 6-9 of the
// 04-30 wetransfer drop. Uploads to R2 under valecroft/items/<key>.png
// and upserts into properties_items_catalog.
//
// Items 36-67 in that drop are character/creature portraits, not items —
// those belong in the Characters catalog or Faction War cards.

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

const SOURCE = 'C:/Users/Admin/Desktop/wetransfer_image00001-png_2026-04-30_0058';

const ITEMS = [
    {
        src: 'image00006.png',
        key: 'clockwork_steed',
        name: 'Clockwork Steed',
        category: 'horse',
        rarity: 'epic',
        price: 200_000,
        income_bonus: 8_000,
        description: 'A masterwork mount of brass plates and ticking joints. Never tires, never feeds — only the slow, patient need for winding.',
    },
    {
        src: 'image00007.png',
        key: 'spectral_stallion',
        name: 'Spectral Stallion',
        category: 'horse',
        rarity: 'legendary',
        price: 2_500_000,
        income_bonus: 120_000,
        description: 'A pale stallion of mist and starlight. Some say it remembers the last rider it carried — and where they died.',
    },
    {
        src: 'image00008.png',
        key: 'molten_courser',
        name: 'Molten Courser',
        category: 'horse',
        rarity: 'unique',
        price: 600_000,
        income_bonus: 30_000,
        description: 'A stallion forged of cooling magma — molten veins still glow beneath the dark coat. Dangerous to stable, unforgettable to ride.',
    },
    {
        src: 'image00009.png',
        key: 'silver_reliquary',
        name: 'Silver Reliquary Box',
        category: 'furniture',
        rarity: 'epic',
        price: 150_000,
        income_bonus: 6_000,
        description: 'An ornate silvered reliquary box, lined with deep velvet — a place for the things you cannot afford to lose.',
    },
];

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const mongo = new MongoClient(MONGO);
await mongo.connect();
const col = mongo.db('Database').collection('properties_items_catalog');

let uploaded = 0, upserted = 0, failed = 0;
for (const it of ITEMS) {
    const r2Key = `valecroft/items/${it.key}.png`;
    try {
        const buffer = readFileSync(`${SOURCE}/${it.src}`);
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: r2Key,
            Body: buffer,
            ContentType: 'image/png',
            CacheControl: 'public, max-age=31536000, immutable',
        }));
        uploaded++;

        const publicUrl = `${PUBLIC}/${r2Key}?v=${Date.now()}`;
        const now = new Date();
        await col.updateOne(
            { key: it.key },
            {
                $set: {
                    key: it.key,
                    name: it.name,
                    description: it.description,
                    category: it.category,
                    rarity: it.rarity,
                    price: it.price,
                    income_bonus: it.income_bonus,
                    image_url: publicUrl,
                    active: true,
                    updated_at: now,
                },
                $setOnInsert: { created_at: now },
            },
            { upsert: true },
        );
        upserted++;
        console.log(`✓ ${it.key.padEnd(22)} ${it.category.padEnd(9)} ${it.rarity.padEnd(10)} ${it.price.toLocaleString().padStart(11)}  +${it.income_bonus.toLocaleString()}/cycle`);
    } catch (err) {
        failed++;
        console.error(`✗ ${it.key} — ${err.message}`);
    }
}

await mongo.close();
console.log(`\ndone. uploaded=${uploaded} upserted=${upserted} failed=${failed}`);
