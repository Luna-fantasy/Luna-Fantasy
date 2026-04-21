import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { readJesterConfig } from '@/lib/admin/config-writer';
import { uploadObject, deleteObject, isR2Configured } from '@/lib/admin/r2';
import clientPromise from '@/lib/mongodb';
import { invalidateFactionWarCache } from '@/lib/faction-war';

const DB_NAME = 'Database';
const JESTER_PATH = process.env.JESTER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaJesterMain';

const VALID_RARITIES = ['COMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'SECRET', 'FORBIDDEN'] as const;
type Rarity = typeof VALID_RARITIES[number];

const VALID_FACTIONS = ['Beasts', 'Colossals', 'Dragons', 'Knights', 'Lunarians', 'Moon Creatures', 'Mythical Creatures', 'Strange Beings', 'Supernatural', 'Underworld', 'Warriors'] as const;
type Faction = typeof VALID_FACTIONS[number];

interface CardItem {
  name: string;
  attack: number;
  imageUrl: string;
  weight: number;
}

interface FactionCard {
  name: string;
  image: string;
  description?: string;
}

/**
 * Faction data source of truth is `luna_pairs_config` — one doc per faction
 * keyed by lowercase id (e.g. "lunarians"), shape `{ data: { name, color, cards[] } }`.
 * The public website and the bot both read from here. The previous version of
 * this file ALSO tried to maintain a copy at
 * `bot_config.jester_game_settings.data.FactionWar.factions` as a "master",
 * but that path never existed in production — only the FactionWar game settings
 * (ticket_cost, prizes, etc.) live there, not the card array. Every admin edit
 * was failing with "FactionWar config not found in database" because of it.
 */
async function readFactionCards(
  db: import('mongodb').Db,
  factionName: string,
): Promise<{ factionId: string; cards: FactionCard[] } | null> {
  const factionId = factionName.toLowerCase().replace(/\s+/g, '_');
  const doc = await db.collection('luna_pairs_config').findOne({ _id: factionId as any });
  if (!doc) return null;
  const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  const cards = Array.isArray(data?.cards) ? (data.cards as FactionCard[]) : [];
  return { factionId, cards };
}

async function writeFactionCards(
  db: import('mongodb').Db,
  factionId: string,
  cards: FactionCard[],
): Promise<void> {
  await db.collection('luna_pairs_config').updateOne(
    { _id: factionId as any },
    { $set: { 'data.cards': cards } },
    { upsert: false }, // Don't create — faction doc with name/color must already exist
  );
  invalidateFactionWarCache(); // public website will refetch on next request
}

/**
 * Clean TypeScript syntax to make it JSON-parseable.
 * Uses a URL-safe comment regex that won't destroy :// in URLs.
 */
function cleanTsForJson(ts: string): string {
  return ts
    .replace(/\r\n/g, '\n')
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/\s+as\s+\w+(\[\])?/g, '')
    .replace(/(?<![:"'])\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Extract the cards block from Jester config.ts.
 * The cards block is nested: game_settings > LunaFantasy > cards > {RARITY: [...]}
 * Uses brace-counting to find the complete block.
 */
function parseCardsBlock(content: string): { cards: Record<string, CardItem[]>; blockStart: number; blockEnd: number } | null {
  // Find the "cards": { block that contains rarity keys
  // We need the one inside LunaFantasy, not any other "cards" key
  // Strategy: find "LunaFantasy" first, then find "cards" within it
  const lfMatch = /["']?LunaFantasy["']?\s*:\s*\{/.exec(content);
  if (!lfMatch) return null;

  // Find the end of the LunaFantasy block using brace-counting
  const lfBlockStart = lfMatch.index + lfMatch[0].length - 1;
  let depth = 1;
  let idx = lfBlockStart + 1;
  while (idx < content.length && depth > 0) {
    const ch = content[idx];
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    if (ch === '"') {
      idx++;
      while (idx < content.length && content[idx] !== '"') {
        if (content[idx] === '\\') idx++;
        idx++;
      }
    }
    idx++;
  }
  const lfBlockEnd = idx;
  const lfContent = content.slice(lfBlockStart, lfBlockEnd);

  // Now find "cards": { within the LunaFantasy block
  const cardsMatch = /["']?cards["']?\s*:\s*\{/.exec(lfContent);
  if (!cardsMatch) return null;

  const cardsBlockStartLocal = cardsMatch.index + cardsMatch[0].length - 1;
  depth = 1;
  idx = cardsBlockStartLocal + 1;
  while (idx < lfContent.length && depth > 0) {
    const ch = lfContent[idx];
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    if (ch === '"') {
      idx++;
      while (idx < lfContent.length && lfContent[idx] !== '"') {
        if (lfContent[idx] === '\\') idx++;
        idx++;
      }
    }
    idx++;
  }

  if (depth !== 0) return null;

  const cardsBlockEndLocal = idx;
  const cardsRaw = lfContent.slice(cardsBlockStartLocal, cardsBlockEndLocal);

  // Absolute positions in the full content
  const blockStart = lfBlockStart + cardsBlockStartLocal;
  const blockEnd = lfBlockStart + cardsBlockEndLocal;

  try {
    const cleaned = cleanTsForJson(cardsRaw);
    const cards = JSON.parse(cleaned) as Record<string, CardItem[]>;
    return { cards, blockStart, blockEnd };
  } catch {
    return null;
  }
}

/**
 * Find the array bounds for a specific rarity key within the cards block.
 * Returns the absolute start/end positions (of the [ ... ] block) in the full content string.
 */
function findRarityArrayBounds(content: string, cardsBlockStart: number, cardsBlockEnd: number, rarity: string): { start: number; end: number } | null {
  const cardsContent = content.slice(cardsBlockStart, cardsBlockEnd);

  // Find "RARITY": [ pattern
  const rarityPattern = new RegExp(`["']?${rarity}["']?\\s*:\\s*\\[`);
  const match = rarityPattern.exec(cardsContent);
  if (!match) return null;

  const arrayStartLocal = match.index + match[0].length - 1; // position of [
  let depth = 1;
  let idx = arrayStartLocal + 1;
  while (idx < cardsContent.length && depth > 0) {
    const ch = cardsContent[idx];
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    if (ch === '"') {
      idx++;
      while (idx < cardsContent.length && cardsContent[idx] !== '"') {
        if (cardsContent[idx] === '\\') idx++;
        idx++;
      }
    }
    idx++;
  }

  if (depth !== 0) return null;

  return {
    start: cardsBlockStart + arrayStartLocal,
    end: cardsBlockStart + idx,
  };
}

/**
 * Format a card items array as a TypeScript-compatible string with proper indentation.
 */
function formatCardArray(items: CardItem[], indent: string): string {
  if (items.length === 0) return '[]';

  const innerIndent = indent + '    ';
  const itemLines = items.map((item) => {
    const parts = [
      `"name": ${JSON.stringify(item.name)}`,
      `"attack": ${item.attack}`,
      `"imageUrl": ${JSON.stringify(item.imageUrl)}`,
      `"weight": ${item.weight}`,
    ];
    return `${innerIndent}{ ${parts.join(', ')} }`;
  });

  return '[\n' + itemLines.join(',\n') + '\n' + indent + ']';
}

/**
 * Detect the indentation of the line where a given position is.
 */
function detectIndent(content: string, pos: number): string {
  let lineStart = content.lastIndexOf('\n', pos);
  if (lineStart === -1) lineStart = 0;
  else lineStart += 1;
  const linePrefix = content.slice(lineStart, pos);
  // The indent is the whitespace before the key on this line
  // For the rarity array, we want the indentation of the rarity key line
  const match = linePrefix.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Extract a block from content using brace counting, starting from a key pattern.
 * Returns the raw string of the block and its position.
 */
function extractBlockFromContent(content: string, key: string): { value: string; start: number; end: number } | null {
  const patterns = [
    new RegExp(`["']?${key}["']?\\s*:\\s*\\{`),
    new RegExp(`["']?${key}["']?\\s*:\\s*\\[`),
  ];

  let match: RegExpExecArray | null = null;
  let openChar = '{';
  for (const pat of patterns) {
    match = pat.exec(content);
    if (match) {
      openChar = content[match.index + match[0].length - 1];
      break;
    }
  }
  if (!match) return null;

  const closeChar = openChar === '{' ? '}' : ']';
  const blockStart = match.index + match[0].length - 1;
  let depth = 1;
  let i = blockStart + 1;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === openChar) depth++;
    else if (ch === closeChar) depth--;
    if (ch === '"') {
      i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === '\\') i++;
        i++;
      }
    }
    i++;
  }
  if (depth !== 0) return null;
  return { value: content.slice(blockStart, i), start: blockStart, end: i };
}

/**
 * Parse the full FactionWar block from Jester config.ts, including factions.
 * Returns the parsed object with all nested data.
 */
function parseFactionWarFull(content: string): Record<string, any> | null {
  const fwBlock = extractBlockFromContent(content, 'FactionWar');
  if (!fwBlock) return null;

  try {
    return JSON.parse(cleanTsForJson(fwBlock.value));
  } catch {
    return null;
  }
}

// ── GET: Read cards config from MongoDB (primary) or Jester config.ts (fallback) ──

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Try MongoDB cards_config first
    const cardsConfigDocs = await db.collection('cards_config').find({}).toArray();
    let rarities: Array<{ rarity: string; items: CardItem[] }> = [];

    if (cardsConfigDocs.length > 0) {
      for (const doc of cardsConfigDocs) {
        let items: CardItem[] = [];
        if (Array.isArray(doc.items) && doc.items.length > 0) {
          items = doc.items;
        } else if (doc.data) {
          try {
            items = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
          } catch { /* skip */ }
        }
        if (items.length > 0) {
          rarities.push({ rarity: String(doc._id), items });
        }
      }
    }

    // Fallback to config.ts if MongoDB is empty (only works locally, not Railway)
    if (rarities.length === 0) {
      try {
        const configContent = await readJesterConfig();
        const parsed = parseCardsBlock(configContent);
        if (parsed) {
          rarities = Object.entries(parsed.cards).map(([rarity, items]) => ({ rarity, items }));
        }
      } catch { /* config.ts not available on Railway — that's fine if MongoDB has data */ }
    }

    // FactionWar factions — try bot_config first, then fall back to Jester
    // config.ts (matches the rarity fallback path above — needed locally where
    // the DB doc hasn't been seeded yet).
    let factionWar: Record<string, any> | null = null;
    try {
      const fwDoc = await db.collection('bot_config').findOne({ _id: 'jester_game_settings' as any });
      if (fwDoc?.data?.FactionWar?.factions) {
        factionWar = fwDoc.data.FactionWar.factions;
      }
    } catch { /* non-critical — faction war data is optional */ }

    if (!factionWar) {
      try {
        const configContent = await readJesterConfig();
        const parsed = parseFactionWarFull(configContent);
        if (parsed?.factions) {
          factionWar = parsed.factions;
        }
      } catch { /* config.ts unavailable on Railway — bot_config should have the data there */ }
    }

    return NextResponse.json({ rarities, factionWar });
  } catch (error) {
    console.error('Cards config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT: Update cards for a rarity (config.ts + MongoDB) ──

export async function PUT(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: { rarity: string; items: CardItem[]; deploy?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { rarity, items, deploy } = body;
  if (!rarity || !Array.isArray(items)) {
    return NextResponse.json({ error: 'rarity and items[] required' }, { status: 400 });
  }

  const upperRarity = rarity.toUpperCase() as Rarity;
  if (!VALID_RARITIES.includes(upperRarity)) {
    return NextResponse.json({ error: `Invalid rarity: ${rarity}` }, { status: 400 });
  }

  // Validate each card item
  for (const item of items) {
    if (!item.name || typeof item.name !== 'string') {
      return NextResponse.json({ error: 'Each card must have a name' }, { status: 400 });
    }
    if (typeof item.attack !== 'number' || item.attack < 0) {
      return NextResponse.json({ error: `Invalid attack for "${item.name}"` }, { status: 400 });
    }
    if (typeof item.weight !== 'number' || item.weight < 0) {
      return NextResponse.json({ error: `Invalid weight for "${item.name}"` }, { status: 400 });
    }
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // 1. Read current for audit (from MongoDB)
    const currentDoc = await db.collection('cards_config').findOne({ _id: upperRarity as any });
    let beforeItems: CardItem[] = [];
    if (currentDoc) {
      beforeItems = Array.isArray(currentDoc.items) ? currentDoc.items
        : typeof currentDoc.data === 'string' ? JSON.parse(currentDoc.data)
        : [];
    }

    // 2. Write to MongoDB cards_config (canonical source)
    await db.collection('cards_config').updateOne(
      { _id: upperRarity as any },
      { $set: { items, updatedAt: new Date() }, $unset: { data: '' } },
      { upsert: true }
    );

    // 3. Clean up R2 images for deleted cards (fire-and-forget)
    const deletedCards = beforeItems.filter(old => !items.some(newCard => newCard.name === old.name));
    for (const deleted of deletedCards) {
      if (deleted.imageUrl?.startsWith('https://assets.lunarian.app/')) {
        const r2Key = deleted.imageUrl.replace('https://assets.lunarian.app/', '');
        deleteObject(r2Key).catch(err => console.error(`Failed to delete R2 image ${r2Key}:`, err));
      }
    }

    // 4. Audit log
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'cards_config_update',
      before: { rarity: upperRarity, itemCount: beforeItems.length },
      after: { rarity: upperRarity, itemCount: items.length },
      metadata: { rarity: upperRarity },
      ip: getClientIp(request),
    });

    // No git push / deploy needed — bot reads from cards_config via cards_config_db.ts
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cards config PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST: Multi-action handler (image updates + FactionWar CRUD) ──

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;
  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  switch (action) {
    case 'update_image':
      return handleUpdateImage(body, adminId, authResult, request);
    case 'upload_image_only':
      return handleUploadImageOnly(body);
    case 'add_faction_card':
      return handleAddFactionCard(body, adminId, authResult, request);
    case 'update_faction_card':
      return handleUpdateFactionCard(body, adminId, authResult, request);
    case 'delete_faction_card':
      return handleDeleteFactionCard(body, adminId, authResult, request);
    case 'upload_faction_image':
      return handleUploadFactionImage(body, adminId, authResult, request);
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

// ── Action: update_image (rarity card image update with propagation) ──

async function handleUpdateImage(body: any, adminId: string, authResult: any, request: NextRequest) {
  const { rarity, cardName, imageData, contentType } = body;

  if (!rarity || typeof rarity !== 'string') {
    return NextResponse.json({ error: 'rarity is required' }, { status: 400 });
  }
  if (!cardName || typeof cardName !== 'string') {
    return NextResponse.json({ error: 'cardName is required' }, { status: 400 });
  }
  if (!imageData || typeof imageData !== 'string') {
    return NextResponse.json({ error: 'imageData (base64) is required' }, { status: 400 });
  }

  const upperRarity = rarity.toUpperCase() as Rarity;
  if (!VALID_RARITIES.includes(upperRarity)) {
    return NextResponse.json({ error: `Invalid rarity: ${rarity}` }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 503 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Step 1: Upload to R2
    const rarityFolder = upperRarity.charAt(0) + upperRarity.slice(1).toLowerCase();
    const safeCardName = cardName.replace(/\s+/g, '_');
    const r2Key = `cards/${rarityFolder}/${safeCardName}.png`;

    // Find old image URL from MongoDB cards_config
    const configDoc = await db.collection('cards_config').findOne({ _id: upperRarity as any });
    let oldUrl = '';
    let configCards: CardItem[] = [];
    if (configDoc) {
      try {
        configCards = Array.isArray(configDoc.items) && configDoc.items.length > 0
          ? configDoc.items
          : typeof configDoc.data === 'string'
            ? JSON.parse(configDoc.data)
            : [];
      } catch {
        configCards = [];
      }
      const existingCard = configCards.find((c) => c.name === cardName);
      if (existingCard) {
        oldUrl = existingCard.imageUrl;
        if (oldUrl?.startsWith('https://assets.lunarian.app/')) {
          const oldKey = oldUrl.replace('https://assets.lunarian.app/', '');
          if (oldKey !== r2Key) {
            deleteObject(oldKey).catch(err => console.error(`Failed to delete old R2 image:`, err));
          }
        }
      }
    }

    const buffer = Buffer.from(imageData, 'base64');
    const mimeType = contentType || 'image/png';
    const newUrl = await uploadObject(r2Key, buffer, mimeType);

    // Step 2: Update MongoDB cards_config
    if (configCards.length === 0) {
      return NextResponse.json({ error: `Card "${cardName}" not found in ${upperRarity}` }, { status: 404 });
    }

    const cardIdx = configCards.findIndex((c) => c.name === cardName);
    if (cardIdx === -1) {
      return NextResponse.json({ error: `Card "${cardName}" not found in ${upperRarity}` }, { status: 404 });
    }

    configCards[cardIdx].imageUrl = newUrl;
    await db.collection('cards_config').updateOne(
      { _id: upperRarity as any },
      { $set: { items: configCards, updatedAt: new Date() }, $unset: { data: '' } }
    );

    // Step 3: Propagate to ALL user cards in the cards collection
    // Use updateMany with arrayFilters for documents using the `cards` array format
    const bulkResult = await db.collection('cards').updateMany(
      { 'cards': { $elemMatch: { name: cardName } } },
      { $set: { 'cards.$[card].imageUrl': newUrl } },
      { arrayFilters: [{ 'card.name': cardName }] }
    );
    let usersUpdated = bulkResult.modifiedCount;

    // Separate pass for legacy `doc.data` format (string JSON)
    const legacyCursor = db.collection('cards').find({
      data: { $exists: true },
      cards: { $exists: false },
    });
    for await (const doc of legacyCursor) {
      try {
        const cards = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
        if (!Array.isArray(cards)) continue;
        let changed = false;
        for (const card of cards) {
          if (card.name === cardName && card.imageUrl !== newUrl) {
            card.imageUrl = newUrl;
            changed = true;
          }
        }
        if (changed) {
          await db.collection('cards').updateOne(
            { _id: doc._id },
            { $set: { cards }, $unset: { data: '' } }
          );
          usersUpdated++;
        }
      } catch { continue; }
    }

    // Step 4: Audit log
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'cards_update_image',
      before: { cardName, rarity: upperRarity, imageUrl: oldUrl },
      after: { cardName, rarity: upperRarity, imageUrl: newUrl, usersUpdated },
      metadata: { cardName, rarity: upperRarity, r2Key, usersUpdated },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, imageUrl: newUrl, usersUpdated });
  } catch (error) {
    console.error('Cards image update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Action: upload_image_only (R2 upload only, no config/DB changes) ──

async function handleUploadImageOnly(body: any) {
  const { rarity, cardName, imageData, contentType } = body;

  if (!rarity || !cardName || !imageData) {
    return NextResponse.json({ error: 'rarity, cardName, and imageData required' }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 503 });
  }

  try {
    const upperRarity = rarity.toUpperCase();
    const rarityFolder = upperRarity.charAt(0) + upperRarity.slice(1).toLowerCase();
    const safeCardName = cardName.replace(/\s+/g, '_');
    const r2Key = `cards/${rarityFolder}/${safeCardName}.png`;
    const buffer = Buffer.from(imageData, 'base64');
    const mimeType = contentType || 'image/png';
    const baseUrl = await uploadObject(r2Key, buffer, mimeType);
    // Cache-bust so re-uploads to the same R2 key show up immediately.
    const imageUrl = `${baseUrl}?v=${Date.now()}`;
    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Upload image only error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

// ── Action: add_faction_card ──

async function handleAddFactionCard(body: any, adminId: string, authResult: any, request: NextRequest) {
  const { faction, card } = body;

  if (!faction || typeof faction !== 'string' || !VALID_FACTIONS.includes(faction as Faction)) {
    return NextResponse.json({ error: `Invalid faction. Must be one of: ${VALID_FACTIONS.join(', ')}` }, { status: 400 });
  }
  if (!card || typeof card.name !== 'string' || !card.name.trim()) {
    return NextResponse.json({ error: 'card.name is required' }, { status: 400 });
  }
  if (typeof card.image !== 'string') {
    return NextResponse.json({ error: 'card.image is required' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existing = await readFactionCards(db, faction);
    if (!existing) {
      return NextResponse.json({ error: `Faction "${faction}" not found in luna_pairs_config` }, { status: 404 });
    }

    const cards = [...existing.cards];
    if (cards.some((c) => c.name === card.name.trim())) {
      return NextResponse.json({ error: `Card "${card.name}" already exists in ${faction}` }, { status: 409 });
    }

    const newCard: FactionCard = {
      name: card.name.trim(),
      image: card.image,
      ...(typeof card.description === 'string' && card.description.trim()
        ? { description: card.description.trim().slice(0, 2000) }
        : {}),
    };
    cards.push(newCard);

    await writeFactionCards(db, existing.factionId, cards);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'faction_card_add',
      before: null,
      after: { faction, card: newCard },
      metadata: { faction, cardName: newCard.name },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, card: newCard });
  } catch (error) {
    console.error('Add faction card error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Action: update_faction_card ──

async function handleUpdateFactionCard(body: any, adminId: string, authResult: any, request: NextRequest) {
  const { faction, oldName, card } = body;

  if (!faction || typeof faction !== 'string' || !VALID_FACTIONS.includes(faction as Faction)) {
    return NextResponse.json({ error: `Invalid faction. Must be one of: ${VALID_FACTIONS.join(', ')}` }, { status: 400 });
  }
  if (!oldName || typeof oldName !== 'string') {
    return NextResponse.json({ error: 'oldName is required' }, { status: 400 });
  }
  if (!card || typeof card.name !== 'string' || !card.name.trim()) {
    return NextResponse.json({ error: 'card.name is required' }, { status: 400 });
  }
  if (typeof card.image !== 'string') {
    return NextResponse.json({ error: 'card.image is required' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existing = await readFactionCards(db, faction);
    if (!existing) {
      return NextResponse.json({ error: `Faction "${faction}" not found in luna_pairs_config` }, { status: 404 });
    }

    const cards = [...existing.cards];
    const cardIdx = cards.findIndex((c) => c.name === oldName);
    if (cardIdx === -1) {
      return NextResponse.json({ error: `Card "${oldName}" not found in ${faction}` }, { status: 404 });
    }

    if (card.name.trim() !== oldName) {
      const dup = cards.some((c) => c.name === card.name.trim());
      if (dup) {
        return NextResponse.json({ error: `Card "${card.name}" already exists in ${faction}` }, { status: 409 });
      }
    }

    const beforeCard = { ...cards[cardIdx] };
    cards[cardIdx] = {
      name: card.name.trim(),
      image: card.image,
      ...(typeof card.description === 'string' && card.description.trim()
        ? { description: card.description.trim().slice(0, 2000) }
        : {}),
    };

    await writeFactionCards(db, existing.factionId, cards);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'faction_card_update',
      before: { faction, card: beforeCard },
      after: { faction, card: cards[cardIdx] },
      metadata: { faction, oldName, newName: card.name.trim() },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, card: cards[cardIdx] });
  } catch (error) {
    console.error('Update faction card error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Action: delete_faction_card ──

async function handleDeleteFactionCard(body: any, adminId: string, authResult: any, request: NextRequest) {
  const { faction, cardName } = body;

  if (!faction || typeof faction !== 'string' || !VALID_FACTIONS.includes(faction as Faction)) {
    return NextResponse.json({ error: `Invalid faction. Must be one of: ${VALID_FACTIONS.join(', ')}` }, { status: 400 });
  }
  if (!cardName || typeof cardName !== 'string') {
    return NextResponse.json({ error: 'cardName is required' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existing = await readFactionCards(db, faction);
    if (!existing) {
      return NextResponse.json({ error: `Faction "${faction}" not found in luna_pairs_config` }, { status: 404 });
    }

    const cards = [...existing.cards];
    const cardIdx = cards.findIndex((c) => c.name === cardName);
    if (cardIdx === -1) {
      return NextResponse.json({ error: `Card "${cardName}" not found in ${faction}` }, { status: 404 });
    }

    const deletedCard = cards.splice(cardIdx, 1)[0];

    await writeFactionCards(db, existing.factionId, cards);

    // Clean up R2 image. Stored values are either a bare filename (optionally
    // with a `?v=...` cache-buster) under LunaPairs/, or a full URL. Strip the
    // query string before deriving the R2 key so we hit the actual object.
    if (deletedCard.image) {
      const bareValue = deletedCard.image.split('?')[0];
      if (bareValue.startsWith('https://assets.lunarian.app/')) {
        const r2Key = bareValue.replace('https://assets.lunarian.app/', '');
        deleteObject(r2Key).catch(() => {});
      } else {
        deleteObject(`LunaPairs/${bareValue}`).catch(() => {});
      }
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'faction_card_delete',
      before: { faction, card: deletedCard },
      after: null,
      metadata: { faction, cardName },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete faction card error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Action: upload_faction_image ──

async function handleUploadFactionImage(body: any, adminId: string, authResult: any, request: NextRequest) {
  const { faction, cardName, imageData, contentType } = body;

  if (!faction || typeof faction !== 'string' || !VALID_FACTIONS.includes(faction as Faction)) {
    return NextResponse.json({ error: `Invalid faction. Must be one of: ${VALID_FACTIONS.join(', ')}` }, { status: 400 });
  }
  if (!cardName || typeof cardName !== 'string') {
    return NextResponse.json({ error: 'cardName is required' }, { status: 400 });
  }
  if (!imageData || typeof imageData !== 'string') {
    return NextResponse.json({ error: 'imageData (base64) is required' }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 503 });
  }

  try {
    // Sanitize filename: lowercase faction, replace spaces with underscores
    const factionFolder = faction.toLowerCase().replace(/\s+/g, '_');
    const safeCardName = cardName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    const filename = `${factionFolder}_${safeCardName}.png`;
    // IMPORTANT: must match the path the public Faction War page reads from
    // (`R2_BASE = "https://assets.lunarian.app/LunaPairs"` in src/lib/faction-war.ts).
    // Earlier this uploaded to `cards/FactionWar/...` which left the public site
    // showing the old image because the file landed where nothing read it.
    const r2Key = `LunaPairs/${filename}`;
    const buffer = Buffer.from(imageData, 'base64');
    const mimeType = contentType || 'image/png';
    await uploadObject(r2Key, buffer, mimeType);

    // Return the BARE filename (matches the existing schema for cards already in
    // luna_pairs_config) + a `?v=<timestamp>` cache-buster. R2 ignores the query
    // string for routing but the browser treats the URL as new, forcing a fresh
    // fetch after the admin overwrites the same key.
    const versionedFilename = `${filename}?v=${Date.now()}`;

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'faction_card_image_upload',
      before: null,
      after: { faction, cardName, filename: versionedFilename },
      metadata: { faction, cardName, r2Key },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, imageUrl: versionedFilename });
  } catch (error) {
    console.error('Upload faction image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
