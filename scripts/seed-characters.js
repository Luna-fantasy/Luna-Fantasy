/**
 * seed-characters.js — Insert all character entries into MongoDB.
 *
 * Seeds the `characters` collection with all character data
 * (with image URLs pointing to assets.lunarian.app).
 *
 * Usage:  node scripts/seed-characters.js
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const DB_URI = process.env.MONGODB_URI;
if (!DB_URI) {
  console.error("Error: MONGODB_URI environment variable is required.");
  process.exit(1);
}

async function main() {
  const jsonPath = path.join(__dirname, "seed-characters.json");
  const characters = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Loaded ${characters.length} characters from seed-characters.json`);

  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");
  const collection = db.collection("characters");

  // Check what's already in the DB
  const existingCount = await collection.countDocuments();
  console.log(`Existing characters documents: ${existingCount}`);

  // Get existing IDs to find what's missing
  const existingDocs = await collection.find({}, { projection: { id: 1 } }).toArray();
  const existingIds = new Set(existingDocs.map((d) => d.id));

  const missingCharacters = characters.filter((c) => !existingIds.has(c.id));

  if (missingCharacters.length === 0) {
    console.log("All characters already exist in the database. Nothing to insert.");
  } else {
    console.log(`Inserting ${missingCharacters.length} missing characters...`);
    const result = await collection.insertMany(missingCharacters);
    console.log(`Inserted ${result.insertedCount} characters.`);
  }

  // Verify final count
  const finalCount = await collection.countDocuments();
  console.log(`\nFinal characters count: ${finalCount}`);
  console.log(`Expected from JSON: ${characters.length}`);

  if (finalCount === characters.length) {
    console.log("Database is fully in sync with seed-characters.json.");
  } else if (finalCount > characters.length) {
    console.log(
      `DB has ${finalCount - characters.length} extra characters not in JSON (this is fine if characters were added directly to DB).`
    );
  } else {
    console.log("WARNING: Some characters may still be missing.");
  }

  // Create index on id field for fast lookups
  await collection.createIndex({ id: 1 }, { unique: true });
  // Create index on faction for filtered queries
  await collection.createIndex({ faction: 1 });
  console.log("Indexes created on id and faction.");

  await client.close();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
