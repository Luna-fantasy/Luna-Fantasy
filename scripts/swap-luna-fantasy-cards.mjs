#!/usr/bin/env node
/**
 * Bulk-replace Luna Fantasy card images for the 00521–00659 wetransfer batch.
 *
 * For each manifest entry:
 *   1. Look up the card in `cards_config.{rarity}` to get its current imageUrl
 *   2. Derive the R2 key (strip `https://assets.lunarian.app/` + any `?v=`)
 *   3. Upload the new image at that exact R2 key (overwrite)
 *   4. Update MongoDB with `<url>?v=<Date.now()>` cache-bust
 *
 * Skipped: cards I couldn't confidently match. They're listed in `unmatched`
 * at the bottom so we can review later.
 *
 * Run: node scripts/swap-luna-fantasy-cards.mjs
 *      node scripts/swap-luna-fantasy-cards.mjs --dry  (preview, no writes)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Inline .env.local loader (the project uses Next.js for env loading at runtime;
// we don't have dotenv as a dep, so just parse the file directly).
function loadEnvLocal() {
    const here = dirname(fileURLToPath(import.meta.url));
    const envFile = join(here, '..', '.env.local');
    if (!existsSync(envFile)) return;
    const raw = readFileSync(envFile, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
    }
}
loadEnvLocal();

const SOURCE_DIR = 'C:\\Users\\Admin\\Desktop\\wetransfer_image00001-png_2026-04-29_0356';
const DRY = process.argv.includes('--dry');
const MONGODB_URI = process.env.MONGODB_URI;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_PUBLIC = (process.env.R2_PUBLIC_URL ?? 'https://assets.lunarian.app').replace(/\/$/, '');

if (!MONGODB_URI || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    console.error('[FATAL] Missing env vars. Need MONGODB_URI + R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME');
    process.exit(1);
}

/**
 * Manifest. Each entry maps a wetransfer image file to (rarity, dbName).
 * The dbName is the canonical name as stored in MongoDB cards_config.
 * We do NOT rename DB entries — just swap pictures.
 */
