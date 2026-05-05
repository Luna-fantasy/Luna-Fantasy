// One-shot: upload 19 new Mells shop images to R2 + append 38 items
// (19 profile + 19 rank) to bot_config.butler_shop.
// Safe to re-run: skips items whose id already exists.

const fs = require('fs');
const path = require('path');

// Minimal .env.local loader (no dotenv dep needed)
const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { MongoClient } = require('mongodb');

const MAP = [
  ['image00152.png', 'Sundial_Reach', 'Sundial Reach', 'A wind-carved canyon where an ancient lunar sundial still tracks the moons.'],
  ['image00153.png', 'Verdant_Atrium', 'Verdant Atrium', 'A vaulted glass conservatory drowning in suspended ferns and pale daylight.'],
  ['image00154.png', 'Frostspan', 'Frostspan', 'A chained bridge stretched between glacial cliffs, groaning under the wind.'],
  ['image00155.png', 'Emberfall_Chasm', 'Emberfall Chasm', 'A volcanic crater where stone steps spiral down into living lava.'],
  ['image00156.png', 'Skywatch_Veil', 'Skywatch Veil', 'A marble balcony rising above the cloud sea, draped in silk and quiet.'],
  ['image00157.png', 'Velvet_Ascent', 'Velvet Ascent', 'A gilded ballroom staircase swallowed by midnight curtains and crystal.'],
  ['image00158.png', 'Tideborn_Hollow', 'Tideborn Hollow', 'A turquoise grotto carved by tides into the bones of a forgotten coast.'],
  ['image00159.png', 'Gearwright_Hall', 'Gearwright Hall', 'Bronze gears the size of towers turning in the lungs of a great machine.'],
  ['image00160.png', 'Rosewine_Maze', 'Rosewine Maze', 'A topiary labyrinth blushing under a long, slow Luna sunset.'],
  ['image00161.png', 'Obsidian_Halls', 'Obsidian Halls', 'Polished black corridors threaded with cold neon — Lunvor at midnight.'],
  ['image00162.png', 'Forgefall_Spires', 'Forgefall Spires', 'Fortress spires hung above a chasm of liquid fire and rising ash.'],
  ['image00163.png', 'Mossbound_Sanctum', 'Mossbound Sanctum', 'A green cathedral surrendered to vine, mist, and the patience of stone.'],
  ['image00164.png', 'Hollow_Frostgate', 'Hollow Frostgate', 'A buried ritual circle beneath cliffs of blue ice, never warmed.'],
  ['image00165.png', 'Masterminds_Court', "Mastermind's Court", 'A violet throne hall where decisions outlive empires.'],
  ['image00166.png', 'Skyforge_Spire', 'Skyforge Spire', 'A pale cliffside cathedral half-swallowed by the sky.'],
  ['image00167.png', 'Drowned_Throne', 'Drowned Throne', 'A gilded throne flooded by green water and shafts of sunken light.'],
  ['image00168.png', 'Endless_Archive', 'The Endless Archive', 'Bridges of black wood threading bookshelves that fall forever down.'],
  ['image00169.png', 'Black_Harbor', 'Black Harbor', 'A rain-soaked dock under gas lamps, where ships unload things best unseen.'],
  ['image00170.png', 'Sunken_Obelisks', 'Sunken Obelisks', 'A valley of obelisks at sundown, carved by a civilization Luna outlived.'],
];

const SRC_DIR = 'C:/Users/Admin/Desktop/New Mells Shop';
const PROFILE_PRICE = 150000;
const RANK_PRICE = 25000;

(async () => {
  for (const v of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL', 'MONGODB_URI']) {
    if (!process.env[v]) throw new Error(`Missing env: ${v}`);
  }

  const PUBLIC = process.env.R2_PUBLIC_URL;
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  console.log('--- Uploading to R2 ---');
  for (const [file, snakeName] of MAP) {
    const buf = fs.readFileSync(path.join(SRC_DIR, file));
    const key = `profiles/${snakeName}.png`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=2592000',
    }));
    console.log(`  ✓ ${key} (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  const newItems = [];
  for (const [, snakeName, name, desc] of MAP) {
    const url = `${PUBLIC}/profiles/${snakeName}.png`;
    newItems.push({
      id: `bg_${snakeName.toLowerCase()}`,
      name,
      description: desc,
      price: PROFILE_PRICE,
      roleId: '',
      backgroundUrl: url,
    });
    newItems.push({
      id: `rank_${snakeName.toLowerCase()}`,
      name: `${name} (Rank)`,
      description: `${desc.replace(/\.$/, '')} — rank banner edition.`,
      price: RANK_PRICE,
      roleId: '',
      rankBackgroundUrl: url,
    });
  }

  console.log('--- Appending to MongoDB (DUAL WRITE) ---');
  // Mells lives in two collections that must stay in sync — see the mirror
  // logic in src/app/api/admin/vendors/route.ts. Each side uses a different
  // schema: vendor_config is typed (`imageUrl` + `type`), butler_shop is the
  // legacy bot-side shape (`backgroundUrl`/`rankBackgroundUrl`). Translate
  // once, write to both.
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('Database');

  // 1. butler_shop (legacy schema — already what newItems use)
  const butlerDoc = await db.collection('bot_config').findOne({ _id: 'butler_shop' });
  const butlerExisting = (butlerDoc && (butlerDoc.data?.items || butlerDoc.items)) || [];
  const butlerIds = new Set(butlerExisting.map((i) => i.id));
  const skippedB = newItems.filter((i) => butlerIds.has(i.id)).map((i) => i.id);
  const toAddB = newItems.filter((i) => !butlerIds.has(i.id));
  const mergedButler = [...butlerExisting, ...toAddB];
  const updatePathB = butlerDoc?.data ? 'data.items' : 'items';
  await db.collection('bot_config').updateOne(
    { _id: 'butler_shop' },
    { $set: { [updatePathB]: mergedButler } }
  );
  console.log(`  ✓ butler_shop: ${butlerExisting.length} → ${mergedButler.length} items (${updatePathB})`);
  if (skippedB.length) console.log(`    skipped: ${skippedB.length} ids already present`);

  // 2. vendor_config.mells_selvair (typed schema — translate from newItems)
  const vendorDoc = await db.collection('vendor_config').findOne({ _id: 'mells_selvair' });
  const vendorExisting = vendorDoc?.data?.items || [];
  const vendorIds = new Set(vendorExisting.map((i) => i.id));
  const toAddV = newItems
    .filter((i) => !vendorIds.has(i.id))
    .map((i) => {
      const out = {
        id: i.id,
        name: i.name,
        price: i.price,
        roleId: i.roleId ?? '',
        description: i.description ?? '',
      };
      if (i.backgroundUrl) {
        out.imageUrl = i.backgroundUrl;
        out.type = 'profile';
      } else if (i.rankBackgroundUrl) {
        out.imageUrl = i.rankBackgroundUrl;
        out.type = 'rank';
      }
      return out;
    });
  const mergedVendor = [...vendorExisting, ...toAddV];
  await db.collection('vendor_config').updateOne(
    { _id: 'mells_selvair' },
    { $set: { 'data.items': mergedVendor, updatedAt: new Date() } },
    { upsert: true }
  );
  console.log(`  ✓ vendor_config.mells_selvair: ${vendorExisting.length} → ${mergedVendor.length} items`);

  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });
