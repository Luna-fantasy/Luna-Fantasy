import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp, hasMongoOperator } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { getCanvasDefinition, getCanvasDefinitionsForBot } from '@/lib/admin/canvas-definitions';

const DB_NAME = 'Database';
const VALID_BOTS = ['butler', 'jester'] as const;
type BotName = (typeof VALID_BOTS)[number];

function getConfigDocId(bot: BotName): string {
  return `${bot}_canvas_layouts`;
}

function isValidHexColor(c: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c);
}

// Per-field numeric bounds. Protects the bot's @napi-rs/canvas renderer from
// extreme values (fontSize: 99999 → multi-GB buffer, width: 1_000_000 → OOM,
// negative radius → crash). Caps are generous enough that normal tuning isn't
// constrained, but tight enough that any value outside them is a bug or abuse.
const BOUNDED_FIELDS = new Map<string, { min: number; max: number }>([
  ['fontSize', { min: 1,    max: 200 }],
  ['size',     { min: 1,    max: 800 }],
  ['radius',   { min: 1,    max: 1000 }],
  ['radiusX',  { min: 1,    max: 1000 }],
  ['radiusY',  { min: 1,    max: 1000 }],
  ['width',    { min: 1,    max: 4000 }],
  ['height',   { min: 1,    max: 4000 }],
  ['x',        { min: -500, max: 4500 }],
  ['y',        { min: -500, max: 4500 }],
]);

function validateLayout(canvasType: string, layout: any): string | null {
  const def = getCanvasDefinition(canvasType);
  if (!def) return `Unknown canvas type: ${canvasType}`;

  // Validate colors if present
  if (layout.colors && typeof layout.colors === 'object') {
    for (const [key, val] of Object.entries(layout.colors)) {
      if (typeof val !== 'string' || !isValidHexColor(val)) {
        return `Invalid color for "${key}": must be hex (#RRGGBB or #RRGGBBAA)`;
      }
    }
  }

  // Validate element positions by walking the layout recursively
  function checkNumbers(obj: any, path: string): string | null {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return null;

    for (const [key, val] of Object.entries(obj)) {
      const fullPath = `${path}.${key}`;
      if (typeof val === 'number') {
        if (!Number.isFinite(val)) return `${fullPath} must be a finite number`;
        const bounds = BOUNDED_FIELDS.get(key);
        if (bounds) {
          if (val < bounds.min || val > bounds.max) {
            return `${fullPath}=${val} out of range [${bounds.min}, ${bounds.max}]`;
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        const err = checkNumbers(val, fullPath);
        if (err) return err;
      }
    }
    return null;
  }

  const numErr = checkNumbers(layout, canvasType);
  if (numErr) return numErr;

  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bot: string }> }
) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const { bot } = await params;
  if (!VALID_BOTS.includes(bot as BotName)) {
    return NextResponse.json({ error: 'Invalid bot. Use "butler" or "jester".' }, { status: 400 });
  }

  const discordId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const docId = getConfigDocId(bot as BotName);

    const doc = await db.collection('bot_config').findOne({ _id: docId as any });
    const layouts = doc?.data ?? {};

    return NextResponse.json({
      layouts,
      definitions: getCanvasDefinitionsForBot(bot as BotName),
      metadata: {
        updatedAt: doc?.updatedAt ?? null,
        updatedBy: doc?.updatedBy ?? null,
      },
    });
  } catch (error) {
    console.error(`[admin/canvas/${bot} GET] Error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ bot: string }> }
) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const { bot } = await params;
  if (!VALID_BOTS.includes(bot as BotName)) {
    return NextResponse.json({ error: 'Invalid bot. Use "butler" or "jester".' }, { status: 400 });
  }

  const adminId = auth.session.user.discordId!;
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs, 'Too many actions. Wait a moment.');
  }

  try {
    const { canvasType, layout } = await req.json();

    if (!canvasType || typeof canvasType !== 'string') {
      return NextResponse.json({ error: 'canvasType is required' }, { status: 400 });
    }
    if (!layout || typeof layout !== 'object') {
      return NextResponse.json({ error: 'layout object is required' }, { status: 400 });
    }

    const def = getCanvasDefinition(canvasType);
    if (!def || def.bot !== bot) {
      return NextResponse.json({ error: `Canvas type "${canvasType}" not found for bot "${bot}"` }, { status: 400 });
    }

    const validationError = validateLayout(canvasType, layout);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (hasMongoOperator(layout)) {
      return NextResponse.json({ error: 'Layout contains invalid keys' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const docId = getConfigDocId(bot as BotName);

    // Get the current state for audit log
    const currentDoc = await db.collection('bot_config').findOne({ _id: docId as any });
    const before = currentDoc?.data?.[canvasType] ?? null;

    // Upsert: merge with existing layouts for this bot
    await db.collection('bot_config').updateOne(
      { _id: docId as any },
      {
        $set: {
          [`data.${canvasType}`]: layout,
          updatedAt: new Date(),
          updatedBy: adminId,
        },
      },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user.username ?? 'unknown',
      action: 'canvas_layout_update',
      metadata: { bot, canvasType },
      before,
      after: layout,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[admin/canvas/${bot} PUT] Error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
