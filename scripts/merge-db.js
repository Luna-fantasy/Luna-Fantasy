/**
 * merge-db.js — One-time script to copy levels, cooldowns, system
 * from DB2 into DB1. DB2 remains untouched.
 *
 * Usage:  node scripts/merge-db.js
 *
 * Requires: mongodb (available in project node_modules)
 */

const { MongoClient } = require("mongodb");

const DB1_URI =
  "mongodb+srv://app:80LaxfR68WuOru8z@cluster0.w1nf05u.mongodb.net/Database";
const DB2_URI =
  "mongodb+srv://fahed:ck1K8QpJe0d2R3D9@cluster0.u12r3iw.mongodb.net/Database";

const COLLECTIONS = ["levels", "cooldowns", "system"];

async function main() {
  const client1 = new MongoClient(DB1_URI);
  const client2 = new MongoClient(DB2_URI);

  try {
    await Promise.all([client1.connect(), client2.connect()]);
    const db1 = client1.db("Database");
    const db2 = client2.db("Database");

    for (const colName of COLLECTIONS) {
      const docs = await db2.collection(colName).find().toArray();
      console.log(`[${colName}] Found ${docs.length} docs in DB2`);

      if (docs.length === 0) continue;

      const ops = docs.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true,
        },
      }));

      const result = await db1.collection(colName).bulkWrite(ops);
      console.log(
        `[${colName}] Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`
      );
    }

    console.log("\nMerge complete. DB2 untouched.");
  } finally {
    await Promise.all([client1.close(), client2.close()]);
  }
}

main().catch((err) => {
  console.error("Merge failed:", err);
  process.exit(1);
});
