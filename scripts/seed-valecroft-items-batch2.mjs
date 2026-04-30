// One-shot: seed 62 Valecroft items from the 04-26 wetransfer drop
// (images 6, 8-67 — image 7 is already in use as Lunarpoint Observatory).
// Uploads to R2 under valecroft/items/<key>.png and upserts into
// properties_items_catalog. Existing keys (clockwork_steed, spectral_stallion,
// molten_courser, silver_reliquary) get re-pointed to the cleaner artwork.

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

const SOURCE = 'C:/Users/Admin/Desktop/wetransfer_image00001-png_2026-04-26_0243';

// Pricing ladder (Lunari): common 5K-15K · rare 25K-60K · epic 150K-250K
//                         unique 500K-800K · legendary 1.8M-3M
// Income bonus when placed (per cycle): roughly 4-5% of price.
const ITEMS = [
    // Swords / weapons
    { src: 'image00006.png', key: 'sunfire_dagger',         name: 'Sunfire Dagger',         category: 'sword',     rarity: 'epic',      price: 200_000,   income: 8_000,   description: 'A short blade studded with amber suns. Hot to the grip — never cold, never still.' },
    { src: 'image00045.png', key: 'scythe_of_the_blood',    name: 'Scythe of the Blood Eye',category: 'sword',     rarity: 'legendary', price: 2_600_000, income: 130_000, description: 'A serrated reaping scythe set with a single weeping crimson eye. The eye does not blink, and it does not look away.' },
    { src: 'image00046.png', key: 'bonecast_dagger',        name: 'Bonecast Dagger',        category: 'sword',     rarity: 'epic',      price: 180_000,   income: 7_000,   description: 'A wide bone-blade dagger crowned with a smoky cabochon. Whispers when sheathed.' },
    { src: 'image00047.png', key: 'violet_eye_blade',       name: 'Violet-Eye Blade',       category: 'sword',     rarity: 'epic',      price: 200_000,   income: 8_000,   description: 'A jagged longsword with two glowering violet eyes set in the guard. Watches the room when you set it down.' },
    { src: 'image00048.png', key: 'nightveil_longsword',    name: 'Nightveil Longsword',    category: 'sword',     rarity: 'unique',    price: 700_000,   income: 35_000,  description: 'Forged on a moonless night and never cleaned of it. The blade swallows lamplight.' },
    { src: 'image00049.png', key: 'tempestlance',           name: 'Tempestlance',           category: 'sword',     rarity: 'legendary', price: 2_400_000, income: 110_000, description: 'A great spear sheathed in a slow, audible storm. Lightning crawls the haft on humid nights.' },
    { src: 'image00050.png', key: 'flameborn_greatsword',   name: 'Flameborn Greatsword',   category: 'sword',     rarity: 'legendary', price: 2_700_000, income: 135_000, description: 'Drawn from the forge fire still on fire — and never stopped.' },
    { src: 'image00051.png', key: 'gilded_arming_sword',    name: 'Gilded Arming Sword',    category: 'sword',     rarity: 'rare',      price: 55_000,    income: 2_200,   description: 'A serviceable arming blade with a gold-chased crossguard. The mark of a household name.' },
    { src: 'image00052.png', key: 'wyrmtongue_blade',       name: 'Wyrmtongue Blade',       category: 'sword',     rarity: 'unique',    price: 650_000,   income: 32_000,  description: 'A blade that ends in a leering wyrm-mouth, tongue still wet. Tastes the air it cuts.' },
    { src: 'image00053.png', key: 'reapers_dirgescythe',    name: "Reaper's Dirgescythe",   category: 'sword',     rarity: 'epic',      price: 230_000,   income: 9_500,   description: 'A long-handled scythe of dark steel and bone, balanced like a song.' },
    { src: 'image00054.png', key: 'viridian_warmace',       name: 'Viridian Warmace',       category: 'sword',     rarity: 'epic',      price: 210_000,   income: 8_500,   description: 'A war mace set with a great green stone that hums faintly when grasped.' },
    { src: 'image00055.png', key: 'knights_arming_blade',   name: "Knight's Arming Blade",  category: 'sword',     rarity: 'common',    price: 13_000,    income: 500,     description: 'A clean, balanced arming blade — every garrison drills with one of these.' },
    { src: 'image00056.png', key: 'royal_battleaxe',        name: 'Royal Battleaxe',        category: 'sword',     rarity: 'rare',      price: 60_000,    income: 2_500,   description: 'A war axe with a crowned head and a haft long enough for two-handed work.' },
    { src: 'image00057.png', key: 'golden_scimitar',        name: 'Golden Scimitar',        category: 'sword',     rarity: 'rare',      price: 50_000,    income: 2_000,   description: 'A curved blade with a basket of gold filigree. Made to cut, made to be seen cutting.' },
    { src: 'image00058.png', key: 'courtier_saber',         name: "Courtier's Saber",       category: 'sword',     rarity: 'common',    price: 11_000,    income: 450,     description: 'A slim curved sidearm — half ornament, half threat.' },
    { src: 'image00059.png', key: 'spike_warhammer',        name: 'Spiked Warhammer',       category: 'sword',     rarity: 'rare',      price: 58_000,    income: 2_300,   description: 'A heavy hammer with a spike at the rear and the weight of a closed door.' },
    { src: 'image00060.png', key: 'river_pirate_cleaver',   name: "River Pirate's Cleaver", category: 'sword',     rarity: 'common',    price: 10_000,    income: 400,     description: 'A heavy curved cleaver, more practical than honourable.' },
    { src: 'image00061.png', key: 'silver_warspear',        name: 'Silver War-Spear',       category: 'sword',     rarity: 'common',    price: 14_000,    income: 550,     description: 'A simple silver-tipped spear. Long enough to keep what you fear at arm\'s length.' },
    { src: 'image00062.png', key: 'crescent_scimitar',      name: 'Crescent Scimitar',      category: 'sword',     rarity: 'common',    price: 12_000,    income: 480,     description: 'A light scimitar with a moon-curved blade and a swept hilt.' },
    { src: 'image00063.png', key: 'cavalry_saber',          name: 'Dark Cavalry Saber',     category: 'sword',     rarity: 'common',    price: 9_000,     income: 350,     description: 'Issue blade for the night patrols. Worn at the hip, sharpened weekly.' },
    { src: 'image00064.png', key: 'iron_maul',              name: 'Iron Maul',              category: 'sword',     rarity: 'common',    price: 8_000,     income: 320,     description: 'An ugly iron maul. Splits doors and arguments equally well.' },
    { src: 'image00065.png', key: 'throwing_javelin',       name: 'Silver Throwing Javelin',category: 'sword',     rarity: 'common',    price: 7_000,     income: 280,     description: 'Straight, light, weighted for the throw rather than the thrust.' },
    { src: 'image00066.png', key: 'woodsmans_handaxe',      name: "Woodsman's Handaxe",     category: 'sword',     rarity: 'common',    price: 6_000,     income: 240,     description: 'A short-hafted axe — equally happy splitting kindling or a bandit\'s helm.' },
    { src: 'image00067.png', key: 'knights_longsword',      name: "Knight's Longsword",     category: 'sword',     rarity: 'rare',      price: 35_000,    income: 1_400,   description: 'A patient, well-kept longsword. The kind a household passes from father to son.' },

    // Horses
    { src: 'image00028.png', key: 'embercoat_destrier',     name: 'Embercoat Destrier',     category: 'horse',     rarity: 'epic',      price: 180_000,   income: 7_000,   description: 'A black stallion whose coat hides slow embers — never cold to the touch.' },
    { src: 'image00029.png', key: 'dragonscale_courser',    name: 'Dragonscale Courser',    category: 'horse',     rarity: 'unique',    price: 550_000,   income: 28_000,  description: 'A horse plated in fitted dragon scales — a single beast that looks like two.' },
    { src: 'image00030.png', key: 'obsidian_drake_steed',   name: 'Obsidian Drake Steed',   category: 'horse',     rarity: 'legendary', price: 2_200_000, income: 110_000, description: 'A great drake-headed steed in obsidian scale. Said to refuse any rider who has not killed for it.' },
    { src: 'image00031.png', key: 'clockwork_steed',        name: 'Clockwork Steed',        category: 'horse',     rarity: 'epic',      price: 200_000,   income: 8_000,   description: 'A masterwork mount of brass plates and ticking joints. Never tires, never feeds — only the slow, patient need for winding.' },
    { src: 'image00032.jpeg',key: 'spectral_stallion',      name: 'Spectral Stallion',      category: 'horse',     rarity: 'legendary', price: 2_500_000, income: 120_000, description: 'A pale stallion of mist and starlight. Some say it remembers the last rider it carried — and where they died.' },
    { src: 'image00033.png', key: 'silver_palfrey',         name: 'Silver Palfrey',         category: 'horse',     rarity: 'rare',      price: 50_000,    income: 2_000,   description: 'A pale, patient palfrey — bred for long roads and noble shoulders.' },
    { src: 'image00034.png', key: 'molten_courser',         name: 'Molten Courser',         category: 'horse',     rarity: 'unique',    price: 600_000,   income: 30_000,  description: 'A stallion forged of cooling magma — molten veins still glow beneath the dark coat. Dangerous to stable, unforgettable to ride.' },
    { src: 'image00035.png', key: 'infernal_charger',       name: 'Infernal Charger',       category: 'horse',     rarity: 'legendary', price: 2_000_000, income: 100_000, description: 'A barded warhorse with a mane of living flame. Rumoured to outrun its own shadow.' },
    { src: 'image00036.png', key: 'nightcoat_friesian',     name: 'Nightcoat Friesian',     category: 'horse',     rarity: 'rare',      price: 55_000,    income: 2_200,   description: 'A black Friesian — heavy mane, heavier presence.' },
    { src: 'image00037.png', key: 'shadowmane_steed',       name: 'Shadowmane Steed',       category: 'horse',     rarity: 'rare',      price: 48_000,    income: 1_900,   description: 'A black draught with a long, dragging mane. Quieter than its size suggests.' },
    { src: 'image00038.png', key: 'royal_white_courser',    name: 'Royal White Courser',    category: 'horse',     rarity: 'epic',      price: 150_000,   income: 6_000,   description: 'A white stallion in chased silver tack — every stride is a procession.' },
    { src: 'image00039.png', key: 'gilded_warhorse',        name: 'Gilded Warhorse',        category: 'horse',     rarity: 'epic',      price: 220_000,   income: 9_000,   description: 'A black draught in gold-trimmed barding — built for the front rank.' },
    { src: 'image00040.png', key: 'obsidian_warhorse',      name: 'Obsidian Warhorse',      category: 'horse',     rarity: 'epic',      price: 175_000,   income: 7_000,   description: 'A black warhorse with gold-and-leather tack and the calm of a closed gate.' },
    { src: 'image00041.png', key: 'bay_riding_horse',       name: 'Bay Riding Horse',       category: 'horse',     rarity: 'common',    price: 12_000,    income: 500,     description: 'A bay riding horse — sound legs, steady temper.' },
    { src: 'image00042.png', key: 'dapple_grey_steed',      name: 'Dapple-Grey Steed',      category: 'horse',     rarity: 'rare',      price: 40_000,    income: 1_600,   description: 'A dapple-grey saddle-horse — handsome, stubborn, a long-distance friend.' },
    { src: 'image00043.png', key: 'brown_packhorse',        name: 'Brown Packhorse',        category: 'horse',     rarity: 'common',    price: 9_000,     income: 350,     description: 'A workhorse for sacks and saddlebags. Rarely complains, never gallops.' },
    { src: 'image00044.png', key: 'scout_courser',          name: "Scout's Courser",        category: 'horse',     rarity: 'common',    price: 14_000,    income: 550,     description: 'A wiry grey scout-horse — light, quick, and quiet on stone.' },

    // Furniture / decor
    { src: 'image00008.png', key: 'brewing_cauldron',       name: 'Brewing Cauldron',       category: 'furniture', rarity: 'rare',      price: 40_000,    income: 1_500,   description: 'A bronze-bound cauldron always faintly steaming. Whatever is in it, it isn\'t soup.' },
    { src: 'image00009.png', key: 'scrying_eye_frame',      name: 'Scrying-Eye Frame',      category: 'furniture', rarity: 'epic',      price: 180_000,   income: 7_000,   description: 'A reliquary mirror set in iron — a single bloodshot eye blinks back from inside it.' },
    { src: 'image00010.png', key: 'rune_altar_mirror',      name: 'Rune Altar Mirror',      category: 'furniture', rarity: 'epic',      price: 220_000,   income: 9_000,   description: 'A standing mirror lit by a slow-moving rune. Catches more than your reflection.' },
    { src: 'image00011.png', key: 'sunbound_circlet',       name: 'Sunbound Circlet',       category: 'furniture', rarity: 'legendary', price: 1_800_000, income: 90_000,  description: 'A floating circlet of fire above a black plinth. The flame never asks to be fed.' },
    { src: 'image00012.png', key: 'spineless_grimoire',     name: 'Spineless Grimoire',     category: 'furniture', rarity: 'rare',      price: 50_000,    income: 2_000,   description: 'A grimoire mounted on a stack of vertebrae. The pages turn whenever you look away.' },
    { src: 'image00013.png', key: 'heart_key_relic',        name: 'Heart-Key Relic',        category: 'furniture', rarity: 'rare',      price: 45_000,    income: 1_800,   description: 'An ornate brass key with a heart-shaped bow. Refuses to fit any lock yet found.' },
    { src: 'image00014.png', key: 'mooneye_mask',           name: 'Mooneye Mask',           category: 'furniture', rarity: 'epic',      price: 160_000,   income: 6_500,   description: 'A horned ceremonial mask in a velvet-lined box. Always faintly warm.' },
    { src: 'image00015.png', key: 'skull_lantern_jar',      name: 'Skull Reliquary Lantern',category: 'furniture', rarity: 'rare',      price: 55_000,    income: 2_200,   description: 'A lantern of murky glass; small skulls drift inside as if they were never told to settle.' },
    { src: 'image00016.png', key: 'bronze_orrery',          name: 'Bronze Orrery',          category: 'furniture', rarity: 'epic',      price: 240_000,   income: 10_000,  description: 'A small bronze orrery — turn the dial and the moons turn with it.' },
    { src: 'image00017.png', key: 'crown_of_red_lune',      name: 'Crown of the Red Lune',  category: 'furniture', rarity: 'legendary', price: 2_500_000, income: 120_000, description: 'A jewelled crown set with a deep red stone, displayed on rough stone. Heavier than it looks. Heavier than most can carry.' },
    { src: 'image00018.png', key: 'iron_pendant_weight',    name: 'Iron Pendant Weight',    category: 'furniture', rarity: 'common',    price: 5_000,     income: 200,     description: 'A small iron weight on a leather thong — soldier\'s charm, sailor\'s talisman.' },
    { src: 'image00019.png', key: 'brass_padlock',          name: 'Brass Padlock & Key',    category: 'furniture', rarity: 'common',    price: 8_000,     income: 300,     description: 'A solid brass padlock with its key. Sometimes that\'s all you need.' },
    { src: 'image00020.png', key: 'scribes_inkwell',        name: "Scribe's Inkwell",       category: 'furniture', rarity: 'common',    price: 7_000,     income: 250,     description: 'A glass inkwell, half-full, beside a quill that has seen better letters.' },
    { src: 'image00021.png', key: 'feather_relic_box',      name: 'Feather Relic Box',      category: 'furniture', rarity: 'rare',      price: 38_000,    income: 1_500,   description: 'A repoussé bronze cylinder cradling a single bone-white feather.' },
    { src: 'image00022.png', key: 'shard_mirror_stand',     name: 'Shard-Mirror Stand',     category: 'furniture', rarity: 'rare',      price: 32_000,    income: 1_300,   description: 'A small standing shard of black glass in a silvered frame. The crack in it never closes.' },
    { src: 'image00023.png', key: 'sigil_fragment',         name: 'Engraved Sigil Fragment',category: 'furniture', rarity: 'common',    price: 6_000,     income: 220,     description: 'A broken stone tile carved with an unfinished sigil. Set it on a shelf — others may finish reading it.' },
    { src: 'image00024.png', key: 'rune_charm',             name: 'Rune Charm Pendant',     category: 'furniture', rarity: 'common',    price: 5_000,     income: 200,     description: 'A wooden pendant burned with a single rune. A traveler\'s ward.' },
    { src: 'image00025.png', key: 'ashen_phial',            name: 'Ashen Phial',            category: 'furniture', rarity: 'common',    price: 9_000,     income: 350,     description: 'A small corked phial of ash — what burned isn\'t labelled.' },
    { src: 'image00026.png', key: 'thread_spool',           name: 'Spool of Threadbinder',  category: 'furniture', rarity: 'common',    price: 4_000,     income: 150,     description: 'A wooden spool of grey thread with a needle still in it.' },
    { src: 'image00027.png', key: 'wayfinder_medal',        name: 'Wayfinder Medallion',    category: 'furniture', rarity: 'rare',      price: 42_000,    income: 1_700,   description: 'A scorched bronze medallion engraved with a star-compass. Useless on cloudy nights, priceless on clear ones.' },
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
    const ext = it.src.split('.').pop().toLowerCase();
    const r2Key = `valecroft/items/${it.key}.${ext === 'jpeg' ? 'jpeg' : 'png'}`;
    try {
        const buffer = readFileSync(`${SOURCE}/${it.src}`);
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: r2Key,
            Body: buffer,
            ContentType: ext === 'jpeg' ? 'image/jpeg' : 'image/png',
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
                    income_bonus: it.income,
                    image_url: publicUrl,
                    active: true,
                    updated_at: now,
                },
                $setOnInsert: { created_at: now },
            },
            { upsert: true },
        );
        upserted++;
        console.log(`✓ ${it.key.padEnd(28)} ${it.category.padEnd(9)} ${it.rarity.padEnd(10)} ${it.price.toLocaleString().padStart(10)}  +${it.income.toLocaleString()}`);
    } catch (err) {
        failed++;
        console.error(`✗ ${it.key} — ${err.message}`);
    }
}

await mongo.close();
console.log(`\ndone. uploaded=${uploaded} upserted=${upserted} failed=${failed} total=${ITEMS.length}`);
