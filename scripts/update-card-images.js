/**
 * update-card-images.js — Match DB cards to JSON CDN URLs and update imageUrl.
 *
 * Usage:  NODE_PATH=./node_modules node scripts/update-card-images.js
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const DB_URI =
  "mongodb+srv://app:80LaxfR68WuOru8z@cluster0.w1nf05u.mongodb.net/Database";

const CDN_DOMAIN = "https://assets.lunarian.app";

// Manual name aliases: DB name → JSON name.en
const ALIASES = {
  "Luna Silverbird": "Silver Bird",
  "Runebreaker": "Rune Breaker",
  "Silverbeach Guardian": "Silver Beach Guardian",
  "Sabertooth": "Saber Tooth",
  "Luna Battlemage": "Battle Mage",
  "Zoldar": "Prime Zoldar",
  "Abyssal Colossus": "Abyss Colossus",
  "Nullbringer": "Null Bringer",
  "Luna Dragonslayer": "Dragon Slayer",
  "Luna Twins": "Luneth & Cavor",
  "The Corrupted Sentinel": "Corrupted Sentinel",
  "Astral Harbinger": "Astral Bringer",
};

async function main() {
  // Load JSON card data
  const jsonPath = path.join(__dirname, "..", "data", "cards.json");
  const jsonCards = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  // Build name → CDN URL map (replace domain)
  const cdnMap = new Map();
  for (const card of jsonCards) {
    const url = card.imageUrl.replace(
      "https://assets.luna-fantasy.com",
      CDN_DOMAIN
    );
    cdnMap.set(card.name.en, url);
  }
  console.log(`Loaded ${cdnMap.size} cards from JSON with CDN URLs`);

  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");

  const docs = await db.collection("cards").find().toArray();
  console.log(`Found ${docs.length} users with cards\n`);

  let totalCards = 0;
  let updated = 0;
  let skipped = 0;
  let alreadyCdn = 0;
  let usersUpdated = 0;

  for (const doc of docs) {
    const cards = JSON.parse(doc.data);
    let changed = false;

    for (const card of cards) {
      totalCards++;

      // Skip if already a CDN URL
      if (card.imageUrl && card.imageUrl.startsWith("https://")) {
        alreadyCdn++;
        continue;
      }

      const name = card.name;
      let cdnUrl = null;

      // 1. Exact match
      if (cdnMap.has(name)) {
        cdnUrl = cdnMap.get(name);
      }
      // 2. Strip "Luna " prefix
      else if (name.startsWith("Luna ") && cdnMap.has(name.slice(5))) {
        cdnUrl = cdnMap.get(name.slice(5));
      }
      // 3. Manual alias
      else if (ALIASES[name] && cdnMap.has(ALIASES[name])) {
        cdnUrl = cdnMap.get(ALIASES[name]);
      }
      // 4. Strip "Luna " then check alias
      else if (name.startsWith("Luna ") && ALIASES[name] && cdnMap.has(ALIASES[name])) {
        cdnUrl = cdnMap.get(ALIASES[name]);
      }

      if (cdnUrl) {
        card.imageUrl = cdnUrl;
        updated++;
        changed = true;
      } else {
        skipped++;
      }
    }

    if (changed) {
      await db
        .collection("cards")
        .updateOne({ _id: doc._id }, { $set: { data: JSON.stringify(cards) } });
      usersUpdated++;
    }
  }

  console.log(`Total cards scanned: ${totalCards}`);
  console.log(`Updated with CDN URL: ${updated}`);
  console.log(`Already CDN: ${alreadyCdn}`);
  console.log(`Skipped (no match): ${skipped}`);
  console.log(`Users updated: ${usersUpdated}/${docs.length}`);

  await client.close();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
