/**
 * check-card-sources.js — Inspect user-owned cards to understand game grouping.
 */
const { MongoClient } = require("mongodb");

const DB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://app:80LaxfR68WuOru8z@cluster0.w1nf05u.mongodb.net/Database";

async function main() {
  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");

  // Get a few user card docs to inspect
  const docs = await db.collection("cards").find().limit(5).toArray();

  const sources = new Set();
  const namePrefixes = new Set();
  let sampleCards = [];

  for (const doc of docs) {
    try {
      const cards = JSON.parse(doc.data);
      for (const card of cards) {
        if (card.source) sources.add(card.source);
        // Check name prefixes
        if (card.name.startsWith("Luna ")) namePrefixes.add("Luna ");
        else if (card.name.startsWith("Bumper")) namePrefixes.add("Bumper");
        else namePrefixes.add("(none/Grand Fantasy)");

        if (sampleCards.length < 15) {
          sampleCards.push({ name: card.name, source: card.source, rarity: card.rarity, id: card.id });
        }
      }
    } catch {}
  }

  console.log("Unique sources:", [...sources]);
  console.log("Name prefixes found:", [...namePrefixes]);
  console.log("\nSample cards:");
  console.log(JSON.stringify(sampleCards, null, 2));

  // Also check if card_catalog has any game field
  const catalogSample = await db.collection("card_catalog").find().limit(3).toArray();
  console.log("\nCatalog sample (checking for game field):");
  console.log(JSON.stringify(catalogSample.map(c => ({ id: c.id, name: c.name, rarity: c.rarity, keys: Object.keys(c) })), null, 2));

  await client.close();
}

main().catch(console.error);
