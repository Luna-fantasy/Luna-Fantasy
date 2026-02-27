/**
 * Seed luna_pairs_config collection with faction data.
 * Each doc: { _id: factionKey, data: { name, color, cards } }
 *
 * Usage: node scripts/seed-luna-pairs-config.js
 * Requires MONGODB_URI env var.
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const IMAGES_DIR = path.resolve(__dirname, "../../LunaJester/images/LunaPairs");

// Faction definitions: key → { en, ar, color, prefix patterns }
const FACTIONS = {
  beasts: {
    name: { en: "Beasts", ar: "الوحوش" },
    color: "#8B4513",
    prefixes: ["beasts_"],
  },
  colossals: {
    name: { en: "Colossals", ar: "العمالقة" },
    color: "#708090",
    prefixes: ["colossals_"],
  },
  dragons: {
    name: { en: "Dragons", ar: "التنانين" },
    color: "#DC143C",
    prefixes: ["dragons_", "dragon_"],
  },
  knights: {
    name: { en: "Knights", ar: "الفرسان" },
    color: "#4169E1",
    prefixes: ["knights_"],
  },
  lunarians: {
    name: { en: "Lunarians", ar: "اللوناريون" },
    color: "#9370DB",
    prefixes: ["lunarians_"],
  },
  moon_creatures: {
    name: { en: "Moon Creatures", ar: "مخلوقات القمر" },
    color: "#2E8B57",
    prefixes: ["mooncreatures_"],
  },
  mythical_creatures: {
    name: { en: "Mythical Creatures", ar: "المخلوقات الأسطورية" },
    color: "#DAA520",
    prefixes: ["mythicalcreatures_", "mythicalcreature_"],
  },
  strange_beings: {
    name: { en: "Strange Beings", ar: "الكائنات الغريبة" },
    color: "#8A2BE2",
    prefixes: ["strangebeings_"],
  },
  supernatural: {
    name: { en: "Supernatural", ar: "الخارقون" },
    color: "#800020",
    prefixes: ["supernatural_"],
  },
  underworld: {
    name: { en: "Underworld", ar: "العالم السفلي" },
    color: "#2F4F4F",
    prefixes: ["underworld_"],
  },
  warriors: {
    name: { en: "Warriors", ar: "المحاربون" },
    color: "#CD853F",
    prefixes: ["warriors_"],
  },
};

function toDisplayName(filename, prefixes) {
  let raw = filename.replace(".png", "");
  for (const p of prefixes) {
    if (raw.startsWith(p)) {
      raw = raw.slice(p.length);
      break;
    }
  }
  // Replace underscores with spaces, preserve hyphens, title-case each word
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  // Read all image files
  const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith(".png") && f !== "LunaPairs_BG.png");

  // Assign files to factions
  const factionCards = {};
  for (const key of Object.keys(FACTIONS)) {
    factionCards[key] = [];
  }

  for (const file of files) {
    let assigned = false;
    for (const [key, faction] of Object.entries(FACTIONS)) {
      for (const prefix of faction.prefixes) {
        if (file.toLowerCase().startsWith(prefix.toLowerCase())) {
          factionCards[key].push({
            name: toDisplayName(file, faction.prefixes),
            image: file,
          });
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }
    if (!assigned) {
      console.warn(`Unassigned file: ${file}`);
    }
  }

  // Sort cards within each faction alphabetically
  for (const key of Object.keys(factionCards)) {
    factionCards[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("Database");
  const col = db.collection("luna_pairs_config");

  // Upsert each faction
  let total = 0;
  for (const [key, faction] of Object.entries(FACTIONS)) {
    const cards = factionCards[key];
    total += cards.length;
    await col.updateOne(
      { _id: key },
      {
        $set: {
          data: {
            name: faction.name,
            color: faction.color,
            cards,
          },
        },
      },
      { upsert: true }
    );
    console.log(`${key}: ${cards.length} cards`);
  }

  console.log(`\nSeeded ${Object.keys(FACTIONS).length} factions, ${total} total cards.`);
  await client.close();
}

main().catch(console.error);
