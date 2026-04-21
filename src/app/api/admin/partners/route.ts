import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB_NAME = 'Database';

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const partners = await db.collection('partners').find().sort({ order: 1 }).toArray();
    return NextResponse.json({
      partners: partners.map((p) => ({ ...p, _id: p._id.toString() })),
    });
  } catch (error) {
    console.error('Partners fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: {
    id: string;
    name: string;
    type: { en: string; ar: string };
    description: { en: string; ar: string };
    logo: string;
    socials: Record<string, string>;
    order: number;
  };

  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.id || !body.name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }

  if (typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(body.id)) {
    return NextResponse.json({ error: 'Invalid id format (alphanumeric, hyphens, underscores, max 50 chars)' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existing = await db.collection('partners').findOne({ id: body.id });
    if (existing) {
      return NextResponse.json({ error: `Partner with id "${body.id}" already exists` }, { status: 409 });
    }

    const result = await db.collection('partners').insertOne({
      id: body.id,
      name: body.name,
      type: body.type ?? { en: '', ar: '' },
      description: body.description ?? { en: '', ar: '' },
      logo: body.logo ?? '',
      socials: body.socials ?? {},
      order: body.order ?? 0,
    });

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'partner_create',
      before: null,
      after: { id: body.id, name: body.name },
      metadata: {},
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, _id: result.insertedId.toString() });
  } catch (error) {
    console.error('Partner create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
