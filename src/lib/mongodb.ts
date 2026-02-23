import { MongoClient } from "mongodb";

const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const uri = process.env.MONGODB_URI;

let clientPromise: Promise<MongoClient>;

if (uri) {
  if (process.env.NODE_ENV === "development") {
    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(uri);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
} else {
  // During build, MONGODB_URI may not be set. Provide a deferred promise
  // that will only reject if actually awaited without a proper URI.
  clientPromise = new Promise((_, reject) => {
    reject(new Error("MONGODB_URI is not configured"));
  });
  // Prevent unhandled rejection during build
  clientPromise.catch(() => {});
}

export default clientPromise;
