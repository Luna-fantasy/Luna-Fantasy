import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { uploadObject, isR2Configured } from '@/lib/admin/r2';
import clientPromise from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DB_NAME = 'Database';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg'];

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('oracle_upload', adminId, 3, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 storage not configured' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate file magic bytes (don't trust MIME type alone)
    const head = buffer.subarray(0, 4);
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
    const isJpeg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
    if (!isPng && !isJpeg) {
      return NextResponse.json({ error: 'File content does not match an image format' }, { status: 400 });
    }

    const key = 'oracle/panel_banner.png';
    const url = await uploadObject(key, buffer, file.type);

    // Update the banner URL in bot_config
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');
    await col.updateOne(
      { _id: 'oracle_vc_assets' as any },
      {
        $set: {
          'data.panelBannerUrl': url,
          updatedAt: new Date(),
          updatedBy: adminId,
        },
      },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.username ?? 'unknown',
      action: 'config_oracle_upload',
      before: null,
      after: { key, size: file.size, type: file.type },
      metadata: { url },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('[admin/config/oracle/upload POST] Error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
