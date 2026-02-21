import { NextResponse } from "next/server";
import { auth } from "@/auth";
import clientPromise from "@/lib/mongodb";
import type {
  UserCard,
  UserStone,
  LevelData,
  GameWins,
  PvpRecord,
  InventoryItem,
  CardsByGame,
  GameDataResponse,
  ChatActivity,
  CatalogCard,
} from "@/types/gameData";

function groupCards(cards: UserCard[]): CardsByGame {
  const lunaFantasy: UserCard[] = [];
  const grandFantasy: UserCard[] = [];
  const bumper: UserCard[] = [];

  for (const card of cards) {
    if (card.name.startsWith("Luna ")) {
      lunaFantasy.push(card);
    } else if (card.name.startsWith("Bumper")) {
      bumper.push(card);
    } else {
      grandFantasy.push(card);
    }
  }

  return { lunaFantasy, grandFantasy, bumper };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const discordId = session.user.discordId;

  try {
    const client = await clientPromise;
    const db = client.db("Database");

    // Build today's date key in UTC (YYYY-MM-DD) for chat_stats
    const now = new Date();
    const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    const [cardsDoc, stonesDoc, pointsDoc, levelsDoc, magicWinsDoc, nemesisDocs, inventoryDoc, ticketsDoc, chatMsgDoc, chatVoiceDoc, catalogDocs] =
      await Promise.all([
        db.collection("cards").findOne({ _id: discordId as any }),
        db.collection("stones").findOne({ _id: discordId as any }),
        db.collection("points").findOne({ _id: discordId as any }),
        db.collection("levels").findOne({ _id: discordId as any }),
        db.collection("magic_wins").findOne({ _id: discordId as any }),
        db.collection("nemesis").find({ _id: { $regex: discordId } as any }).toArray(),
        db.collection("inventory").findOne({ _id: discordId as any }),
        db.collection("tickets").findOne({ _id: discordId as any }),
        db.collection("chat_stats").findOne({ _id: `universal_chat_${todayKey}` as any }),
        db.collection("chat_stats").findOne({ _id: `universal_voice_${todayKey}` as any }),
        db.collection("card_catalog").find({}).toArray(),
      ]);

    // Cards
    let allCards: UserCard[] = [];
    if (cardsDoc?.data) {
      try {
        allCards = JSON.parse(cardsDoc.data);
      } catch {}
    }
    const cardsByGame = groupCards(allCards);

    // Stones — data is '{"stones": [...]}' (nested)
    let stones: UserStone[] = [];
    if (stonesDoc?.data) {
      try {
        const parsed = JSON.parse(stonesDoc.data);
        stones = parsed.stones ?? parsed;
      } catch {}
    }

    // Lunari (points) — plain number as string
    let lunari = 0;
    if (pointsDoc?.data) {
      lunari = parseInt(pointsDoc.data, 10) || 0;
    }

    // Level data
    let level: LevelData | null = null;
    if (levelsDoc?.data) {
      try {
        level = JSON.parse(levelsDoc.data);
      } catch {}
    }

    // Game wins
    let gameWins: GameWins | null = null;
    if (magicWinsDoc?.data) {
      try {
        gameWins = JSON.parse(magicWinsDoc.data);
      } catch {}
    }

    // PvP — nemesis docs keyed "playerA_playerB" with data {"playerA": wins, "playerB": wins}
    const pvp: PvpRecord = { wins: 0, losses: 0 };
    for (const doc of nemesisDocs) {
      try {
        const parsed = JSON.parse(doc.data);
        const docId = String(doc._id);
        const parts = docId.split("_");
        const myIndex = parts.indexOf(discordId);
        const opponentId = parts[myIndex === 0 ? 1 : 0];

        const myWins = parsed[discordId] ?? 0;
        const theirWins = parsed[opponentId] ?? 0;
        pvp.wins += myWins;
        pvp.losses += theirWins;
      } catch {}
    }

    // Inventory
    let inventory: InventoryItem[] = [];
    if (inventoryDoc?.data) {
      try {
        inventory = JSON.parse(inventoryDoc.data);
      } catch {}
    }

    // Tickets (st.db: data is stringified int)
    let tickets = 0;
    if (ticketsDoc?.data) {
      tickets = parseInt(ticketsDoc.data, 10) || 0;
    }

    // Chat activity — docs store Record<userId, count/minutes> as stringified JSON
    let chatActivity: ChatActivity | null = null;
    try {
      let messagesToday = 0;
      let voiceMinutesToday = 0;
      if (chatMsgDoc?.data) {
        const parsed = JSON.parse(chatMsgDoc.data);
        messagesToday = parsed[discordId] ?? 0;
      }
      if (chatVoiceDoc?.data) {
        const parsed = JSON.parse(chatVoiceDoc.data);
        voiceMinutesToday = parsed[discordId] ?? 0;
      }
      chatActivity = { messagesToday, voiceMinutesToday };
    } catch {}

    // Card catalog — regular documents with id, name (LocalizedString), rarity, imageUrl, game
    const cardCatalog: CatalogCard[] = catalogDocs.map((doc) => {
      const name = typeof doc.name === "object" && doc.name?.en ? doc.name.en : String(doc.name ?? "");
      return {
        id: doc.id ?? String(doc._id),
        name,
        rarity: doc.rarity ?? "common",
        imageUrl: doc.imageUrl ?? "",
        attack: doc.attack,
        game: doc.game,
      };
    });

    const response: GameDataResponse = {
      cardsByGame,
      totalCards: allCards.length,
      stones,
      lunari,
      level,
      gameWins,
      pvp,
      inventory,
      tickets,
      chatActivity,
      cardCatalog,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Game data API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
