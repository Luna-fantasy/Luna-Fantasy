// One-shot: upload houses (images 00010-00035 from wetransfer drop) to R2
// and upsert into the `properties_catalog` Mongo collection used by the
// Valecroft Properties admin tab.
//
// Idempotent — re-running uploads the same R2 keys (overwriting) and uses
// $set on the catalog row keyed by `key`. Safe to run multiple times.
//
// Usage: cd Luna-Fantasy-Main && node scripts/seed-valecroft-houses.mjs
//        node scripts/seed-valecroft-houses.mjs --dry   (no writes)

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MongoClient } from 'mongodb';

const DRY_RUN = process.argv.includes('--dry');

// Inline .env.local loader — same pattern as upload-valecroft-merchants.mjs
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

const MONGO_URL = MONGODB_URI ?? MONGODB_URL;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('Missing R2 credentials in .env.local'); process.exit(1);
}
if (!MONGO_URL) { console.error('Missing MONGODB_URI in .env.local'); process.exit(1); }

const BUCKET = R2_BUCKET_NAME ?? 'assets';
const PUBLIC = R2_PUBLIC_URL ?? 'https://assets.lunarian.app';
const SOURCE = 'C:/Users/Admin/Desktop/wetransfer_image00001-png_2026-04-30_0058';

// Tier ladder used by Valecroft (5 tiers): shack | cottage | villa | manor | palace
// base_income ratio guidelines: shack ~20%, cottage ~10%, villa ~7%, manor ~5%, palace ~3%
const HOUSES = [
    { src: 'image00010.png', key: 'spire_of_lunvor',     name: 'The Spire of Lunvor',     tier: 'palace',  price: 25_000_000, base_income: 750_000, description: 'A vast gothic district at the heart of the capital — cathedrals, cloisters, and torchlit courtyards as far as the eye can see.' },
    { src: 'image00011.png', key: 'ravenmoor_hall',      name: 'Ravenmoor Hall',          tier: 'manor',   price: 7_500_000,  base_income: 375_000, description: 'A multi-wing gothic estate climbing a misted hillside, its galleried halls watched over by silent crows.' },
    { src: 'image00012.png', key: 'crescentglass_palace',name: 'Crescentglass Palace',    tier: 'palace',  price: 18_000_000, base_income: 540_000, description: 'A twin-wing baroque palace fronted by a glass conservatory and a still reflecting pool.' },
    { src: 'image00013.png', key: 'highmoor_mansion',    name: 'Highmoor Mansion',        tier: 'manor',   price: 8_500_000,  base_income: 425_000, description: 'A symmetrical mountain-valley mansion with twin sweeping staircases and a central fountain.' },
    { src: 'image00014.png', key: 'obsidian_court',      name: 'The Obsidian Court',      tier: 'palace',  price: 22_000_000, base_income: 660_000, description: 'A monolithic temple-palace of black stone — twin towers flanking a great gold-cast door.' },
    { src: 'image00015.png', key: 'valecroft_estate',    name: 'Valecroft Estate',        tier: 'manor',   price: 2_400_000,  base_income: 120_000, description: 'The ancestral manor of the Valecroft line — wrought-iron gates, lantern-lit drive, fountain at the threshold.' },
    { src: 'image00016.png', key: 'blackthorn_manor',    name: 'Blackthorn Manor',        tier: 'manor',   price: 6_000_000,  base_income: 300_000, description: 'A black-stone gothic manor behind heavy iron gates, urn-topped pillars guarding the entry.' },
    { src: 'image00017.png', key: 'goldenflame_hall',    name: 'Goldenflame Hall',        tier: 'manor',   price: 6_800_000,  base_income: 340_000, description: 'A symmetrical baroque hall with a great fountain plaza and standing flame braziers.' },
    { src: 'image00018.png', key: 'castleton_hall',      name: 'Castleton Hall',          tier: 'manor',   price: 2_800_000,  base_income: 140_000, description: 'An ivy-veiled estate behind a stone arch — gardens, fountain, and Castleton Hall beyond.' },
    { src: 'image00019.png', key: 'lunaris_court',       name: 'Lunaris Court',           tier: 'manor',   price: 9_500_000,  base_income: 475_000, description: 'An ornate baroque court with stone lions, fountain, and balustraded terraces.' },
    { src: 'image00020.png', key: 'carriagewatch_estate',name: 'Carriagewatch Estate',    tier: 'villa',   price: 1_800_000,  base_income: 126_000, description: 'A working estate with adjoining carriage house and stables — torches, cobblestone, and the murmur of horses.' },
    { src: 'image00021.png', key: 'ravenwatch_manor',    name: 'Ravenwatch Manor',        tier: 'manor',   price: 5_500_000,  base_income: 275_000, description: 'A spired gothic manor at forest edge — raven sentinels carved atop the gate pillars.' },
    { src: 'image00022.png', key: 'eclipsehold_manor',   name: 'Eclipsehold Manor',       tier: 'manor',   price: 7_200_000,  base_income: 360_000, description: 'Twin towers and a central spire crown this candlelit manor; statuary watches from the courtyard fountain.' },
    { src: 'image00023.png', key: 'astor_house',         name: 'The Astor House',         tier: 'cottage', price: 380_000,    base_income: 38_000,  description: 'A compact ornate corner townhouse on a wet cobblestone street.' },
    { src: 'image00024.png', key: 'ashbrook_manor',      name: 'Ashbrook Manor',          tier: 'villa',   price: 950_000,    base_income: 66_500,  description: 'A modest gothic manor with a pointed entry hall and a small lantern-lit courtyard.' },
    { src: 'image00025.png', key: 'blackwell_house',     name: 'Blackwell & Sons House',  tier: 'cottage', price: 220_000,    base_income: 22_000,  description: 'A half-timbered shop-front home — Blackwell & Sons, established by the cobblestone lane.' },
    { src: 'image00026.png', key: 'brookstone_cottage',  name: 'Brookstone Cottage',      tier: 'cottage', price: 120_000,    base_income: 12_000,  description: 'A small stone cottage tucked beside a forest stream — single chimney, single hearth.' },
    { src: 'image00027.png', key: 'thornleaf_cottage',   name: 'Thornleaf Cottage',       tier: 'cottage', price: 320_000,    base_income: 32_000,  description: 'A two-storey gothic cottage with arched stone entry and an ivy-clad side porch.' },
    { src: 'image00028.png', key: 'hollowfen_farmstead', name: 'Hollowfen Farmstead',     tier: 'cottage', price: 180_000,    base_income: 18_000,  description: 'A stone-and-timber farmhouse with attached stable, set in a quiet mountain valley.' },
    { src: 'image00029.png', key: 'sunmara_villa',       name: 'Sunmara Villa',           tier: 'villa',   price: 1_400_000,  base_income: 98_000,  description: 'A Mediterranean stone villa with arcaded courtyard and ivy-shrouded fountain.' },
    { src: 'image00030.png', key: 'valecroft_residence', name: 'Valecroft Residence',     tier: 'cottage', price: 450_000,    base_income: 45_000,  description: 'A smaller Valecroft holding — stone cottage, ivy gates, plaque marking the residence.' },
    { src: 'image00031.png', key: 'cobblestep_house',    name: 'Cobblestep House',        tier: 'cottage', price: 165_000,    base_income: 16_500,  description: 'A half-timbered medieval house at the foot of a narrow alley.' },
    { src: 'image00032.png', key: 'old_stoneworks_house',name: 'Old Stoneworks House',    tier: 'cottage', price: 145_000,    base_income: 14_500,  description: 'A two-storey stone townhouse in the old works district.' },
    { src: 'image00033.png', key: 'cliffwatchers_hut',   name: "Cliffwatcher's Hut",      tier: 'shack',   price: 35_000,     base_income: 7_000,   description: 'A tiny stone hut perched on a sea cliff — single window, salt wind for company.' },
    { src: 'image00034.png', key: 'lantern_alley_house', name: 'Lantern Alley House',     tier: 'cottage', price: 175_000,    base_income: 17_500,  description: 'A half-timbered corner house on a lantern-lit cobblestone alley.' },
    { src: 'image00035.png', key: 'hermits_hovel',       name: "Hermit's Hovel",          tier: 'shack',   price: 28_000,     base_income: 5_600,   description: 'A moss-covered stone hut alone in the deep forest — chimney smoking faintly.' },
];

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const mongo = new MongoClient(MONGO_URL);
await mongo.connect();
const col = mongo.db('Database').collection('properties_catalog');

