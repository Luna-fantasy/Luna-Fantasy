/**
 * assign-card-games.js — Add a `game` field to every card in card_catalog.
 *
 * Logic derived from scanning 534 users' card collections:
 * - Cards whose names appear with "Luna " prefix → game: "lunaFantasy"
 * - Cards whose names appear with "Bumper" prefix → game: "bumper"
 * - Everything else → game: "grandFantasy"
 */
const { MongoClient } = require("mongodb");

const DB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://app:80LaxfR68WuOru8z@cluster0.w1nf05u.mongodb.net/Database";

// From the user-owned cards scan (534 users):
// Luna Fantasy base names (stripped "Luna " prefix)
const LUNA_FANTASY_NAMES = new Set([
  "Alchemist", "Archer", "Assassin", "Baby Wisp", "Bard", "Battlemage",
  "Blacksmith", "Blademaster", "Builder", "Centaur", "Champion", "Chimera",
  "Clown", "Cobra", "Cook", "Cyclops", "Dark Wizard", "Deer", "Direwolf",
  "Draconis", "Dragon", "Dragonslayer", "Druid", "Executioner", "Farmer",
  "Forager", "Ghoul", "Giant", "Goblin", "Golem", "Grandmaster", "Griffin",
  "Guard", "Guardian", "Harbinger", "Healer", "Herald", "Hound", "Hunter",
  "Imp", "King", "Knight", "Lycan", "Lynx", "Mad Crow", "Medusa",
  "Mercenary", "Mermaid", "Midgets", "Monk", "Moonveil", "Ogre", "Orc",
  "Outcast", "Owl", "Pacifier", "Paladin", "Panthera", "Peacock", "Pegasus",
  "Phantom", "Phoenix", "Prince", "Princess", "Prisoner", "Queen", "Rabbit",
  "Revenant", "Sage", "Seer", "Sentinel", "Shadow", "Silverbird", "Siren",
  "Skull-Crusher", "Specter", "Sphinx", "Thief", "Toad", "Trickster",
  "Twins", "Umbra", "Umbreon", "Vampire", "Vanguard", "Villagers",
  "Viperclaw", "Vulmir", "Wanderer", "Warlord", "Werewolf", "Wisp",
  "Witch", "Wizard", "Wraith", "Yonko"
]);

// Bumper names (as-is)
const BUMPER_NAMES = new Set(["Bumper 1", "Bumper 2", "Bumper 3"]);

// Catalog name.en → Luna Fantasy name aliases
// (some catalog names differ from what users see)
const CATALOG_TO_LUNA_ALIASES = {
  "Silver Bird": "Silverbird",
  "Battle Mage": "Battlemage",
  "Prime Zoldar": "Zoldar",
  "Luna Druin": "Druid",
  "Dragon Slayer": "Dragonslayer",
  "Luneth & Cavor": "Twins",
  "Luna King": "King",
  "Luna Queen": "Queen",
};

// Catalog name.en → Grand Fantasy name aliases
const CATALOG_TO_GF_ALIASES = {
  "Abyss Colossus": "Abyssal Colossus",
  "Astral Bringer": "Astral Harbinger",
  "Null Bringer": "Nullbringer",
  "Rune Breaker": "Runebreaker",
  "Saber Tooth": "Sabertooth",
  "Silver Beach Guardian": "Silverbeach Guardian",
  "Corrupted Sentinel": "The Corrupted Sentinel",
};

function determineGame(catalogNameEn) {
  // Direct Luna Fantasy match
  if (LUNA_FANTASY_NAMES.has(catalogNameEn)) return "lunaFantasy";

  // Check Luna aliases
  if (CATALOG_TO_LUNA_ALIASES[catalogNameEn]) {
    const alias = CATALOG_TO_LUNA_ALIASES[catalogNameEn];
    if (LUNA_FANTASY_NAMES.has(alias)) return "lunaFantasy";
  }

  // Direct Bumper match (catalog card named "Bumper")
  if (catalogNameEn === "Bumper" || BUMPER_NAMES.has(catalogNameEn)) return "bumper";

  // Grand Fantasy alias check
  if (CATALOG_TO_GF_ALIASES[catalogNameEn]) return "grandFantasy";

  // Default: Grand Fantasy (matches the groupCards logic)
  return "grandFantasy";
}

async function main() {
  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");
  const collection = db.collection("card_catalog");

  const cards = await collection.find({}).toArray();
  console.log(`Processing ${cards.length} catalog cards...\n`);

  const counts = { lunaFantasy: 0, grandFantasy: 0, bumper: 0 };

  for (const card of cards) {
    const game = determineGame(card.name.en);
    counts[game]++;

    await collection.updateOne(
      { _id: card._id },
      { $set: { game } }
    );
  }

  console.log("Game assignments:");
  console.log(`  Luna Fantasy: ${counts.lunaFantasy}`);
  console.log(`  Grand Fantasy: ${counts.grandFantasy}`);
  console.log(`  Bumper: ${counts.bumper}`);
  console.log(`  Total: ${counts.lunaFantasy + counts.grandFantasy + counts.bumper}`);

  // Create index on game field
  await collection.createIndex({ game: 1 });
  console.log("\nIndex created on game field.");

  // Verify
  const lunaCount = await collection.countDocuments({ game: "lunaFantasy" });
  const gfCount = await collection.countDocuments({ game: "grandFantasy" });
  const bumperCount = await collection.countDocuments({ game: "bumper" });
  console.log(`\nVerification — Luna: ${lunaCount}, Grand: ${gfCount}, Bumper: ${bumperCount}`);

  await client.close();
}

main().catch(console.error);
