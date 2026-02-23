import clientPromise from "./mongodb";
import type { Card } from "@/types";

export type GameType = "lunaFantasy" | "grandFantasy" | "bumper";

const cache: Record<string, Card[]> = {};

export async function getCardCatalog(game?: GameType): Promise<Card[]> {
  const key = game || "all";
  if (cache[key]) return cache[key];

  const client = await clientPromise;
  const db = client.db("Database");

  const filter = game ? { game } : {};
  const docs = await db.collection("card_catalog").find(filter).toArray();

  const cards: Card[] = docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    rarity: doc.rarity,
    imageUrl: doc.imageUrl,
    characterId: doc.characterId,
  }));

  cache[key] = cards;
  return cards;
}
