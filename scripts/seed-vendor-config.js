/**
 * seed-vendor-config.js — Populate the `vendor_config` collection in MongoDB.
 *
 * This creates one document per shop (keyed by shop ID) using the st.db
 * pattern: { _id: "brimor", data: { title, description, image, items } }
 *
 * The bot's shop.ts and the web app both read from this collection,
 * so items are defined in one place instead of hardcoded in config files.
 *
 * Usage:  MONGODB_URI="mongodb://..." node scripts/seed-vendor-config.js
 *
 * Re-running is safe — uses replaceOne with upsert, so existing docs
 * are overwritten with the latest data.
 */

const { MongoClient } = require("mongodb");

const DB_URI = process.env.MONGODB_URI;
if (!DB_URI) {
  console.error("Error: MONGODB_URI environment variable is required.");
  process.exit(1);
}

// ── Helpers ──

const PROFILES_BASE = "https://assets.lunarian.app/profiles";

function bg(id, name, price, filename) {
  return { id, name, price, roleId: "", description: "", imageUrl: `${PROFILES_BASE}/${filename}`, type: "profile" };
}

function rank(id, name, price, filename) {
  return { id, name, price, roleId: "", description: "", imageUrl: `${PROFILES_BASE}/${filename}`, type: "rank" };
}

// ── Shop definitions (sourced from LunaJester/config.ts + LunaButler/config.ts) ──

