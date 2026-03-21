import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const overrides = await db.collection('translation_overrides').find().toArray();

    const result: Record<string, Record<string, string>> = {};
    for (const doc of overrides) {
      result[String(doc._id)] = doc.overrides ?? {};
    }

    return NextResponse.json({ overrides: result });
  } catch (error) {
    console.error('Translation overrides fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  let body: { locale: string; overrides: Record<string, string> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { locale, overrides } = body;
  if (!locale || !overrides) {
    return NextResponse.json({ error: 'locale and overrides are required' }, { status: 400 });
  }

  if (!['en', 'ar'].includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('translation_overrides');

    const before = await col.findOne({ _id: locale as any });
    await col.updateOne(
      { _id: locale as any },
      { $set: { overrides } },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'translation_override',
      before: { locale, keyCount: Object.keys(before?.overrides ?? {}).length },
      after: { locale, keyCount: Object.keys(overrides).length },
      metadata: { locale },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Translation override error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
