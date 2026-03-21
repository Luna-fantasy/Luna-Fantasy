import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { uploadObject, deleteObject, isR2Configured } from '@/lib/admin/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_IDS = ['butler', 'jester', 'oracle', 'sage'] as const;
const UPLOAD_TYPES = ['avatar', 'banner'] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for bot images
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 storage not configured' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const botId = formData.get('botId') as string | null;
    const type = formData.get('type') as string | null;
    const previousUrl = formData.get('previousUrl') as string | null;

    if (!file || !botId || !type) {
      return NextResponse.json({ error: 'Missing required fields: file, botId, type' }, { status: 400 });
    }

    if (!BOT_IDS.includes(botId as any)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    if (!UPLOAD_TYPES.includes(type as any)) {
      return NextResponse.json({ error: 'Invalid type. Must be: avatar or banner' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate file magic bytes (don't trust MIME type alone)
    const head = buffer.subarray(0, 12);
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
    const isJpeg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
    const isWebp = head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    const isGif = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
    if (!isPng && !isJpeg && !isWebp && !isGif) {
      return NextResponse.json({ error: 'File content does not match an image format' }, { status: 400 });
    }

    // Determine file extension from MIME type
    const ext = file.type === 'image/png' ? 'png'
      : file.type === 'image/jpeg' ? 'jpg'
      : file.type === 'image/webp' ? 'webp'
      : 'gif';

    // Delete old image from R2 if replacing
    let deletedOldKey: string | null = null;
    if (previousUrl && previousUrl.includes('assets.lunarian.app/')) {
      try {
        const oldKey = previousUrl.split('assets.lunarian.app/')[1];
        if (oldKey && oldKey.startsWith('avatars/')) {
          await deleteObject(oldKey);
          deletedOldKey = oldKey;
        }
      } catch {
        // Don't fail the upload if old image cleanup fails
      }
    }

    // Use a timestamp suffix to bust CDN cache
    const key = `avatars/${botId}_${type}_${Date.now()}.${ext}`;
    const url = await uploadObject(key, buffer, file.type);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'bot_image_upload',
      before: null,
      after: { key, size: file.size, type: file.type },
      metadata: { botId, uploadType: type, url, deletedOldKey },
      ip: getClientIp(request),
    });

    return NextResponse.json({ url, key });
  } catch (error) {
    console.error('Bot image upload error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
