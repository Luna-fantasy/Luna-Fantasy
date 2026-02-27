import clientPromise from "./mongodb";
import type { LunaPairsFaction } from "@/types/luna-pairs";

const R2_BASE = "https://assets.lunarian.app/LunaPairs";

let cache: LunaPairsFaction[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getLunaPairsFactions(): Promise<LunaPairsFaction[]> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const client = await clientPromise;
  const db = client.db("Database");

  const docs = await db.collection("luna_pairs_config").find({}).toArray();

  const factions: LunaPairsFaction[] = docs.map((doc) => {
    const data = typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data;
    return {
      id: doc._id as string,
      name: data.name,
      color: data.color,
      cards: data.cards,
    };
  });

  // Sort by predefined order
  const order = [
    "beasts", "colossals", "dragons", "knights", "lunarians",
    "moon_creatures", "mythical_creatures", "strange_beings",
    "supernatural", "underworld", "warriors",
  ];
  factions.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  cache = factions;
  cacheTime = Date.now();
  return factions;
}

export function getLunaPairsImageUrl(image: string): string {
  return `${R2_BASE}/${image}`;
}

export function getLunaPairsBgUrl(): string {
  return `${R2_BASE}/LunaPairs_BG.png`;
}
