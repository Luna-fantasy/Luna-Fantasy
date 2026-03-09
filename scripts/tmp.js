const { MongoClient } = require("mongodb");
async function check() {
  const client = new MongoClient("mongodb+srv://app:80LaxfR68WuOru8z@cluster0.w1nf05u.mongodb.net/Database?appName=Cluster0");
  await client.connect();
  const db = client.db("Database");

  // List all collections
  const collections = await db.listCollections().toArray();
  console.log("=== COLLECTIONS ===");
  console.log(collections.map(c => c.name).sort().join("\n"));

  // Check NextAuth users collection
  const user = await db.collection("users").findOne({});
  console.log("\n=== SAMPLE USER (users collection) ===");
  console.log(JSON.stringify(user, null, 2));

  // Check accounts
  const account = await db.collection("accounts").findOne({ providerAccountId: "487184125896425472" });
  console.log("\n=== ACCOUNT for 487184125896425472 ===");
  console.log(JSON.stringify(account, null, 2));

  await client.close();
}
check();
