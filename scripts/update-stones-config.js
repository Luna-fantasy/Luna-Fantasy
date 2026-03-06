#!/usr/bin/env node
/**
 * Update stones_config collection in MongoDB with R2 image URLs.
 * Reads stone data from LunaJester config and writes to stones_config collection.
 *
 * Usage: node scripts/update-stones-config.js
 */

const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1].trim()]) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const R2_BASE = 'https://assets.lunarian.app';

// Map local image paths to R2 URLs, with filename fixes
const FILENAME_FIXES = {
  'shuran_s_heart.png': 'shuran_heart.png', // actual file on disk is shuran_heart.png
};

function localToUrl(localPath) {
  // "./images/stones/lunar_stone.png" → "https://assets.lunarian.app/stones/lunar_stone.png"
  let filename = localPath.replace(/^\.\//, '').replace(/^images\//, '');
  const base = path.basename(filename);
  if (FILENAME_FIXES[base]) {
    filename = filename.replace(base, FILENAME_FIXES[base]);
  }
  return `${R2_BASE}/${filename}`;
}

function getRarity(weight) {
  if (weight >= 15) return 'COMMON';
  if (weight >= 5) return 'UNCOMMON';
  if (weight >= 1) return 'RARE';
  if (weight >= 0.1) return 'EPIC';
  if (weight > 0) return 'LEGENDARY';
  return 'SPECIAL';
}

// Stone data from LunaJester config.ts
const REGULAR_STONES = [
  { name: 'Lunar Stone', imageUrl: './images/stones/lunar_stone.png', weight: 20, sell_price: 500, emoji_id: '1458987974363713719' },
  { name: 'Silver Beach Gem', imageUrl: './images/stones/silver_beach_gem.png', weight: 15, sell_price: 750, emoji_id: '1458988122216988857' },
  { name: 'Wishmaster Broken Cube', imageUrl: './images/stones/wishmaster_broken_cube.png', weight: 10, sell_price: 1000, emoji_id: '1458988190361845872' },
  { name: "Dragon's Tear", imageUrl: './images/stones/dragon_s_tear.png', weight: 5, sell_price: 1500, emoji_id: '1458987818842849331' },
  { name: 'Solar Stone', imageUrl: './images/stones/solar_stone.png', weight: 3, sell_price: 2000, emoji_id: '1458988144530817210' },
  { name: 'Galaxy Stone', imageUrl: './images/stones/galaxy_stone.png', weight: 1, sell_price: 3000, emoji_id: '1458987881413480489' },
  { name: 'Stone of Wisdom', imageUrl: './images/stones/stone_of_wisdom.png', weight: 0.5, sell_price: 5000, emoji_id: '1458988167037452329' },
  { name: 'Astral Prism', imageUrl: './images/stones/astral_prism.png', weight: 0.2, sell_price: 7500, emoji_id: '1458987670683389972' },
  { name: 'Eternal Stone', imageUrl: './images/stones/eternal_stone.png', weight: 0.1, sell_price: 10000, emoji_id: '1458987853710233817' },
  { name: 'Mastermind Stone', imageUrl: './images/stones/mastermind_stone.png', weight: 0.05, sell_price: 15000, emoji_id: '1458987996987785228' },
  { name: 'Luna Moon Stone', imageUrl: './images/stones/luna_moon_stone.png', weight: 0, sell_price: 15000, emoji_id: '1458987950363906195' },
  { name: 'Moonbound Emerald', imageUrl: './images/stones/moonbound_emerald.png', weight: 0, sell_price: 20000, emoji_id: '1458988047113654273' },
];

const FORBIDDEN_STONES = [
  { name: 'Chaos Pearl', imageUrl: './images/stones/chaos_pearl.png', weight: 0, sell_price: 0, emoji_id: '1458987771581436131', hint: "Seek A Mastermind's Seal", giver_title: 'Mastermind' },
  { name: "Shuran's Heart", imageUrl: './images/stones/shuran_s_heart.png', weight: 0, sell_price: 0, emoji_id: '1458988073995206957', hint: "Seek a Sentinel's Seal", giver_title: 'Sentinel' },
  { name: 'Halo Core', imageUrl: './images/stones/halo_core.png', weight: 0, sell_price: 0, emoji_id: '1458987925046825178', hint: "Seek a Guardian's Seal", giver_title: 'Guardian' },
];

async function main() {
  console.log('Connecting to MongoDB...');
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db('Database');
  const col = db.collection('stones_config');

  // Build regular stone docs
  const regularDocs = REGULAR_STONES.map(s => ({
    name: s.name,
    rarity: getRarity(s.weight),
    weight: s.weight,
    sell_price: s.sell_price,
    emoji_id: s.emoji_id,
    imageUrl: localToUrl(s.imageUrl),
    type: 'regular',
  }));

  // Build forbidden stone docs
  const forbiddenDocs = FORBIDDEN_STONES.map(s => ({
    name: s.name,
    rarity: 'FORBIDDEN',
    weight: s.weight,
    sell_price: s.sell_price,
    emoji_id: s.emoji_id,
    hint: s.hint,
    giver_title: s.giver_title,
    imageUrl: localToUrl(s.imageUrl),
    type: 'forbidden',
  }));

  // Update using st.db pattern: { _id: "regular", data: [...] }
  await col.updateOne(
    { _id: 'regular' },
    { $set: { data: regularDocs } },
    { upsert: true }
  );
  console.log(`[stones_config] regular: ${regularDocs.length} stones`);

  await col.updateOne(
    { _id: 'forbidden' },
    { $set: { data: forbiddenDocs } },
    { upsert: true }
  );
  console.log(`[stones_config] forbidden: ${forbiddenDocs.length} stones`);

  // Print URLs for verification
  console.log('\nImage URLs:');
  [...regularDocs, ...forbiddenDocs].forEach(s => {
    console.log(`  ${s.name}: ${s.imageUrl}`);
  });

  console.log(`\nDone — ${regularDocs.length + forbiddenDocs.length} stones updated.`);
  await client.close();
}

main().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
