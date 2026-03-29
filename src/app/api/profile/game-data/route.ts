import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/bazaar/rate-limit";
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
    // Public profile view — no auth required, rate limit by IP
    if (!/^\d{17,20}$/.test(targetId)) {
      return NextResponse.json({ error: "Invalid Discord ID" }, { status: 400 });
    }
    const ip = getClientIp(request);
    const rl = checkRateLimit('public_profile', ip, RATE_LIMITS.public_profile.maxRequests, RATE_LIMITS.public_profile.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
        db.collection("game_wins").findOne({ id: discordId }),
        db.collection("nemesis").find({ $or: [{ _id: { $regex: `^${discordId}_` } as any }, { _id: { $regex: `_${discordId}$` } as any }] }).toArray(),
        db.collection("inventory").findOne({ _id: discordId as any }),
        db.collection("tickets").findOne({ _id: discordId as any }),
        db.collection("chat_stats").findOne({ _id: `universal_chat_${todayKey}` as any }),
        db.collection("chat_stats").findOne({ _id: `universal_voice_${todayKey}` as any }),
        db.collection("cards_config").find({}).limit(500).toArray(),
        db.collection("badges").findOne({ _id: discordId as any }),
        db.collection("profiles").findOne({ _id: discordId as any }),
      ]);

    // Cards — stored as native array in `cards` field
    let allCards: UserCard[] = [];
    if (cardsDoc?.cards) {
      allCards = Array.isArray(cardsDoc.cards) ? cardsDoc.cards : [];
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

    // Stones — stored as native array in `stones` field
    let stones: UserStone[] = [];
    if (stonesDoc?.stones) {
      stones = Array.isArray(stonesDoc.stones) ? stonesDoc.stones : [];
    }

    // Lunari (points) — stored as `balance` field
    let lunari = 0;
    if (pointsDoc?.balance != null) {
      lunari = typeof pointsDoc.balance === 'number' ? pointsDoc.balance : 0;
    }

    // Level data — stored as native fields
    let level: LevelData | null = null;
    if (levelsDoc) {
      level = {
        xp: levelsDoc.xp ?? 0,
        level: levelsDoc.level ?? 0,
        messages: levelsDoc.messages ?? 0,
        voiceTime: levelsDoc.voiceTime ?? 0,
      };
    }

    // Game wins — game_wins collection: { id, luna_fantasy, grand_fantasy, faction_war }
    // Bot wins — profiles collection: luna_fantasy.bot_games + grand_fantasy.bot_games + faction_war.bot_games
    let gameWins: GameWins | null = null;
    {
      // Parse game_wins doc (handles old data-string format or new flat fields)
      let wins: Record<string, number> = {};
      if (magicWinsDoc) {
        if (magicWinsDoc.data !== undefined) {
          const raw = typeof magicWinsDoc.data === 'string' ? JSON.parse(magicWinsDoc.data) : magicWinsDoc.data;
          wins = (typeof raw === 'object' && raw !== null) ? raw : {};
        } else {
          const { _id, id, ...rest } = magicWinsDoc;
          wins = rest as Record<string, number>;
        }
      }

      // Sum bot_games from profiles (each game stores { wins, draws, losses, bot_games })
      let totalBotWins = 0;
      if (profileDoc) {
        const pDoc = profileDoc.data !== undefined
          ? (typeof profileDoc.data === 'string' ? JSON.parse(profileDoc.data) : profileDoc.data) ?? {}
          : profileDoc;
        for (const game of ['luna_fantasy', 'grand_fantasy', 'faction_war'] as const) {
          totalBotWins += (pDoc[game]?.bot_games ?? 0);
        }
      }

      gameWins = {
        magic_cards: wins.luna_fantasy ?? 0,
        luna_pairs: wins.faction_war ?? 0,
        grand_fantasy: wins.grand_fantasy ?? 0,
        bot_wins: totalBotWins,
      };
    }

    // PvP — nemesis docs keyed "playerA_playerB" with top-level {playerA: wins, playerB: wins}
    const pvp: PvpRecord = { wins: 0, losses: 0 };
    let nemesisId = '';
    let nemesisMaxDefeats = 0;
    let nemesisMyWins = 0;
    for (const doc of nemesisDocs) {
      try {
        const docId = String(doc._id);
        const parts = docId.split("_");
        const myIndex = parts.indexOf(discordId);
        const opponentId = parts[myIndex === 0 ? 1 : 0];

        const myWins = doc[discordId] ?? 0;
        const theirWins = doc[opponentId] ?? 0;
        pvp.wins += myWins;
        pvp.losses += theirWins;

        // Track nemesis — opponent who beat me the most
        if (theirWins > nemesisMaxDefeats) {
          nemesisMaxDefeats = theirWins;
          nemesisId = opponentId;
          nemesisMyWins = myWins;
        }
      } catch {}
    }

    // Resolve nemesis user info
    if (nemesisId && nemesisMaxDefeats > 0) {
      const nemesisUser = await db.collection("users").findOne({ discordId: nemesisId });
      pvp.nemesis = {
        discordId: nemesisId,
        name: nemesisUser?.globalName || nemesisUser?.name || nemesisUser?.username || 'Unknown',
        avatar: nemesisUser?.image || null,
        winsAgainst: nemesisMyWins,
        lossesAgainst: nemesisMaxDefeats,
      };
    }

    // Inventory — stored as native array in `items` field
    let inventory: InventoryItem[] = [];
    if (inventoryDoc?.items) {
      inventory = Array.isArray(inventoryDoc.items) ? inventoryDoc.items : [];
    }

    // Tickets — stored as `balance` field
    let tickets = 0;
    if (ticketsDoc?.balance != null) {
      tickets = typeof ticketsDoc.balance === 'number' ? ticketsDoc.balance : 0;
    }

    // Chat activity — stored as native object in `counts` field
    let chatActivity: ChatActivity | null = null;
    try {
      let messagesToday = 0;
      let voiceMinutesToday = 0;
      if (chatMsgDoc?.counts) {
        messagesToday = chatMsgDoc.counts[discordId] ?? 0;
      }
      if (chatVoiceDoc?.counts) {
        voiceMinutesToday = chatVoiceDoc.counts[discordId] ?? 0;
      }
      chatActivity = { messagesToday, voiceMinutesToday };
    } catch {}

    // Card catalog — cards_config: one doc per rarity (_id = rarity name), items is native array
    const cardCatalog: CatalogCard[] = [];
    for (const doc of catalogDocs) {
      const docRarity = String(doc._id).toLowerCase();
      const parsed = Array.isArray(doc.items) ? doc.items : [];
      if (parsed.length === 0) continue;
      for (const c of parsed) {
        cardCatalog.push({
          id: c.name,
          name: String(c.name ?? ""),
          rarity: docRarity,
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
