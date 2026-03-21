import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { readJesterConfig } from '@/lib/admin/config-writer';
import { uploadObject, deleteObject, isR2Configured } from '@/lib/admin/r2';
import clientPromise from '@/lib/mongodb';

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
  const { allowed } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

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

    // Fallback to config.ts if MongoDB is empty
    if (rarities.length === 0) {
      const configContent = await readJesterConfig();
      const parsed = parseCardsBlock(configContent);
      if (parsed) {
        rarities = Object.entries(parsed.cards).map(([rarity, items]) => ({ rarity, items }));
      }
    }

    // FactionWar factions — read from bot_config or fallback to config.ts
    let factionWar = null;
    const fwDoc = await db.collection('bot_config').findOne({ _id: 'jester_game_settings' as any });
    if (fwDoc?.data?.FactionWar?.factions) {
      factionWar = fwDoc.data.FactionWar.factions;
    } else {
      // Fallback to config.ts
      const configContent = await readJesterConfig();
      const fwData = parseFactionWarFull(configContent);
      factionWar = fwData?.factions ?? null;
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
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

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
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

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
    const imageUrl = await uploadObject(r2Key, buffer, mimeType);
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
    const col = client.db(DB_NAME).collection('bot_config');

    // Read FactionWar data from bot_config
    const doc = await col.findOne({ _id: 'jester_game_settings' as any });
    const fwData = doc?.data?.FactionWar;
    if (!fwData || !fwData.factions) {
      return NextResponse.json({ error: 'FactionWar config not found in database' }, { status: 500 });
    }

    const factionData = fwData.factions[faction];
    if (!factionData) {
      return NextResponse.json({ error: `Faction "${faction}" not found in config` }, { status: 404 });
    }

    if (!Array.isArray(factionData.cards)) {
      factionData.cards = [];
    }

    const exists = factionData.cards.some((c: FactionCard) => c.name === card.name.trim());
    if (exists) {
      return NextResponse.json({ error: `Card "${card.name}" already exists in ${faction}` }, { status: 409 });
    }

    const newCard: FactionCard = { name: card.name.trim(), image: card.image };
    factionData.cards.push(newCard);

    // Write back to MongoDB
    await col.updateOne(
      { _id: 'jester_game_settings' as any },
      { $set: { 'data.FactionWar.factions': fwData.factions, updatedAt: new Date(), updatedBy: adminId } }
    );

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
    const col = client.db(DB_NAME).collection('bot_config');

    const doc = await col.findOne({ _id: 'jester_game_settings' as any });
    const fwData = doc?.data?.FactionWar;
    if (!fwData || !fwData.factions) {
      return NextResponse.json({ error: 'FactionWar config not found in database' }, { status: 500 });
    }

    const factionData = fwData.factions[faction];
    if (!factionData || !Array.isArray(factionData.cards)) {
      return NextResponse.json({ error: `Faction "${faction}" not found or has no cards` }, { status: 404 });
    }

    const cardIdx = factionData.cards.findIndex((c: FactionCard) => c.name === oldName);
    if (cardIdx === -1) {
      return NextResponse.json({ error: `Card "${oldName}" not found in ${faction}` }, { status: 404 });
    }

    if (card.name.trim() !== oldName) {
      const dup = factionData.cards.some((c: FactionCard) => c.name === card.name.trim());
      if (dup) {
        return NextResponse.json({ error: `Card "${card.name}" already exists in ${faction}` }, { status: 409 });
      }
    }

    const beforeCard = { ...factionData.cards[cardIdx] };
    factionData.cards[cardIdx] = { name: card.name.trim(), image: card.image };

    await col.updateOne(
      { _id: 'jester_game_settings' as any },
      { $set: { 'data.FactionWar.factions': fwData.factions, updatedAt: new Date(), updatedBy: adminId } }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'faction_card_update',
      before: { faction, card: beforeCard },
      after: { faction, card: factionData.cards[cardIdx] },
      metadata: { faction, oldName, newName: card.name.trim() },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, card: factionData.cards[cardIdx] });
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
    const col = client.db(DB_NAME).collection('bot_config');

    const doc = await col.findOne({ _id: 'jester_game_settings' as any });
    const fwData = doc?.data?.FactionWar;
    if (!fwData || !fwData.factions) {
      return NextResponse.json({ error: 'FactionWar config not found in database' }, { status: 500 });
    }

    const factionData = fwData.factions[faction];
    if (!factionData || !Array.isArray(factionData.cards)) {
      return NextResponse.json({ error: `Faction "${faction}" not found or has no cards` }, { status: 404 });
    }

    const cardIdx = factionData.cards.findIndex((c: FactionCard) => c.name === cardName);
    if (cardIdx === -1) {
      return NextResponse.json({ error: `Card "${cardName}" not found in ${faction}` }, { status: 404 });
    }

    const deletedCard = factionData.cards.splice(cardIdx, 1)[0];

    await col.updateOne(
      { _id: 'jester_game_settings' as any },
      { $set: { 'data.FactionWar.factions': fwData.factions, updatedAt: new Date(), updatedBy: adminId } }
    );

    // Clean up R2 image
    if (deletedCard.image) {
      if (deletedCard.image.startsWith('https://assets.lunarian.app/')) {
        const r2Key = deletedCard.image.replace('https://assets.lunarian.app/', '');
        deleteObject(r2Key).catch(() => {});
      } else {
        const factionFolder = faction.toLowerCase().replace(/\s+/g, '_');
        const safeCardName = cardName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
        const possibleKey = `cards/FactionWar/${factionFolder}_${safeCardName}.png`;
        deleteObject(possibleKey).catch(() => {});
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
    const r2Key = `cards/FactionWar/${factionFolder}_${safeCardName}.png`;
    const buffer = Buffer.from(imageData, 'base64');
    const mimeType = contentType || 'image/png';
    const newUrl = await uploadObject(r2Key, buffer, mimeType);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'faction_card_image_upload',
      before: null,
      after: { faction, cardName, imageUrl: newUrl },
      metadata: { faction, cardName, r2Key },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, imageUrl: newUrl });
  } catch (error) {
    console.error('Upload faction image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
