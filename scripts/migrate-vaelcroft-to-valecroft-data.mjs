// One-shot data migration: Vaelcroft → Valecroft
// 1. Copies every R2 object under `vaelcroft/` to mirrored `valecroft/` keys
//    (originals kept as a safety net — delete manually later if you want).
// 2. Rewrites image URLs in MongoDB collections that referenced the old path:
//      - properties_catalog.image_url
//      - properties_items_catalog.image_url
//      - bot_config doc `_id: 'vaelcroft_lore'` → renamed to `valecroft_lore`
//        (old doc kept too for safety; remove later via Mongo UI if desired).
//
// Usage: node scripts/migrate-vaelcroft-to-valecroft-data.mjs
//        node scripts/migrate-vaelcroft-to-valecroft-data.mjs --dry

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { S3Client, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { MongoClient } from 'mongodb';

const DRY = process.argv.includes('--dry');

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
    R2_BUCKET_NAME,
    MONGODB_URI, MONGODB_URL,
} = process.env;
const MONGO = MONGODB_URI ?? MONGODB_URL;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !MONGO) {
    console.error('Missing creds in .env.local'); process.exit(1);
}
const BUCKET = R2_BUCKET_NAME ?? 'assets';

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// ── 1. R2 copy ──
console.log('─ R2: list vaelcroft/ ─');
let token;
const allKeys = [];
do {
    const res = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: 'vaelcroft/',
        ContinuationToken: token,
    }));
    for (const obj of res.Contents ?? []) allKeys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);
console.log(`  found ${allKeys.length} objects under vaelcroft/`);

let copied = 0, copyFailed = 0;
for (const oldKey of allKeys) {
    const newKey = oldKey.replace(/^vaelcroft\//, 'valecroft/');
    try {
        if (!DRY) {
            await s3.send(new CopyObjectCommand({
                Bucket: BUCKET,
                CopySource: `${BUCKET}/${oldKey}`,
                Key: newKey,
                CacheControl: 'public, max-age=31536000, immutable',
                MetadataDirective: 'REPLACE',
            }));
        }
        console.log(`  ✓ ${oldKey} → ${newKey}`);
        copied++;
    } catch (err) {
        console.error(`  ✗ ${oldKey} — ${err.message}`);
        copyFailed++;
    }
}

// ── 2. Mongo rewrites ──
console.log('\n─ Mongo: rewrite URLs ─');
const mongo = new MongoClient(MONGO);
await mongo.connect();
const db = mongo.db('Database');

async function rewriteImageUrls(colName, field = 'image_url') {
    const col = db.collection(colName);
    const cursor = col.find({ [field]: { $regex: 'vaelcroft/' } });
    let updated = 0;
    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const oldUrl = doc[field];
        if (typeof oldUrl !== 'string') continue;
        const newUrl = oldUrl.replace('vaelcroft/', 'valecroft/');
        if (!DRY) await col.updateOne({ _id: doc._id }, { $set: { [field]: newUrl } });
        console.log(`  ✓ ${colName}: ${doc._id} ${oldUrl.split('?')[0]} → ${newUrl.split('?')[0]}`);
        updated++;
    }
    console.log(`  ${colName}: ${updated} URL${updated === 1 ? '' : 's'} updated`);
    return updated;
}

await rewriteImageUrls('properties_catalog');
await rewriteImageUrls('properties_items_catalog');

// Lore doc: copy bot_config._id 'vaelcroft_lore' to 'valecroft_lore', rewriting nested URLs.
console.log('\n─ Mongo: lore doc ─');
const cfg = db.collection('bot_config');
const loreOld = await cfg.findOne({ _id: 'vaelcroft_lore' });
if (loreOld) {
    const data = JSON.parse(JSON.stringify(loreOld));
    delete data._id;

    function deepReplace(obj) {
        if (typeof obj === 'string') return obj.replace('vaelcroft/', 'valecroft/');
        if (Array.isArray(obj)) return obj.map(deepReplace);
        if (obj && typeof obj === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(obj)) out[k] = deepReplace(v);
            return out;
        }
        return obj;
    }
    const migrated = deepReplace(data);

    if (!DRY) {
        await cfg.updateOne(
            { _id: 'valecroft_lore' },
            { $set: migrated },
            { upsert: true },
        );
    }
    console.log('  ✓ created/updated bot_config._id="valecroft_lore"');
    console.log('  (old "vaelcroft_lore" doc kept — delete manually later if you want)');
} else {
    console.log('  (no vaelcroft_lore doc in bot_config — nothing to migrate)');
}

await mongo.close();

console.log(`\n${DRY ? '[DRY] ' : ''}done. r2_copied=${copied} r2_failed=${copyFailed}`);
