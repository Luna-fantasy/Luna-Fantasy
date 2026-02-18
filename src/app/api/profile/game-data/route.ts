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

    const [cardsDoc, stonesDoc, pointsDoc, levelsDoc, magicWinsDoc, nemesisDocs, inventoryDoc] =
      await Promise.all([
        db.collection("cards").findOne({ _id: discordId as any }),
        db.collection("stones").findOne({ _id: discordId as any }),
        db.collection("points").findOne({ _id: discordId as any }),
        db.collection("levels").findOne({ _id: discordId as any }),
        db.collection("magic_wins").findOne({ _id: discordId as any }),
        db.collection("nemesis").find({ _id: { $regex: discordId } as any }).toArray(),
        db.collection("inventory").findOne({ _id: discordId as any }),
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

    const response: GameDataResponse = {
      cardsByGame,
      totalCards: allCards.length,
      stones,
      lunari,
      level,
      gameWins,
      pvp,
      inventory,
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
