import clientPromise from "./mongodb";
import type { Card, CardGame } from "@/types";

// Luna Fantasy cards have "Luna " prefix in their name
// Bumper cards start with "Bumper"
// Everything else is Grand Fantasy
function detectGame(nameEn: string): CardGame {
  if (nameEn.startsWith("Luna ") || nameEn === "Luna") return "lunaFantasy";
  if (nameEn.startsWith("Bumper")) return "lunaPairs";
  return "grandFantasy";
}

let cache: Card[] | null = null;

export async function getCardCatalog(game?: CardGame): Promise<Card[]> {
  if (!cache) {
    const client = await clientPromise;
    const db = client.db("Database");

    const [configDocs, charDocs] = await Promise.all([
      db.collection("cards_config").find({}).limit(500).toArray(),
      db
        .collection("characters")
        .find({}, { projection: { id: 1, name: 1 } })
        .toArray(),
    ]);

    // Build character lookups for matching
    const charById = new Map<string, string>();
    const charByNameLower = new Map<string, string>();
    const charBySubtitle = new Map<string, string>();
    for (const ch of charDocs) {
      const nameEn: string =
        typeof ch.name === "string" ? ch.name : ch.name.en;
      charById.set(ch.id, ch.id);
      charByNameLower.set(nameEn.toLowerCase(), ch.id);
      // Also index without subtitle quotes
      const clean = nameEn
        .toLowerCase()
        .replace(/'[^']*'/g, "")
        .replace(/"[^"]*"/g, "")
        .trim();
      if (clean !== nameEn.toLowerCase()) charByNameLower.set(clean, ch.id);
      // Index by subtitle (e.g. "Movarth 'Chaos King'" -> "chaos king")
      const subtitleMatch =
        nameEn.match(/'([^']+)'/) || nameEn.match(/"([^"]+)"/);
      if (subtitleMatch) {
        charBySubtitle.set(subtitleMatch[1].trim().toLowerCase(), ch.id);
      }
    }

    const findCharacterId = (cardNameEn: string): string | undefined => {
      const lower = cardNameEn.toLowerCase();
      if (charByNameLower.has(lower)) return charByNameLower.get(lower);
      const stripped = lower.replace(/^luna /, "");
      if (charByNameLower.has(stripped)) return charByNameLower.get(stripped);
      const hyphenated = stripped.replace(/\s+/g, "-");
      if (charById.has(hyphenated)) return hyphenated;
      if (charById.has("luna-" + hyphenated)) return "luna-" + hyphenated;
      // Match against character subtitles (e.g. "Chaos King" -> "Movarth 'Chaos King'")
      if (charBySubtitle.has(stripped)) return charBySubtitle.get(stripped);
      if (charBySubtitle.has(lower)) return charBySubtitle.get(lower);
      // Match "The X" -> "X" (e.g. "The Corrupted Sentinel" -> "corrupted-sentinel")
      const withoutThe = stripped.replace(/^the /, "").replace(/\s+/g, "-");
      if (charById.has(withoutThe)) return withoutThe;
      return undefined;
    }

    const cards: Card[] = [];
    for (const doc of configDocs) {
      const parsed = Array.isArray(doc.items) ? doc.items : [];
      if (parsed.length === 0) continue;
      for (const c of parsed) {
        const cardName =
          typeof c.name === "string" ? { en: c.name, ar: c.name } : c.name;
        const rarity = (c.rarity || doc._id).toString().toLowerCase();
        const nameEn = typeof c.name === "string" ? c.name : c.name.en;
        cards.push({
          id: nameEn,
          name: cardName,
          rarity,
          imageUrl: c.imageUrl,
          game: c.game || detectGame(nameEn),
          characterId: findCharacterId(nameEn),
        } as Card);
      }
    }

    cache = cards;
  }

  if (game) {
    return cache.filter((card) => card.game === game);
  }
  return cache;
}
