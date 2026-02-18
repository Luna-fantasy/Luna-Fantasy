/**
 * map-cards-to-games.js — Analyze all user-owned cards to build a
 * mapping of base card name → game (lunaFantasy / grandFantasy / bumper).
 */
const { MongoClient } = require("mongodb");

const DB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://app:80LaxfR68WuOru8z@cluster0.w1nf05u.mongodb.net/Database";

async function main() {
  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");

  const docs = await db.collection("cards").find().toArray();
  console.log(`Scanning ${docs.length} users...\n`);

  const lunaFantasyNames = new Set();
  const bumperNames = new Set();
  const grandFantasyNames = new Set();

  for (const doc of docs) {
    try {
      const cards = JSON.parse(doc.data);
      for (const card of cards) {
        const name = card.name;
        if (name.startsWith("Luna ")) {
          lunaFantasyNames.add(name.replace(/^Luna /, ""));
        } else if (name.startsWith("Bumper")) {
          bumperNames.add(name);
        } else {
          grandFantasyNames.add(name);
        }
      }
    } catch {}
  }

  console.log(`Luna Fantasy cards (${lunaFantasyNames.size}):`);
  console.log([...lunaFantasyNames].sort().join(", "));
  console.log(`\nBumper cards (${bumperNames.size}):`);
  console.log([...bumperNames].sort().join(", "));
  console.log(`\nGrand Fantasy cards (${grandFantasyNames.size}):`);
  console.log([...grandFantasyNames].sort().join(", "));

  // Also get catalog names for cross-reference
  const catalog = await db.collection("card_catalog").find({}, { projection: { id: 1, "name.en": 1 } }).toArray();
  const catalogNames = new Set(catalog.map(c => c.name.en));

  // Check which catalog cards have no game assignment
  const allAssigned = new Set([...lunaFantasyNames, ...bumperNames, ...grandFantasyNames]);
  const unassigned = [...catalogNames].filter(n => !allAssigned.has(n));

  if (unassigned.length > 0) {
    console.log(`\nCatalog cards with no user-owned match (${unassigned.length}):`);
    console.log(unassigned.join(", "));
  } else {
    console.log("\nAll catalog cards have been seen in user collections.");
  }

  await client.close();
}

main().catch(console.error);
