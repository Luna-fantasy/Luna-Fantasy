import clientPromise from "./mongodb";
import type { Card } from "@/types";

let cache: Card[] | null = null;

export async function getCardCatalog(): Promise<Card[]> {
  if (cache) return cache;

  const client = await clientPromise;
  const db = client.db("Database");

  const docs = await db.collection("cards_config").find({}).toArray();

  const cards: Card[] = [];
  for (const doc of docs) {
    const parsed = Array.isArray(doc.items) ? doc.items : [];
    if (parsed.length === 0) continue;
    for (const c of parsed) {
      const cardName = typeof c.name === 'string' ? { en: c.name, ar: c.name } : c.name;
      const rarity = (c.rarity || doc._id).toString().toLowerCase();
      cards.push({
        id: typeof c.name === 'string' ? c.name : c.name.en,
        name: cardName,
        rarity,
        imageUrl: c.imageUrl,
        characterId: undefined,
      } as Card);
    }
  }

  cache = cards;
  return cards;
}
