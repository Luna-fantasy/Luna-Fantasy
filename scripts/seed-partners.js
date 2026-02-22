/**
 * seed-partners.js — Insert partner data into MongoDB.
 *
 * Seeds the `partners` collection with partner entries.
 * Logo URLs point to R2 CDN (assets.lunarian.app).
 *
 * Usage:  node scripts/seed-partners.js
 */

const { MongoClient } = require("mongodb");

const DB_URI = process.env.MONGODB_URI;
if (!DB_URI) {
  console.error("Error: MONGODB_URI environment variable is required.");
  process.exit(1);
}

const partners = [
  {
    id: "gamer-snack",
    name: "Gamer Snack",
    type: { en: "Gaming Content Creator", ar: "صانع محتوى ألعاب" },
    description: {
      en: "A popular gaming content creator delivering entertaining gaming content across multiple platforms. From gameplay highlights to gaming tips, Gamer Snack keeps the gaming community engaged.",
      ar: "صانع محتوى ألعاب شهير يقدم محتوى ترفيهي للألعاب عبر منصات متعددة. من أبرز اللحظات في الألعاب إلى نصائح الألعاب، يبقي Gamer Snack مجتمع الألعاب متفاعلاً.",
    },
    logo: "https://assets.lunarian.app/partners/gamer-snack-logo.jpeg",
    socials: {
      instagram: "https://www.instagram.com/gamer_snack",
      x: "https://x.com/gamer_snack",
      tiktok: "https://www.tiktok.com/@gamersnack",
      youtube: "https://youtube.com/@gamersnack",
    },
    order: 0,
  },
  {
    id: "respa-design",
    name: "Respa Design",
    type: { en: "Creative Design Studio", ar: "استوديو تصميم إبداعي" },
    description: {
      en: "A creative design studio specializing in gaming graphics, branding, and visual content. Respa Design brings imagination to life through stunning artwork and design.",
      ar: "استوديو تصميم إبداعي متخصص في رسومات الألعاب والعلامات التجارية والمحتوى البصري. يجسد Respa Design الخيال من خلال الأعمال الفنية والتصميم المذهل.",
    },
    logo: "https://assets.lunarian.app/partners/respa-design-logo.jpeg",
    socials: {
      instagram: "https://www.instagram.com/respadesign/",
    },
    order: 1,
  },
  {
    id: "buried-games",
    name: "Buried Games Studio",
    type: { en: "Game Development Studio", ar: "استوديو تطوير ألعاب" },
    description: {
      en: "A passionate game development studio dedicated to creating unique and engaging experiences. Buried Games Studio specializes in strategy and multiplayer games, always looking to push the boundaries of interactive entertainment.",
      ar: "استوديو تطوير ألعاب شغوف مكرس لإنشاء تجارب فريدة وجذابة. يتخصص استوديو Buried Games في الألعاب الاستراتيجية ومتعددة اللاعبين، ويتطلع دائمًا إلى دفع حدود الترفيه التفاعلي.",
    },
    logo: "https://assets.lunarian.app/partners/buried-games-logo.png",
    website: "https://buriedgames.com",
    socials: {
      instagram: "https://instagram.com/buriedgames",
      tiktok: "https://tiktok.com/@buriedgames",
      youtube: "https://youtube.com/@BuriedGamesStudio",
      whatsapp: "https://wa.me/96555528686",
    },
    order: 2,
  },
  {
    id: "mythology-co",
    name: "Mythology Co.",
    type: { en: "Creative Brand", ar: "علامة تجارية إبداعية" },
    description: {
      en: "A creative brand based in Kuwait, blending mythology-inspired art and design into unique products and experiences.",
      ar: "علامة تجارية إبداعية مقرها الكويت، تمزج الفن والتصميم المستوحى من الأساطير في منتجات وتجارب فريدة.",
    },
    logo: "https://assets.lunarian.app/partners/mythology-logo.png",
    socials: {
      instagram: "https://www.instagram.com/mythology.kw",
      whatsapp: "https://wa.me/96598007400",
    },
    order: 3,
  },
];

async function main() {
  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db("Database");
  const collection = db.collection("partners");

  const existingCount = await collection.countDocuments();
  console.log(`Existing partners documents: ${existingCount}`);

  const existingDocs = await collection.find({}, { projection: { id: 1 } }).toArray();
  const existingIds = new Set(existingDocs.map((d) => d.id));

  const missing = partners.filter((p) => !existingIds.has(p.id));

  if (missing.length === 0) {
    console.log("All partners already exist in the database. Nothing to insert.");
  } else {
    console.log(`Inserting ${missing.length} partners...`);
    const result = await collection.insertMany(missing);
    console.log(`Inserted ${result.insertedCount} partners.`);
  }

  const finalCount = await collection.countDocuments();
  console.log(`\nFinal partners count: ${finalCount}`);

  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ order: 1 });
  console.log("Indexes created on id and order.");

  await client.close();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
