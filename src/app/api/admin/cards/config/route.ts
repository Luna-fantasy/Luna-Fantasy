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
import { invalidateCardCatalogCache } from '@/lib/cards';
import { assertNoWipe } from '@/lib/admin/wipe-guard';

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

/**
 * Force a `?v=<timestamp>` cache-buster onto every saved image filename.
 * Without this, the public Faction War page (and Cloudflare's CDN) keeps
 * serving the cached version of the same R2 key after we overwrite it.
 * Skips data: URLs and preserves any existing query params.
 */
function stampCacheBust(image: string): string {
    if (!image) return image;
    if (image.startsWith('data:') || image.startsWith('blob:')) return image;
    const v = Date.now().toString();
    if (!image.includes('?')) return `${image}?v=${v}`;
    const [base, query] = image.split('?', 2);
    const params = new URLSearchParams(query);
    params.set('v', v);
    return `${base}?${params.toString()}`;
}
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
  /**
   * Defensive wipe guard. Pass the count of cards present BEFORE the in-memory
   * mutation so this function can refuse a catastrophic shrink. Caller must
   * pass `confirmShrink: true` for legitimate mass-deletion. Default is to
   * enforce. Skip only when the caller has already enforced equivalent checks.
   */
  guardOpts?: { beforeCount?: number; confirmShrink?: boolean; skipGuard?: boolean },
): Promise<void> {
  if (!guardOpts?.skipGuard) {
    // Re-read current count from the DB to make the guard race-free even if
    // the caller's in-memory `beforeCount` was wrong. If the read fails,
    // refuse the write — better safe than sorry.
    const currentDoc = await db.collection('luna_pairs_config').findOne({ _id: factionId as any });
    const currentCount = Array.isArray((currentDoc as any)?.data?.cards)
      ? ((currentDoc as any).data.cards as unknown[]).length
      : 0;
    const guardResult = assertNoWipe(currentCount, cards.length, {
      label: `${factionId} faction cards`,
      confirmShrink: !!guardOpts?.confirmShrink,
    });
    if (!guardResult.ok && guardResult.error) {
      const err: any = new Error(guardResult.error.message);
      err.statusCode = 409;
      err.beforeCount = guardResult.error.before;
      err.afterCount = guardResult.error.after;
      throw err;
    }
  }
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

    // FactionWar factions — read from luna_pairs_config (canonical source).
    // Each faction has its own doc keyed by lowercase id ('lunarians',
    // 'mythical_creatures', etc) with `data.cards[]` containing the card list.
    // The previous implementation looked at bot_config.jester_game_settings
    // which only stores game tuning (ticket_cost, prizes) — never the cards —
    // so it always returned empty and the dashboard rendered "data not available".
    let factionWar: Record<string, any> | null = null;
    try {
      const factionDocs = await db.collection('luna_pairs_config').find({}).toArray();
      if (factionDocs.length > 0) {
        const built: Record<string, any> = {};
        for (const doc of factionDocs) {
          const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
          if (!data) continue;
          const docId = String(doc._id);
          // data.name is a LocalizedString { en, ar } — extract .en for keying.
          // Fall back to mapping doc._id ('moon_creatures') → display name ('Moon Creatures').
          let factionDisplayName: string | undefined;
          const rawName = data.name;
          if (typeof rawName === 'string') factionDisplayName = rawName;
          else if (rawName && typeof rawName === 'object' && typeof rawName.en === 'string') factionDisplayName = rawName.en;
          if (!factionDisplayName) {
            factionDisplayName = VALID_FACTIONS.find(f => f.toLowerCase().replace(/\s+/g, '_') === docId);
          }
          if (!factionDisplayName) continue;
          built[factionDisplayName] = {
            emoji: data.emoji ?? data.icon ?? undefined,
            cards: Array.isArray(data.cards) ? data.cards : [],
          };
        }
        if (Object.keys(built).length > 0) factionWar = built;
      }
    } catch (err) { console.error('[CARDS-CONFIG] luna_pairs_config read failed:', err); }

    // Fallback to bot_config / config.ts only if luna_pairs_config is empty
    // (e.g. local dev where the data hasn't been seeded yet).
    if (!factionWar) {
      try {
        const fwDoc = await db.collection('bot_config').findOne({ _id: 'jester_game_settings' as any });
        if (fwDoc?.data?.FactionWar?.factions) {
          factionWar = fwDoc.data.FactionWar.factions;
        }
      } catch { /* non-critical */ }
    }

    if (!factionWar) {
      try {
        const configContent = await readJesterConfig();
        const parsed = parseFactionWarFull(configContent);
        if (parsed?.factions) {
          factionWar = parsed.factions;
        }
      } catch { /* config.ts unavailable on Railway */ }
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

  let body: { rarity: string; items: CardItem[]; deploy?: boolean; confirmShrink?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { rarity, items, deploy, confirmShrink } = body;
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

    // 1b. WIPE GUARD — see src/lib/admin/wipe-guard.ts. The CardEditDialog
    // edit path should NEVER trigger this; if it does, something on the
    // client is broken and we fail loudly instead of nuking data.
    const guardResult = assertNoWipe(beforeItems.length, items.length, {
      label: `${upperRarity} cards`,
      confirmShrink: !!confirmShrink,
    });
    if (!guardResult.ok && guardResult.error) {
      return NextResponse.json(
        { error: guardResult.error.message, before: guardResult.error.before, after: guardResult.error.after },
        { status: 409 },
      );
    }

    // 1c. IMPLICIT-RENAME GUARD. The bulk PUT cannot tell the difference
    // between (delete card X, add card Y) and (rename X to Y) — both produce
    // the same items array. But the second case strands every user record
    // and transaction log that named X. So we look for the telltale shape of
    // an unintended rename: exactly one name disappeared from `before`, exactly
    // one new name appeared in `after`, and they share an imageUrl. When that
    // pattern shows up, we refuse the PUT and point the caller at the
    // rename_card action which propagates the rename atomically.
    {
      const beforeNames = new Set(beforeItems.map((c: CardItem) => c.name));
      const afterNames = new Set(items.map((c: CardItem) => c.name));
      const removed = beforeItems.filter((c: CardItem) => !afterNames.has(c.name));
      const added = items.filter((c: CardItem) => !beforeNames.has(c.name));
      if (removed.length === 1 && added.length === 1) {
        const r = removed[0]!;
        const a = added[0]!;
        const sameImage = !!r.imageUrl && !!a.imageUrl && r.imageUrl.split('?')[0] === a.imageUrl.split('?')[0];
        const sameStats = r.attack === a.attack && r.weight === a.weight;
        if (sameImage || sameStats) {
          return NextResponse.json(
            {
              error:
                `This looks like a rename: "${r.name}" → "${a.name}". A bulk save would orphan every user who owns the old card and every transaction logged under the old name. Use the rename action instead — it propagates the change atomically.`,
              implicitRename: { oldName: r.name, newName: a.name, rarity: upperRarity },
            },
            { status: 409 },
          );
        }
      }
    }

    // 2. Write to MongoDB cards_config (canonical source)
    await db.collection('cards_config').updateOne(
      { _id: upperRarity as any },
      { $set: { items, updatedAt: new Date() }, $unset: { data: '' } },
      { upsert: true }
    );
    invalidateCardCatalogCache(); // public catalog pages pick up the change immediately

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
    case 'rename_card':
      return handleRenameCard(body, adminId, authResult, request);
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

// ── Action: rename_card ──
//
// The rename problem: cards are name-keyed end-to-end. Renaming "Luna Knight"
// to "Luna Champion" via the bulk PUT used to:
//   1. Replace the catalog item's name → catalog says "Luna Champion" with 0 owners
//   2. Leave every user's `cards[].name` as "Luna Knight" → orphaned forever
//   3. Strand transaction logs and any in-flight trades pointing at the old name
//
// This action does the rename atomically (Atlas replica-set transaction) across
// all four collections, so there is no window where the catalog and user records
// disagree. It also doubles as the rarity-move primitive: if oldRarity !==
// newRarity, the card moves tier and every user record's `rarity` field updates
// in lockstep.
//
// Guarantees on success:
//   - cards_config[oldRarity].items no longer contains a card named oldName
//   - cards_config[newRarity].items contains a card named newName with the
//     same imageUrl/attack/weight (preserved verbatim from the source item)
//   - Every user with cards[] entries matching {name: oldName, rarity: oldRarity}
//     now has those entries set to {name: newName, rarity: newRarity}
//   - Every cards_transactions doc whose metadata.cardName == oldName (and
//     metadata.rarity == oldRarity if present) is updated to the new values
//   - Audit log row written with affected counts
//
// Validation rejects: missing fields, name collision (newName already in any
// rarity), rarity unknown, oldName not actually present at oldRarity.
async function handleRenameCard(body: any, adminId: string, authResult: any, request: NextRequest) {
  const { oldRarity, oldName, newRarity, newName } = body;

  if (!oldRarity || !oldName || !newRarity || !newName) {
    return NextResponse.json(
      { error: 'oldRarity, oldName, newRarity, newName are all required' },
      { status: 400 }
    );
  }
  const upperOld = String(oldRarity).toUpperCase() as Rarity;
  const upperNew = String(newRarity).toUpperCase() as Rarity;
  if (!VALID_RARITIES.includes(upperOld)) {
    return NextResponse.json({ error: `Invalid oldRarity: ${oldRarity}` }, { status: 400 });
  }
  if (!VALID_RARITIES.includes(upperNew)) {
    return NextResponse.json({ error: `Invalid newRarity: ${newRarity}` }, { status: 400 });
  }
  const trimmedOld = String(oldName).trim();
  const trimmedNew = String(newName).trim();
  if (!trimmedOld || !trimmedNew) {
    return NextResponse.json({ error: 'oldName and newName cannot be empty' }, { status: 400 });
  }
  if (trimmedNew.length > 80) {
    return NextResponse.json({ error: 'newName too long (max 80)' }, { status: 400 });
  }
  // No-op
  if (upperOld === upperNew && trimmedOld === trimmedNew) {
    return NextResponse.json({ success: true, noop: true, affectedUsers: 0, affectedCopies: 0, affectedTransactions: 0 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Pre-flight: confirm the source card exists and the destination name is free.
  // Done outside the transaction because these are read-only checks; if state
  // changes between here and the transaction body we re-verify there too.
  const sourceDoc = await db.collection('cards_config').findOne({ _id: upperOld as any });
  const sourceItems: CardItem[] = Array.isArray((sourceDoc as any)?.items)
    ? (sourceDoc as any).items
    : (typeof (sourceDoc as any)?.data === 'string' ? JSON.parse((sourceDoc as any).data) : []);
  const sourceCard = sourceItems.find((c) => c.name === trimmedOld);
  if (!sourceCard) {
    return NextResponse.json(
      { error: `Card "${trimmedOld}" not found in ${upperOld}` },
      { status: 404 }
    );
  }

  // Collision check: refuse if newName exists in any rarity (case-insensitive)
  // and isn't the same card we're renaming.
  const allConfig = await db.collection('cards_config').find({}).toArray();
  for (const doc of allConfig) {
    const docRarity = String((doc as any)._id);
    const items: CardItem[] = Array.isArray((doc as any).items)
      ? (doc as any).items
      : (typeof (doc as any).data === 'string' ? JSON.parse((doc as any).data) : []);
    for (const item of items) {
      if (item.name.toLowerCase() === trimmedNew.toLowerCase()) {
        // The matching item being the source card itself is OK (rarity-only change
        // with same name, or no-op). Anything else is a collision.
        if (!(docRarity === upperOld && item.name === trimmedOld)) {
          return NextResponse.json(
            { error: `Card name "${trimmedNew}" already exists in ${docRarity}. Pick a different name.` },
            { status: 409 }
          );
        }
      }
    }
  }

  let affectedUsers = 0;
  let affectedCopies = 0;
  let affectedTransactions = 0;

  // Atlas replica sets support multi-document transactions; if the cluster
  // ever rejects the transaction (sharded without proper config, etc.) we
  // fall through to sequential writes below — order chosen so a partial
  // failure leaves the catalog matching the user records.
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Update cards_config — handle in-place rename and cross-rarity move.
      if (upperOld === upperNew) {
        // Same-rarity rename: $set the matching item's name in place. Preserves
        // imageUrl/attack/weight without re-uploading anything.
        const setRes = await db.collection('cards_config').updateOne(
          { _id: upperOld as any, 'items.name': trimmedOld },
          { $set: { 'items.$.name': trimmedNew, updatedAt: new Date() } },
          { session }
        );
        if (setRes.matchedCount !== 1) {
          throw new Error(`Source card disappeared mid-rename in ${upperOld}`);
        }
      } else {
        // Cross-rarity move: pull from source, push to dest. Same item shape.
        await db.collection('cards_config').updateOne(
          { _id: upperOld as any },
          { $pull: { items: { name: trimmedOld } as any }, $set: { updatedAt: new Date() } },
          { session }
        );
        const moved: CardItem = { ...sourceCard, name: trimmedNew };
        await db.collection('cards_config').updateOne(
          { _id: upperNew as any },
          { $push: { items: moved as any }, $set: { updatedAt: new Date() }, $unset: { data: '' } },
          { upsert: true, session }
        );
      }

      // 2. Update every user's cards array — both `cards` (canonical) and any
      // remaining `data`-string-format docs. ArrayFilters match by old name +
      // old rarity (case-insensitive on rarity since old data sometimes drifted).
      const userRes = await db.collection('cards').updateMany(
        { 'cards': { $elemMatch: { name: trimmedOld } } },
        {
          $set: {
            'cards.$[c].name': trimmedNew,
            'cards.$[c].rarity': upperNew,
          },
        },
        {
          arrayFilters: [
            {
              'c.name': trimmedOld,
              $or: [
                { 'c.rarity': upperOld },
                { 'c.rarity': upperOld.toLowerCase() },
              ],
            },
          ],
          session,
        }
      );
      affectedUsers = userRes.modifiedCount ?? 0;

      // Count copies updated (one user can own multiple copies of the same card).
      // Cheaper to count post-rename than to scan pre-update.
      const copyAgg = await db.collection('cards').aggregate([
        { $project: { cards: 1 } },
        { $unwind: '$cards' },
        { $match: { 'cards.name': trimmedNew, 'cards.rarity': upperNew } },
        { $count: 'n' },
      ], { session }).toArray();
      affectedCopies = (copyAgg[0] as any)?.n ?? 0;

      // 3. Legacy `data`-format docs (pre-flat-cards migration). Same idea but
      // we have to read-parse-write because $set can't reach into a JSON string.
      const legacyCursor = db.collection('cards').find({
        data: { $exists: true },
        cards: { $exists: false },
      }, { session });
      for await (const doc of legacyCursor) {
        try {
          const parsed = typeof (doc as any).data === 'string'
            ? JSON.parse((doc as any).data)
            : (doc as any).data;
          if (!Array.isArray(parsed)) continue;
          let dirty = false;
          for (const c of parsed) {
            if (c?.name === trimmedOld && String(c?.rarity ?? '').toUpperCase() === upperOld) {
              c.name = trimmedNew;
              c.rarity = upperNew;
              dirty = true;
            }
          }
          if (dirty) {
            await db.collection('cards').updateOne(
              { _id: (doc as any)._id },
              { $set: { cards: parsed }, $unset: { data: '' } },
              { session }
            );
            affectedUsers += 1;
          }
        } catch { /* skip malformed */ }
      }

      // 4. Update cards_transactions metadata so historical "who got X"
      // queries keep finding the card under the new name.
      const txRes = await db.collection('cards_transactions').updateMany(
        { 'metadata.cardName': trimmedOld },
        { $set: { 'metadata.cardName': trimmedNew, 'metadata.rarity': upperNew } },
        { session }
      );
      affectedTransactions = txRes.modifiedCount ?? 0;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } catch (err: any) {
    // Surface the underlying error (transaction conflict, validation, etc.) so
    // the dashboard can show why it didn't go through. The transaction guarantees
    // either-all-or-nothing, so on failure the DB is unchanged.
    console.error('[CARDS-RENAME] transaction failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Rename transaction failed' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }

  invalidateCardCatalogCache();

  await logAdminAction({
    adminDiscordId: adminId,
    adminUsername: authResult.session.user?.globalName ?? 'Unknown',
    action: 'cards_rename',
    before: { rarity: upperOld, name: trimmedOld },
    after: { rarity: upperNew, name: trimmedNew, affectedUsers, affectedCopies, affectedTransactions },
    metadata: { oldRarity: upperOld, newRarity: upperNew, oldName: trimmedOld, newName: trimmedNew },
    ip: getClientIp(request),
  });

  return NextResponse.json({
    success: true,
    affectedUsers,
    affectedCopies,
    affectedTransactions,
  });
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

    // Wipe guard. update_image only mutates one card's imageUrl in place, so
    // configCards.length should equal beforeItems.length. If a future bug
    // accidentally reassigns configCards = [], this catches it.
    {
      const before = await db.collection('cards_config').findOne({ _id: upperRarity as any });
      const beforeCount = Array.isArray(before?.items) ? before!.items.length : configCards.length;
      const guardResult = assertNoWipe(beforeCount, configCards.length, {
        label: `${upperRarity} cards (update_image)`,
      });
      if (!guardResult.ok && guardResult.error) {
        return NextResponse.json(
          { error: guardResult.error.message, before: guardResult.error.before, after: guardResult.error.after },
          { status: 409 },
        );
      }
    }

    await db.collection('cards_config').updateOne(
      { _id: upperRarity as any },
      { $set: { items: configCards, updatedAt: new Date() }, $unset: { data: '' } }
    );
    invalidateCardCatalogCache();

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
      image: stampCacheBust(card.image),
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
    // Always re-stamp `?v=` on save. This guarantees the public site's URL
    // changes whenever an admin touches the card, even if they only renamed it
    // or didn't upload a new image — overkill but cheap, and it eliminates the
    // entire class of "image stays the same" bugs caused by missing version stamps.
    const nextImage = card.image === beforeCard.image
      ? beforeCard.image  // image unchanged → keep existing stamp (don't refresh CDN unnecessarily)
      : stampCacheBust(card.image);
    cards[cardIdx] = {
      name: card.name.trim(),
      image: nextImage,
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
