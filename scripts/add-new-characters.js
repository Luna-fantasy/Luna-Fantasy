/**
 * Add new characters from Downloads/charachters/ to R2 and MongoDB.
 *
 * 1. Uploads each image to R2 at characters/{Faction}/{Display Name}.png
 * 2. Inserts character docs into MongoDB `characters` collection
 * 3. Appends to seed-characters.json
 *
 * Usage: node scripts/add-new-characters.js
 * Requires MONGODB_URI env var and wrangler CLI authenticated.
 */

const { MongoClient } = require("mongodb");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SRC_DIR = "/Users/fahedalahmad/Downloads/charachters";
const SEED_FILE = path.resolve(__dirname, "seed-characters.json");
const R2_BUCKET = "assets";
const R2_PREFIX = "characters";
const BASE_URL = "https://assets.lunarian.app/characters";

// Map download folder names to DB faction names and R2 folder names
const FACTION_MAP = {
  beasts:           { dbName: "beasts",             r2Folder: "Beasts" },
  colossals:        { dbName: "colossals",          r2Folder: "Colossals" },
  dragons:          { dbName: "dragons",            r2Folder: "Dragons" },
  knights:          { dbName: "knights",            r2Folder: "Knights" },
  lunarians:        { dbName: "lunarians",          r2Folder: "Lunarians" },
  mythicalcreature: { dbName: "mythical-creatures", r2Folder: "Mythical Creatures" },
  supernatural:     { dbName: "supernaturals",      r2Folder: "Supernaturals" },
  underworld:       { dbName: "underworld",         r2Folder: "Underworld" },
  warriors:         { dbName: "warriors",           r2Folder: "Warriors" },
};

function toDisplayName(filename) {
  const base = filename.replace(/\.(png|jpe?g)$/i, "");
  return base
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toId(filename) {
  const base = filename.replace(/\.(png|jpe?g)$/i, "");
  return base.toLowerCase().replace(/_/g, "-");
}

function getContentType(filename) {
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.jpe?g$/i.test(filename)) return "image/jpeg";
  return "application/octet-stream";
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

  const folders = fs.readdirSync(SRC_DIR).filter((f) => {
    const full = path.join(SRC_DIR, f);
    return fs.statSync(full).isDirectory() && FACTION_MAP[f];
  });

  const newCharacters = [];
  let uploadCount = 0;
  let failCount = 0;

  for (const folder of folders) {
    const { dbName, r2Folder } = FACTION_MAP[folder];
    const folderPath = path.join(SRC_DIR, folder);
    const files = fs.readdirSync(folderPath).filter((f) => /\.(png|jpe?g)$/i.test(f));

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const displayName = toDisplayName(file);
      const id = toId(file);
      const contentType = getContentType(file);

      // Upload to R2 — keep original extension in the R2 key for correct serving
      const ext = file.match(/\.(png|jpe?g)$/i)[0].toLowerCase();
      const r2Key = `${R2_PREFIX}/${r2Folder}/${displayName}${ext}`;
      const imageUrl = `${BASE_URL}/${encodeURIComponent(r2Folder)}/${encodeURIComponent(displayName)}${ext}`;

      console.log(`[${uploadCount + 1}] Uploading ${folder}/${file} → ${r2Key}`);
      try {
        execSync(
          `/usr/local/bin/wrangler r2 object put "${R2_BUCKET}/${r2Key}" --file="${filePath}" --content-type="${contentType}" --remote`,
          { stdio: "pipe", timeout: 30000 }
        );
        uploadCount++;
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        failCount++;
        continue; // skip DB insert if upload fails
      }

      newCharacters.push({
        id,
        name: { en: displayName, ar: displayName },
        faction: dbName,
        imageUrl,
        isMainCharacter: false,
      });
    }
  }

  console.log(`\nUploaded ${uploadCount} images (${failCount} failed).`);
  console.log(`Inserting ${newCharacters.length} characters into MongoDB...`);

  // Insert into MongoDB
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("Database");
  const col = db.collection("characters");

  // Upsert each character to avoid duplicates
  for (const char of newCharacters) {
    await col.updateOne(
      { id: char.id, faction: char.faction },
      { $set: char },
      { upsert: true }
    );
  }

  console.log(`Inserted/updated ${newCharacters.length} characters in DB.`);

  // Update seed file
  const existingSeed = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8"));
  const existingIds = new Set(existingSeed.map((c) => `${c.faction}:${c.id}`));
  const toAdd = newCharacters.filter((c) => !existingIds.has(`${c.faction}:${c.id}`));
  if (toAdd.length > 0) {
    const updated = [...existingSeed, ...toAdd];
    fs.writeFileSync(SEED_FILE, JSON.stringify(updated, null, 2) + "\n");
    console.log(`Added ${toAdd.length} characters to seed-characters.json (total: ${updated.length}).`);
  }

  await client.close();
  console.log("Done.");
}

main().catch(console.error);