const MANIFEST = [
    // ─── SECRET (00521–00561, including "Mythical"-headered cards that live in SECRET) ───
    { file: 'image00521.png', rarity: 'SECRET', name: 'The Silent Ancient' },
    { file: 'image00522.jpeg', rarity: 'SECRET', name: 'Dark Mastermind' },
    { file: 'image00523.png', rarity: 'SECRET', name: 'Ancient Dragon' },
    { file: 'image00524.png', rarity: 'SECRET', name: 'Shape Shifter' },
    { file: 'image00525.png', rarity: 'SECRET', name: 'Shadow Reign' },
    { file: 'image00526.png', rarity: 'SECRET', name: 'Tidal Warden' },
    { file: 'image00527.png', rarity: 'SECRET', name: 'Nebula Weaver' },
    { file: 'image00528.png', rarity: 'SECRET', name: 'Broker The Merchant' },
    { file: 'image00529.png', rarity: 'SECRET', name: 'Luna Queen' },
    { file: 'image00530.png', rarity: 'SECRET', name: 'Blood Siren' },
    { file: 'image00531.png', rarity: 'SECRET', name: 'Ethereal Knight' },
    { file: 'image00532.png', rarity: 'SECRET', name: 'Luna King' },
    { file: 'image00533.jpeg', rarity: 'SECRET', name: 'Bumper 1' },        // 3 Bumpers in DB; mapping by sequential image order
    { file: 'image00534.jpeg', rarity: 'SECRET', name: 'Prime Mastermind' },
    { file: 'image00535.jpeg', rarity: 'SECRET', name: 'Bumper 2' },
    { file: 'image00536.jpeg', rarity: 'SECRET', name: 'Bumper 3' },
    { file: 'image00537.png', rarity: 'SECRET', name: 'Paragon Knight' },
    { file: 'image00538.png', rarity: 'SECRET', name: 'Dune Reaper' },
    { file: 'image00539.png', rarity: 'SECRET', name: 'Alpha Direwolf' },
    { file: 'image00540.png', rarity: 'SECRET', name: 'Thorn Queen' },
    { file: 'image00541.png', rarity: 'SECRET', name: 'Frost Titan' },
    { file: 'image00542.png', rarity: 'SECRET', name: 'Dream Eater' },
    { file: 'image00543.png', rarity: 'SECRET', name: 'Silverbeach Guardian' },
    { file: 'image00544.png', rarity: 'SECRET', name: 'Veil Serpent' },
    { file: 'image00545.png', rarity: 'SECRET', name: 'Abyss Monarch' },
    { file: 'image00546.png', rarity: 'SECRET', name: 'Whisper Queen' },
    { file: 'image00547.png', rarity: 'SECRET', name: 'Hydra' },
    { file: 'image00548.png', rarity: 'SECRET', name: 'Eclipse Dragon' },     // image label "Luna Eclipse Dragon"
    { file: 'image00549.png', rarity: 'SECRET', name: 'Jester' },
    { file: 'image00550.png', rarity: 'SECRET', name: 'Butler' },
    { file: 'image00551.png', rarity: 'SECRET', name: 'Great Deer' },
    { file: 'image00552.png', rarity: 'SECRET', name: 'Chaos Warlord' },
    { file: 'image00553.png', rarity: 'SECRET', name: 'Great Sage' },         // image label "Luna Great Sage"
    { file: 'image00554.png', rarity: 'SECRET', name: 'Minotaur' },
    { file: 'image00555.png', rarity: 'SECRET', name: 'Cave Monster' },
    { file: 'image00556.png', rarity: 'SECRET', name: 'The Corrupted Sentinel' },
    { file: 'image00557.png', rarity: 'SECRET', name: 'Alpha Werewolf' },
    { file: 'image00558.png', rarity: 'SECRET', name: 'Arcanist' },
    { file: 'image00559.png', rarity: 'SECRET', name: 'Kraken' },
    { file: 'image00560.png', rarity: 'SECRET', name: 'Cerberus' },
    { file: 'image00561.png', rarity: 'SECRET', name: 'Elder Vampire' },

    // ─── LEGENDARY (00562–00586) ───
    // 00562 "Movarth" — UNMATCHED, no Movarth in LEGENDARY DB
    { file: 'image00563.png', rarity: 'LEGENDARY', name: 'Astral Harbinger' },
    { file: 'image00564.png', rarity: 'LEGENDARY', name: 'Bloodforged Warlord' }, // image label "Bloodforged Knight" — same card, attack 150 matches
    { file: 'image00565.png', rarity: 'LEGENDARY', name: 'Abyssal Colossus' },
    { file: 'image00566.png', rarity: 'LEGENDARY', name: 'Eclipse Warrior' },
    { file: 'image00567.png', rarity: 'LEGENDARY', name: 'Gravemind' },        // image label "Grave Mind"
    { file: 'image00568.png', rarity: 'LEGENDARY', name: 'Moon Bender' },
    { file: 'image00569.png', rarity: 'LEGENDARY', name: 'Moon Rider' },
    { file: 'image00570.png', rarity: 'LEGENDARY', name: 'Nullbringer' },
    { file: 'image00571.png', rarity: 'LEGENDARY', name: 'Mastermind' },
    { file: 'image00572.png', rarity: 'LEGENDARY', name: 'Infernal Demon' },
    { file: 'image00573.png', rarity: 'LEGENDARY', name: 'Paradox Keeper' },
    { file: 'image00574.png', rarity: 'LEGENDARY', name: 'Obsidian Sentinel' },
    { file: 'image00575.png', rarity: 'LEGENDARY', name: 'Reaper' },
    { file: 'image00576.png', rarity: 'LEGENDARY', name: 'Seraph' },
    { file: 'image00577.png', rarity: 'LEGENDARY', name: 'La Luna Elva' },     // image label "Elva"
    { file: 'image00578.png', rarity: 'LEGENDARY', name: 'Sabertooth' },        // image label "Saber Tooth"
    { file: 'image00579.png', rarity: 'LEGENDARY', name: 'Solar Warrior' },
    { file: 'image00580.png', rarity: 'LEGENDARY', name: 'Wishmaster' },
    { file: 'image00581.png', rarity: 'LEGENDARY', name: 'The Half-Breed' },
    { file: 'image00582.png', rarity: 'LEGENDARY', name: 'Last Titan' },
    { file: 'image00583.png', rarity: 'LEGENDARY', name: 'Gatekeeper' },
    { file: 'image00584.png', rarity: 'LEGENDARY', name: 'La Luna Eron' },     // image label "Eron"
    { file: 'image00585.png', rarity: 'LEGENDARY', name: 'Runebreaker' },      // image label "Rune Breaker"
    { file: 'image00586.png', rarity: 'LEGENDARY', name: 'Moon Serpent' },

    // ─── UNIQUE (00587–00613) ───
    // 00587 + 00588 are both "Skull Crusher" 95. Using 00588 (newer).
    { file: 'image00588.png', rarity: 'UNIQUE', name: 'Luna Skull-Crusher' },
    { file: 'image00589.png', rarity: 'UNIQUE', name: 'Luna Sentinel' },
    { file: 'image00590.png', rarity: 'UNIQUE', name: 'Luna Twins' },          // image label "The Twins"
    { file: 'image00591.png', rarity: 'UNIQUE', name: 'Luna Werewolf' },
    { file: 'image00592.png', rarity: 'UNIQUE', name: 'Mysterious Warrior' },
    { file: 'image00593.png', rarity: 'UNIQUE', name: 'Luna Harbinger' },
    { file: 'image00594.png', rarity: 'UNIQUE', name: 'Luna Grandmaster' },
    { file: 'image00595.png', rarity: 'UNIQUE', name: 'Luna Specter' },
    { file: 'image00596.png', rarity: 'UNIQUE', name: 'Luna Medusa' },
    { file: 'image00597.png', rarity: 'UNIQUE', name: 'Luna Warlord' },
    { file: 'image00598.png', rarity: 'UNIQUE', name: 'Luna Phantom' },
    { file: 'image00599.png', rarity: 'UNIQUE', name: 'Luna Revenant' },
    // 00600 "Bod Aban" — UNMATCHED
    { file: 'image00601.png', rarity: 'UNIQUE', name: 'Luna Dragonslayer' },   // image label "Dragon Slayer"
    { file: 'image00602.png', rarity: 'UNIQUE', name: 'Luna Mercenary' },
    { file: 'image00603.png', rarity: 'UNIQUE', name: 'Luna Shadow' },
    { file: 'image00604.png', rarity: 'UNIQUE', name: 'Luna Trickster' },
    { file: 'image00605.png', rarity: 'UNIQUE', name: 'Luna Outcast' },
    { file: 'image00606.png', rarity: 'UNIQUE', name: 'Luna Monk' },
    { file: 'image00607.png', rarity: 'UNIQUE', name: 'Luna Giant' },
    { file: 'image00608.png', rarity: 'UNIQUE', name: 'Luna Executioner' },
    { file: 'image00609.png', rarity: 'UNIQUE', name: 'Luna Chimera' },
    { file: 'image00610.png', rarity: 'UNIQUE', name: 'Luna Centaur' },
    { file: 'image00611.png', rarity: 'UNIQUE', name: 'Luna Dragon' },
    { file: 'image00612.png', rarity: 'UNIQUE', name: 'Luna Vampire' },
    // 00613 "Kaidan" — UNMATCHED (could be "Luna Yonko" but ambiguous)

    // ─── EPIC (00614–00637) ───
    { file: 'image00614.png', rarity: 'EPIC', name: 'Zoldar' },
    { file: 'image00615.png', rarity: 'EPIC', name: 'Luna Blademaster' },      // image label "Blade Master"
    { file: 'image00616.png', rarity: 'EPIC', name: 'Luna Ogre' },
    { file: 'image00617.png', rarity: 'EPIC', name: 'Luna Draconis' },
    { file: 'image00618.png', rarity: 'EPIC', name: 'Luna Cyclops' },
    // 00619 "Lycan" — duplicate with 00628; using 00628
    { file: 'image00620.png', rarity: 'EPIC', name: 'Luna Assassin' },
    { file: 'image00621.png', rarity: 'EPIC', name: 'Luna Wizard' },
    { file: 'image00622.png', rarity: 'EPIC', name: 'Luna Dark Wizard' },
    { file: 'image00623.png', rarity: 'EPIC', name: 'Luna Griffin' },
    { file: 'image00624.png', rarity: 'EPIC', name: 'Luna Knight' },
    { file: 'image00625.png', rarity: 'EPIC', name: 'Luna Wisp' },
    { file: 'image00626.png', rarity: 'EPIC', name: 'Luna Herald' },
    { file: 'image00627.png', rarity: 'EPIC', name: 'Luna Guardian' },
    { file: 'image00628.png', rarity: 'EPIC', name: 'Luna Lycan' },
    { file: 'image00629.png', rarity: 'EPIC', name: 'Luna Hunter' },
    { file: 'image00630.png', rarity: 'EPIC', name: 'Luna Sphinx' },
    { file: 'image00631.png', rarity: 'EPIC', name: 'Luna Druid' },
    { file: 'image00632.png', rarity: 'EPIC', name: 'Luna Ghoul' },
    { file: 'image00633.png', rarity: 'EPIC', name: 'Luna Viperclaw' },
    { file: 'image00634.png', rarity: 'EPIC', name: 'Luna Paladin' },
    { file: 'image00635.png', rarity: 'EPIC', name: 'Luna Battlemage' },        // image label "Battle Mage"
    { file: 'image00636.png', rarity: 'EPIC', name: 'Luna Mad Crow' },
    { file: 'image00637.png', rarity: 'EPIC', name: 'Luna Orc' },

    // ─── RARE (00638–00659) ───
    { file: 'image00638.png', rarity: 'RARE', name: 'Luna Moonveil' },
    { file: 'image00639.png', rarity: 'RARE', name: 'Luna Cobra' },
    { file: 'image00640.png', rarity: 'RARE', name: 'Luna Wraith' },
    { file: 'image00641.png', rarity: 'RARE', name: 'Luna Witch' },
    { file: 'image00642.png', rarity: 'RARE', name: 'Luna Wanderer' },
    { file: 'image00643.png', rarity: 'RARE', name: 'Luna Umbra' },
    { file: 'image00644.png', rarity: 'RARE', name: 'Luna Phoenix' },
    { file: 'image00645.png', rarity: 'RARE', name: 'Luna Panthera' },
    { file: 'image00646.png', rarity: 'RARE', name: 'Luna Pacifier' },
    { file: 'image00647.png', rarity: 'RARE', name: 'Luna Thief' },
    { file: 'image00648.png', rarity: 'RARE', name: 'Luna Siren' },
    { file: 'image00649.png', rarity: 'RARE', name: 'Luna Seer' },
    { file: 'image00650.png', rarity: 'RARE', name: 'Luna Healer' },
    { file: 'image00651.png', rarity: 'RARE', name: 'Luna Mermaid' },
    { file: 'image00652.png', rarity: 'RARE', name: 'Luna Lynx' },
    { file: 'image00653.png', rarity: 'RARE', name: 'Luna Direwolf' },
    { file: 'image00654.png', rarity: 'RARE', name: 'Luna Archer' },
    { file: 'image00655.png', rarity: 'RARE', name: 'Luna Alchemist' },
    { file: 'image00656.png', rarity: 'RARE', name: 'Luna Blacksmith' },        // image label "Thorin"
    { file: 'image00657.png', rarity: 'RARE', name: 'Luna Golem' },
    { file: 'image00658.png', rarity: 'RARE', name: 'Luna Goblin' },
    { file: 'image00659.png', rarity: 'RARE', name: 'Luna Vanguard' },
];

