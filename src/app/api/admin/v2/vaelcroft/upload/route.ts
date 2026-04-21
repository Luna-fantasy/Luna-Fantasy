import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { getPresignedUploadUrl, getPublicUrl, isR2Configured } from '@/lib/admin/r2';

export const dynamic = 'force-dynamic';

const ALLOWED_KINDS = ['property', 'item'] as const;
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });
  if (!isR2Configured()) return NextResponse.json({ error: 'R2 not configured' }, { status: 501 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const kind = String(body.kind ?? '');
  if (!ALLOWED_KINDS.includes(kind as any)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

  const contentType = String(body.contentType ?? '');
  const extension = ALLOWED_TYPES[contentType];
  if (!extension) return NextResponse.json({ error: 'Unsupported contentType' }, { status: 400 });

  const slug = String(body.slug ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const folder = kind === 'property' ? 'butler/vaelcroft/properties' : 'butler/vaelcroft/items';
  const key = `${folder}/${slug}-${Date.now()}.${extension}`;

  try {
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 600);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error('Vaelcroft upload presign error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
