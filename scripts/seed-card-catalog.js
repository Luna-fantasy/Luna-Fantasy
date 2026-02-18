/**
 * seed-card-catalog.js — Insert all card catalog entries into MongoDB.
 *
 * This seeds the `card_catalog` collection with the full deck of cards
 * (the public card definitions, not user-owned cards).
 *
 * Usage:  node scripts/seed-card-catalog.js
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const DB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://app:80LaxfR68WuOru8z@cluster0.w1nf05u.mongodb.net/Database";

async function main() {
  const jsonPath = path.join(__dirname, "..", "data", "cards.json");
  const cards = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Loaded ${cards.length} cards from cards.json`);

  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");
  const collection = db.collection("card_catalog");

  // Check what's already in the DB
  const existingCount = await collection.countDocuments();
  console.log(`Existing card_catalog documents: ${existingCount}`);

  // Get existing IDs to find what's missing
  const existingDocs = await collection.find({}, { projection: { id: 1 } }).toArray();
  const existingIds = new Set(existingDocs.map((d) => d.id));

  const missingCards = cards.filter((c) => !existingIds.has(c.id));

  if (missingCards.length === 0) {
    console.log("All cards already exist in the database. Nothing to insert.");
  } else {
    console.log(`Inserting ${missingCards.length} missing cards...`);
    const result = await collection.insertMany(missingCards);
    console.log(`Inserted ${result.insertedCount} cards.`);
  }

  // Verify final count
  const finalCount = await collection.countDocuments();
  console.log(`\nFinal card_catalog count: ${finalCount}`);
  console.log(`Expected from JSON: ${cards.length}`);

  if (finalCount === cards.length) {
    console.log("Database is fully in sync with cards.json.");
  } else if (finalCount > cards.length) {
    console.log(
      `DB has ${finalCount - cards.length} extra cards not in JSON (this is fine if cards were added directly to DB).`
    );
  } else {
    console.log("WARNING: Some cards may still be missing.");
  }

  // Create index on id field for fast lookups
  await collection.createIndex({ id: 1 }, { unique: true });
  // Create index on rarity for filtered queries
  await collection.createIndex({ rarity: 1 });
  console.log("Indexes created on id and rarity.");

  await client.close();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