const UNMATCHED_NOTES = [
    { file: 'image00562.png', label: 'Movarth (LEGENDARY)', reason: 'No matching card in cards_config.LEGENDARY' },
    { file: 'image00587.png', label: 'Skull Crusher (UNIQUE) — duplicate', reason: 'Same as 00588; chose later image' },
    { file: 'image00600.png', label: 'Bod Aban (UNIQUE)', reason: 'No matching card in cards_config.UNIQUE' },
    { file: 'image00613.png', label: 'Kaidan (UNIQUE)', reason: 'No matching card; possible alias for "Luna Yonko" but ambiguous' },
    { file: 'image00619.png', label: 'Lycan (EPIC) — duplicate', reason: 'Same as 00628; chose later image' },
];

function ext(filename) {
    const m = filename.match(/\.(png|jpe?g|webp)$/i);
    return m ? m[1].toLowerCase() : 'png';
}
function contentTypeFor(filename) {
    const e = ext(filename);
    return e === 'jpg' || e === 'jpeg' ? 'image/jpeg' : e === 'webp' ? 'image/webp' : 'image/png';
}
function urlToKey(url) {
    if (!url) return null;
    const bare = url.split('?')[0];
    if (!bare.startsWith(R2_PUBLIC + '/')) return null;
    return bare.slice(R2_PUBLIC.length + 1);
}

