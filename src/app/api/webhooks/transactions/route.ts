import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import type { TransactionType } from '@/types/bazaar';

const VALID_TYPES: Set<string> = new Set<string>([
  'stripe_purchase', 'luckbox_spend', 'stonebox_spend', 'ticket_spend', 'refund',
  'bank_daily', 'bank_loan_taken', 'bank_loan_repaid', 'bank_loan_partial_repaid',
  'bank_investment_deposit', 'bank_investment_withdraw', 'bank_insurance', 'bank_debt_paid',
  'marketplace_buy', 'marketplace_sell', 'trade_win', 'trade_loss', 'swap_received',
  'seluna_purchase', 'brimor_purchase', 'mells_purchase',
  'card_pull', 'card_luckbox', 'card_seluna', 'card_sell', 'card_buy', 'card_auction', 'card_swap', 'card_gift',
  'stone_chest', 'stone_seluna', 'stone_sell', 'stone_buy', 'stone_auction', 'stone_swap', 'stone_gift', 'stone_forbidden_gift',
  'lunari_added', 'lunari_spent', 'game_win', 'game_loss',
  'admin_reversal',
]);

const SNOWFLAKE_RE = /^\d{17,20}$/;
const MAX_BODY_SIZE = 8_192; // 8KB max payload
const MAX_METADATA_KEYS = 20;
const MAX_STRING_LENGTH = 500;

/**
 * Constant-time API key comparison to prevent timing attacks.
 */
function verifyApiKey(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  try {
    const a = Buffer.from(provided, 'utf-8');
    const b = Buffer.from(expected, 'utf-8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Sanitize metadata object: strip keys starting with $ (NoSQL injection),
 * limit depth to flat key-value, cap string lengths, limit key count.
 */
function sanitizeMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const clean: Record<string, unknown> = {};
  let keyCount = 0;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (keyCount >= MAX_METADATA_KEYS) break;

    // Block MongoDB operator injection
    if (key.startsWith('$') || key.includes('.')) continue;

    // Only allow safe primitive types
    if (typeof value === 'string') {
      clean[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === 'number' && isFinite(value)) {
      clean[key] = value;
    } else if (typeof value === 'boolean') {
      clean[key] = value;
    }
    // Skip objects, arrays, functions, symbols, etc.

    keyCount++;
  }

  return clean;
}

export async function POST(request: Request) {
  const expectedKey = process.env.TRANSACTION_WEBHOOK_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const apiKey = request.headers.get('x-api-key');
  if (!verifyApiKey(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit by IP — 100/min
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed, retryAfterMs } = checkRateLimit('webhook_transactions', ip, 100, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  // Enforce body size limit
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { discordId, type, amount, balanceBefore, balanceAfter, metadata } = body;

  // Validate required fields
  if (!discordId || typeof discordId !== 'string' || !SNOWFLAKE_RE.test(discordId)) {
    return NextResponse.json({ error: 'Invalid discordId (must be snowflake)' }, { status: 400 });
  }
  if (!type || typeof type !== 'string' || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
  }
  if (typeof amount !== 'number' || !isFinite(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (typeof balanceBefore !== 'number' || !isFinite(balanceBefore)) {
    return NextResponse.json({ error: 'Invalid balanceBefore' }, { status: 400 });
  }
  if (typeof balanceAfter !== 'number' || !isFinite(balanceAfter)) {
    return NextResponse.json({ error: 'Invalid balanceAfter' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('Database');

    const doc = {
      discordId,
      type: type as TransactionType,
      amount,
      balanceBefore,
      balanceAfter,
      metadata: sanitizeMetadata(metadata),
      createdAt: new Date(),
      source: 'discord' as const,
    };

    // Route to the correct collection based on transaction type
    let collection = 'lunari_transactions';
    if (type.startsWith('card_')) collection = 'cards_transactions';
    else if (type.startsWith('stone_')) collection = 'stones_transactions';

    await db.collection(collection).insertOne(doc);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[webhook/transactions] Insert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