const SHOPS = {
  mells_selvair: {
    title: "Mells Selvair's Gallery",
    description: "Welcome, traveler. I deal in visions... profile backgrounds that reflect your soul.",
    image: "https://assets.lunarian.app/shops/mells_selvair.png",
    items: [
      // ── Profile Backgrounds (28) ──
      bg("bg_calm_bath",          "Calm Bath",          5000,   "Calm_Bath.png"),
      bg("bg_dark_gate",          "Dark Gate",          5000,   "Dark_Gate.png"),
      bg("bg_library",            "Library",            5000,   "Library.png"),
      bg("bg_silverbeach_gate",   "Silverbeach Gate",   5000,   "Silverbeach_gate.jpeg"),
      bg("bg_lovers_hideaway",    "Lovers Hideaway",    10000,  "Lovers_hideaway.png"),
      bg("bg_rocky_terrain",      "Rocky Terrain",      10000,  "Rocky_terrain.png"),
      bg("bg_molten_road",        "Molten Road",        10000,  "Molten_Road.png"),
      bg("bg_rose_garden",        "Rose Garden",        20000,  "Rose_Garden.png"),
      bg("bg_royal_palace",       "Royal Palace",       20000,  "Royal_Palace.png"),
      bg("bg_alchemist_desk",     "Alchemist Desk",     20000,  "Alchemist_Desk.jpeg"),
      bg("bg_golden_garden",      "Golden Garden",      20000,  "Golden_Garden.png"),
      bg("bg_bloodforged_decay",  "Bloodforged Decay",  25000,  "Bloodforged_Decay.jpeg"),
      bg("bg_dark_wizard",        "Dark Wizard",        25000,  "Dark_Wizard.jpeg"),
      bg("bg_crystal_palace",     "Crystal Palace",     50000,  "Crystall_Palace.png"),
      bg("bg_fountain_of_beauty", "Fountain of Beauty", 50000,  "Fountain_Of_Beauty.png"),
      bg("bg_mushroom_paradise",  "Mushroom Paradise",  50000,  "Mushroom_Paradise.png"),
      bg("bg_romantic_canal",     "Romantic Canal",     50000,  "Romantic_Canal.png"),
      bg("bg_runic_ruins",        "Runic Ruins",        50000,  "Runic_Ruins.jpeg"),
      bg("bg_neon_bazaar",        "Neon Bazaar Alley",  75000,  "Neon_Bazaar_Alley.png"),
      bg("bg_royal_hall",         "Royal Hall",         75000,  "Royal_Hall.png"),
      bg("bg_atlantic_passage",   "Atlantic Passage",   75000,  "Atlantic_Passage.png"),
      bg("bg_floating_monolith",  "Floating Monolith",  75000,  "Floating_Monolith.png"),
      bg("bg_opulent_palace",     "Opulent Palace",     75000,  "Opulent_Palace.png"),
      bg("bg_tranquil_hideaway",  "Tranquil Hideaway",  75000,  "Tranquil_Hideaway.jpeg"),
      bg("bg_observatory",        "Observatory",        100000, "Observatory.png"),
      bg("bg_ethereal_home",      "Ethereal Home",      100000, "Ethereal_Home.png"),
      bg("bg_bank_vault",         "Bank Vault",         150000, "Bank_Vault.png"),
      bg("bg_spaceway",           "Spaceway",           150000, "Spaceway.png"),

      // ── Rank Backgrounds (28) ──
      rank("rank_calm_bath",          "Calm Bath",          1000,  "Calm_Bath.png"),
      rank("rank_dark_gate",          "Dark Gate",          1000,  "Dark_Gate.png"),
      rank("rank_library",            "Library",            1000,  "Library.png"),
      rank("rank_silverbeach_gate",   "Silverbeach Gate",   1000,  "Silverbeach_gate.jpeg"),
      rank("rank_lovers_hideaway",    "Lovers Hideaway",    2000,  "Lovers_hideaway.png"),
      rank("rank_rocky_terrain",      "Rocky Terrain",      2000,  "Rocky_terrain.png"),
      rank("rank_molten_road",        "Molten Road",        2000,  "Molten_Road.png"),
      rank("rank_rose_garden",        "Rose Garden",        5000,  "Rose_Garden.png"),
      rank("rank_royal_palace",       "Royal Palace",       5000,  "Royal_Palace.png"),
      rank("rank_alchemist_desk",     "Alchemist Desk",     5000,  "Alchemist_Desk.jpeg"),
      rank("rank_golden_garden",      "Golden Garden",      5000,  "Golden_Garden.png"),
      rank("rank_bloodforged_decay",  "Bloodforged Decay",  6000,  "Bloodforged_Decay.jpeg"),
      rank("rank_dark_wizard",        "Dark Wizard",        6000,  "Dark_Wizard.jpeg"),
      rank("rank_crystal_palace",     "Crystal Palace",     10000, "Crystall_Palace.png"),
      rank("rank_fountain_of_beauty", "Fountain of Beauty", 10000, "Fountain_Of_Beauty.png"),
      rank("rank_mushroom_paradise",  "Mushroom Paradise",  10000, "Mushroom_Paradise.png"),
      rank("rank_romantic_canal",     "Romantic Canal",     10000, "Romantic_Canal.png"),
      rank("rank_runic_ruins",        "Runic Ruins",        10000, "Runic_Ruins.jpeg"),
      rank("rank_neon_bazaar",        "Neon Bazaar Alley",  15000, "Neon_Bazaar_Alley.png"),
      rank("rank_royal_hall",         "Royal Hall",         15000, "Royal_Hall.png"),
      rank("rank_atlantic_passage",   "Atlantic Passage",   15000, "Atlantic_Passage.png"),
      rank("rank_floating_monolith",  "Floating Monolith",  15000, "Floating_Monolith.png"),
      rank("rank_opulent_palace",     "Opulent Palace",     15000, "Opulent_Palace.png"),
      rank("rank_tranquil_hideaway",  "Tranquil Hideaway",  15000, "Tranquil_Hideaway.jpeg"),
      rank("rank_observatory",        "Observatory",        20000, "Observatory.png"),
      rank("rank_ethereal_home",      "Ethereal Home",      20000, "Ethereal_Home.png"),
      rank("rank_bank_vault",         "Bank Vault",         25000, "Bank_Vault.png"),
      rank("rank_spaceway",           "Spaceway",           25000, "Spaceway.png"),
    ],
  },
  brimor: {
    title: "Brimor",
    description: "Hey! I'm Brimor. The best merchant in Luna Bazaar!",
    image: "https://assets.lunarian.app/shops/brimor.png",
    items: [
      { id: "Candy", name: "Candy", price: 250000, roleId: "1417273583054360602", description: "Sweet and playful, a taste of delight.", gradientColors: ["#e138ea", "#3af3b5"] },
      { id: "Moon", name: "Moon", price: 300000, roleId: "1417273968745906339", description: "Bathed in silver light and quiet power.", gradientColors: ["#9a9a9a", "#12121b"] },
      { id: "Dragon", name: "Dragon", price: 350000, roleId: "1417214070263779348", description: "Ancient strength born from flame and legend.", gradientColors: ["#cf5a00", "#730c00"] },
      { id: "Darkness", name: "Darkness", price: 400000, roleId: "1417273816475762770", description: "Calm in shadow, unseen yet ever near.", gradientColors: ["#0e0e0f", "#192131"] },
      { id: "Vampire", name: "Vampire", price: 450000, roleId: "1417265958501744753", description: "Elegant hunger bound by eternal night.", gradientColors: ["#030205", "#4a0900"] },
      { id: "Sapphire", name: "Sapphire", price: 500000, roleId: "1417296847550283846", description: "Cool wisdom glimmering like ocean glass.", gradientColors: ["#001764", "#0454e8"] },
      { id: "Emerald", name: "Emerald", price: 550000, roleId: "1417297359066366122", description: "Life's quiet pulse wrapped in green flame.", gradientColors: ["#c0ffb5", "#00ff77"] },
      { id: "Opal", name: "Opal", price: 600000, roleId: "1417298101433008239", description: "Shifting hues of truth and illusion.", gradientColors: ["#ae9fe0", "#85ba9d"] },
      { id: "Ruby", name: "Ruby", price: 650000, roleId: "1417297864366886953", description: "Heartfire burning with unyielding passion.", gradientColors: ["#e5006b", "#69063c"] },
      { id: "Diamond", name: "Diamond", price: 750000, roleId: "1416924911116750899", description: "Enduring light forged through pressure and time.", gradientColors: ["#ebe7f4", "#10b9d7"] },
      { id: "Phantom", name: "Phantom", price: 850000, roleId: "1419173035185016852", description: "Fleeting soul between light and void.", gradientColors: ["#5a585f", "#691428"] },
      { id: "Titan", name: "Titan", price: 950000, roleId: "1419173032710111242", description: "Unshaken might carved from the earth.", gradientColors: ["#020006", "#666f7f"] },
      { id: "Royal", name: "Royal", price: 1050000, roleId: "1419173030222889053", description: "Grace under weight, crowned by resolve.", gradientColors: ["#dcbb24", "#7d0a0a"] },
      { id: "Special", name: "Special", price: 1150000, roleId: "1419173027224096870", description: "A name whispered long after silence.", gradientColors: ["#5a0298", "#419f1f"] },
      { id: "Mythical", name: "Mythical", price: 1250000, roleId: "1419173019724808333", description: "Half truth, half dream, fully eternal.", gradientColors: ["#2b83e7", "#5b040a"] },
      { id: "CustomRole", name: "Custom Role", price: 1500000, roleId: "1419769254076743730", description: "Your own mark upon the realm.", gradientColors: ["#afaf0f", "#79ffef"] },
    ],
  },
  broker: {
    title: "Broker",
    description: "Broker, The merchant",
    image: "https://assets.lunarian.app/shops/broker.png",
    items: [
      { id: "LunaSeer", name: "Luna Seer", price: 1250000, roleId: "1418434533639979020", description: "Eyes that pierce the veil of fate." },
      { id: "LunaThief", name: "Luna Thief", price: 1500000, roleId: "1417704454869745715", description: "Silent hands that claim what others guard." },
    ],
  },
};

async function main() {
  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");
  const collection = db.collection("vendor_config");

  console.log("Seeding vendor_config collection...\n");

  for (const [shopId, shopData] of Object.entries(SHOPS)) {
    // st.db pattern: { _id: shopId, data: shopData }
    const result = await collection.replaceOne(
      { _id: shopId },
      { _id: shopId, data: shopData },
      { upsert: true }
    );

    const action = result.upsertedCount > 0 ? "INSERTED" : "UPDATED";
    console.log(`  [${action}] ${shopId} — ${shopData.items.length} items`);
  }

  const total = await collection.countDocuments();
  console.log(`\nDone. vendor_config now has ${total} document(s).`);

  await client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
