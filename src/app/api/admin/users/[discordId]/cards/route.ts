import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

function parseCards(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try { const parsed = JSON.parse(data); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });

  let body: { card: any; reason: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { card, reason } = body;
  if (!card || !card.name || !card.rarity) return NextResponse.json({ error: 'Card must have name and rarity' }, { status: 400 });

  const VALID_RARITIES = ['COMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'SPECIAL', 'SECRET', 'FORBIDDEN'];
  if (!VALID_RARITIES.includes(card.rarity)) {
    return NextResponse.json({ error: `Invalid rarity: ${card.rarity}` }, { status: 400 });
  }
  if (!reason || reason.length < 3) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('cards');

    const doc = await col.findOne({ _id: discordId as any });
    const currentCards = doc ? parseCards(doc.cards ?? doc.data) : [];

    const newCard = {
      ...card,
      id: card.id ?? `admin_${Date.now()}`,
      source: 'admin_grant',
      obtainedDate: new Date().toISOString(),
    };
    const updatedCards = [...currentCards, newCard];

    await col.updateOne(
      { _id: discordId as any },
      { $set: { cards: updatedCards }, $unset: { data: "" } },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'card_give',
      targetDiscordId: discordId,
      before: { cardCount: currentCards.length },
      after: { cardCount: updatedCards.length, card: newCard },
      metadata: { reason, cardName: newCard.name, rarity: newCard.rarity },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, card: newCard, totalCards: updatedCards.length });
  } catch (error) {
    console.error('Card give error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });

  let body: { cardId: string; reason: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { cardId, reason } = body;
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });
  if (!reason || reason.length < 3) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('cards');

    const doc = await col.findOne({ _id: discordId as any });
    if (!doc) return NextResponse.json({ error: 'User has no cards' }, { status: 404 });

    const currentCards = parseCards(doc.cards ?? doc.data);
    const cardIndex = currentCards.findIndex((c: any) => c.id === cardId);
    if (cardIndex === -1) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    const removedCard = currentCards[cardIndex];
    const updatedCards = currentCards.filter((_: any, i: number) => i !== cardIndex);

    await col.updateOne(
      { _id: discordId as any },
      { $set: { cards: updatedCards }, $unset: { data: "" } }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'card_remove',
      targetDiscordId: discordId,
      before: { cardCount: currentCards.length, card: removedCard },
      after: { cardCount: updatedCards.length },
      metadata: { reason, cardName: removedCard.name, rarity: removedCard.rarity },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, removedCard, totalCards: updatedCards.length });
  } catch (error) {
    console.error('Card remove error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
