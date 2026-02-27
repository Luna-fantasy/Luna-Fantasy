import { NextResponse } from "next/server";
import { auth } from "@/auth";
import clientPromise from "@/lib/mongodb";
import { generateCardStats } from "@/lib/bazaar/luckbox-config";
import { getGuildMemberName } from "@/lib/bank/discord-roles";
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
  BadgeData,
  ProfileData,
} from "@/types/gameData";

function groupCards(cards: UserCard[]): CardsByGame {
  return { lunaFantasy: cards };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("discordId");

  let discordId: string;
  let isPublic = false;

  if (targetId) {
    // Public profile view — no auth required
    if (!/^\d{17,20}$/.test(targetId)) {
      return NextResponse.json({ error: "Invalid Discord ID" }, { status: 400 });
    }
    discordId = targetId;
    isPublic = true;
  } else {
    // Own profile — requires auth
    const session = await auth();
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    discordId = session.user.discordId;
  }

  try {
    const client = await clientPromise;
    const db = client.db("Database");

    // Build today's date key in UTC (YYYY-MM-DD) for chat_stats
    const now = new Date();
    const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    const [cardsDoc, stonesDoc, pointsDoc, levelsDoc, magicWinsDoc, nemesisDocs, inventoryDoc, ticketsDoc, chatMsgDoc, chatVoiceDoc, catalogDocs, badgesDoc, profileDoc] =
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
        db.collection("cards_config").find({}).toArray(),
        db.collection("badges").findOne({ _id: discordId as any }),
        db.collection("profiles").findOne({ _id: discordId as any }),
      ]);

    // Cards — data may be a JSON string (bot) or native array (web bazaar)
    let allCards: UserCard[] = [];
    if (cardsDoc?.data) {
      try {
        allCards = typeof cardsDoc.data === 'string'
          ? JSON.parse(cardsDoc.data)
          : Array.isArray(cardsDoc.data) ? cardsDoc.data : [];
      } catch {}
    }

    // Safety net: backfill attack/weight for any cards that have bad data (attack=0)
    for (const card of allCards) {
      if (card.attack === 0 || card.attack == null) {
        const stats = generateCardStats(card.rarity);
        card.attack = stats.attack;
        card.weight = stats.weight;
      }
    }

    const cardsByGame = groupCards(allCards);

    // Stones — data may be JSON string (bot) or native object (web bazaar)
    let stones: UserStone[] = [];
    if (stonesDoc?.data) {
      try {
        const parsed = typeof stonesDoc.data === 'string'
          ? JSON.parse(stonesDoc.data)
          : stonesDoc.data;
        stones = parsed.stones ?? (Array.isArray(parsed) ? parsed : []);
      } catch {}
    }

    // Lunari (points) — may be number or string
    let lunari = 0;
    if (pointsDoc?.data != null) {
      lunari = typeof pointsDoc.data === 'number' ? pointsDoc.data : parseInt(pointsDoc.data, 10) || 0;
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

    // Card catalog — cards_config: one doc per rarity, data is JSON string of card array
    const cardCatalog: CatalogCard[] = [];
    for (const doc of catalogDocs) {
      const parsed = typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data;
      if (!Array.isArray(parsed)) continue;
      for (const c of parsed) {
        cardCatalog.push({
          id: c.name,
          name: String(c.name ?? ""),
          rarity: (c.rarity ?? "COMMON").toLowerCase(),
          imageUrl: c.imageUrl ?? "",
          attack: c.attack ?? 0,
          weight: c.weight,
        });
      }
    }

    // Badges — data may be JSON string or native object
    let badges: BadgeData | null = null;
    if (badgesDoc?.data) {
      try {
        const parsed = typeof badgesDoc.data === 'string'
          ? JSON.parse(badgesDoc.data)
          : badgesDoc.data;
        if (parsed && typeof parsed === 'object') {
          badges = parsed;
        }
      } catch {}
    }

    // Profile — extract active backgrounds
    let profile: ProfileData | null = null;
    if (profileDoc?.data) {
      try {
        const parsed = typeof profileDoc.data === 'string'
          ? JSON.parse(profileDoc.data)
          : profileDoc.data;
        if (parsed && typeof parsed === 'object') {
          profile = {
            active_background: parsed.active_background ?? 'default',
            active_rank_background: parsed.active_rank_background ?? 'default',
          };
        }
      } catch {}
    }

    // For public profiles, look up basic user info and exclude private data
    let publicUser: { name: string; image: string | null; discordId: string } | undefined;
    if (isPublic) {
      const userDoc = await db.collection("users").findOne({ discordId });
      if (userDoc) {
        publicUser = {
          name: userDoc.globalName || userDoc.name || discordId,
          image: userDoc.image || null,
          discordId,
        };
      } else {
        // User never logged into the website — fetch from Discord API
        const member = await getGuildMemberName(discordId);
        publicUser = {
          name: member?.name || discordId,
          image: member?.avatar || null,
          discordId,
        };
      }
    }

    const response: GameDataResponse = {
      cardsByGame,
      totalCards: allCards.length,
      stones,
      lunari,
      level,
      gameWins,
      pvp,
      // Exclude private data for public profiles
      inventory: isPublic ? [] : inventory,
      tickets: isPublic ? 0 : tickets,
      chatActivity: isPublic ? null : chatActivity,
      cardCatalog,
      badges,
      profile,
      ...(publicUser ? { publicUser } : {}),
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
