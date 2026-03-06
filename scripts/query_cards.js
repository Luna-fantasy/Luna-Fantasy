const { MongoClient } = require("mongodb");
async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db("Database");
  // Check for a card config/definition collection
  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);
  console.log("Collections with card/image:", names.filter(n => /card|image|config|asset|luckbox/i.test(n)));
  
  // Try card_config or similar
  for (const coll of ["card_config", "cards_config", "luckbox_config", "vendor_config"]) {
    if (names.includes(coll)) {
      const doc = await db.collection(coll).findOne({});
      console.log(`\n=== ${coll} sample ===`);
      console.log(JSON.stringify(doc, null, 2).substring(0, 500));
    }
  }
  await client.close();
}
main().catch(console.error);