let uploaded = 0, upserted = 0, failed = 0;

for (const h of HOUSES) {
    const r2Key = `valecroft/properties/${h.key}.png`;
    const publicUrl = `${PUBLIC}/${r2Key}?v=${Date.now()}`;
    try {
        if (!DRY_RUN) {
            const buffer = readFileSync(`${SOURCE}/${h.src}`);
            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: r2Key,
                Body: buffer,
                ContentType: 'image/png',
                CacheControl: 'public, max-age=31536000, immutable',
            }));
            uploaded++;
        }
        const now = new Date();
        if (!DRY_RUN) {
            await col.updateOne(
                { key: h.key },
                {
                    $set: {
                        key: h.key,
                        name: h.name,
                        description: h.description,
                        tier: h.tier,
                        price: h.price,
                        base_income: h.base_income,
                        image_url: publicUrl,
                        active: true,
                        slot_rules_override: null,
                        updated_at: now,
                    },
                    $setOnInsert: { created_at: now },
                },
                { upsert: true },
            );
            upserted++;
        }
        console.log(`✓ ${h.key.padEnd(28)} ${h.tier.padEnd(8)} ${h.price.toLocaleString().padStart(12)}  → ${publicUrl.split('?')[0]}`);
    } catch (err) {
        failed++;
        console.error(`✗ ${h.key} — ${err.message}`);
    }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}done. uploaded=${uploaded} upserted=${upserted} failed=${failed}`);
await mongo.close();
