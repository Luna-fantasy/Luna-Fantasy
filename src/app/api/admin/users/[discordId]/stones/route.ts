import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

function parseStones(data: unknown): any[] {
  if (typeof data === 'string') {
    try { const parsed = JSON.parse(data); return parsed?.stones ?? []; } catch { return []; }
  }
  if (typeof data === 'object' && data !== null) return (data as any).stones ?? [];
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
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });

  let body: { stone: any; reason: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { stone, reason } = body;
  if (!stone || !stone.name) return NextResponse.json({ error: 'Stone must have a name' }, { status: 400 });
  if (!reason || reason.length < 3) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('stones');

    const doc = await col.findOne({ _id: discordId as any });
    const currentStones = doc ? (Array.isArray(doc.stones) ? doc.stones : parseStones(doc.data)) : [];

    const newStone = {
      ...stone,
      id: stone.id ?? `admin_${Date.now()}`,
      acquiredAt: new Date().toISOString(),
    };
    const updatedStones = [...currentStones, newStone];

    await col.updateOne(
      { _id: discordId as any },
      { $set: { stones: updatedStones }, $unset: { data: "" } },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'stone_give',
      targetDiscordId: discordId,
      before: { stoneCount: currentStones.length },
      after: { stoneCount: updatedStones.length, stone: newStone },
      metadata: { reason, stoneName: newStone.name },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, stone: newStone, totalStones: updatedStones.length });
  } catch (error) {
    console.error('Stone give error:', error);
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
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });

  let body: { stoneId: string; reason: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { stoneId, reason } = body;
  if (!stoneId) return NextResponse.json({ error: 'stoneId required' }, { status: 400 });
  if (!reason || reason.length < 3) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('stones');

    const doc = await col.findOne({ _id: discordId as any });
    if (!doc) return NextResponse.json({ error: 'User has no stones' }, { status: 404 });

    const currentStones = doc ? (Array.isArray(doc.stones) ? doc.stones : parseStones(doc.data)) : [];
    const stoneIndex = currentStones.findIndex((s: any) => s.id === stoneId);
    if (stoneIndex === -1) return NextResponse.json({ error: 'Stone not found' }, { status: 404 });

    const removedStone = currentStones[stoneIndex];
    const updatedStones = currentStones.filter((_: any, i: number) => i !== stoneIndex);

    await col.updateOne(
      { _id: discordId as any },
      { $set: { stones: updatedStones }, $unset: { data: "" } }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'stone_remove',
      targetDiscordId: discordId,
      before: { stoneCount: currentStones.length, stone: removedStone },
      after: { stoneCount: updatedStones.length },
      metadata: { reason, stoneName: removedStone.name },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, removedStone, totalStones: updatedStones.length });
  } catch (error) {
    console.error('Stone remove error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
