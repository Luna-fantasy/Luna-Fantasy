import clientPromise from "./mongodb";
import type { Character } from "@/types";

const cache: Record<string, Character[]> = {};

export async function getCharacters(faction?: string): Promise<Character[]> {
  const key = faction || "all";
  if (cache[key]) return cache[key];

  const client = await clientPromise;
  const db = client.db("Database");

  const filter = faction ? { faction } : {};
  const docs = await db.collection("characters").find(filter).toArray();

  const characters: Character[] = docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    lore: doc.lore,
    faction: doc.faction,
    imageUrl: doc.imageUrl,
    isMainCharacter: doc.isMainCharacter,
    cardId: doc.cardId,
  }));

  cache[key] = characters;
  return characters;
}