async function main() {
    console.log(`[swap] mode=${DRY ? 'DRY RUN' : 'LIVE'}  manifest=${MANIFEST.length} entries`);

    const mongo = new MongoClient(MONGODB_URI);
    await mongo.connect();
    const db = mongo.db('Database');
    const col = db.collection('cards_config');

    const r2 = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });

    const successes = [];
    const failures = [];

    for (const entry of MANIFEST) {
        const filePath = join(SOURCE_DIR, entry.file);
        if (!existsSync(filePath)) {
            failures.push({ ...entry, reason: 'Source file missing on disk' });
            continue;
        }

        const rarityDoc = await col.findOne({ _id: entry.rarity });
        if (!rarityDoc) {
            failures.push({ ...entry, reason: `cards_config.${entry.rarity} not found` });
            continue;
        }
        const items = rarityDoc.items ?? [];
        const cardIdx = items.findIndex((c) => c.name === entry.name);
        if (cardIdx === -1) {
            failures.push({ ...entry, reason: `Card "${entry.name}" not in ${entry.rarity}` });
            continue;
        }

        const currentUrl = items[cardIdx].imageUrl;
        const r2Key = urlToKey(currentUrl);
        if (!r2Key) {
            failures.push({ ...entry, reason: `Could not derive R2 key from ${currentUrl}` });
            continue;
        }

        const buf = readFileSync(filePath);
        const ct = contentTypeFor(entry.file);

        if (DRY) {
            console.log(`[dry] ${entry.file}  →  ${r2Key}  (${ct}, ${buf.length} bytes)  [${entry.rarity}/${entry.name}]`);
            successes.push({ ...entry, r2Key, bytes: buf.length });
            continue;
        }

        // 1. Upload to R2
        try {
            await r2.send(new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: r2Key,
                Body: buf,
                ContentType: ct,
                CacheControl: 'public, max-age=31536000, immutable',
            }));
        } catch (err) {
            failures.push({ ...entry, reason: `R2 upload failed: ${err.message}` });
            continue;
        }

        // 2. Update Mongo with versioned URL
        const baseUrl = `${R2_PUBLIC}/${r2Key}`;
        const versionedUrl = `${baseUrl}?v=${Date.now()}`;
        items[cardIdx].imageUrl = versionedUrl;

        try {
            await col.updateOne(
                { _id: entry.rarity },
                { $set: { items, updatedAt: new Date() } },
            );
        } catch (err) {
            failures.push({ ...entry, reason: `Mongo update failed: ${err.message}` });
            continue;
        }

        console.log(`[ok] ${entry.file} → ${r2Key}`);
        successes.push({ ...entry, r2Key, bytes: buf.length, newUrl: versionedUrl });
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`OK:       ${successes.length}`);
    console.log(`Failures: ${failures.length}`);
    if (failures.length) {
        console.log(`\nFailures:`);
        for (const f of failures) console.log(`  - ${f.file} (${f.name}) — ${f.reason}`);
    }
    console.log(`\nUnmatched (skipped, not attempted):`);
    for (const u of UNMATCHED_NOTES) console.log(`  - ${u.file} (${u.label}) — ${u.reason}`);

    await mongo.close();
}

main().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
});
