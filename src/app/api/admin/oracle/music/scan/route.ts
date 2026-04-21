import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { listObjects, isR2Configured } from '@/lib/admin/r2';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('oracle_music_scan', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  if (!isR2Configured()) return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });

  try {
    const { objects, truncated } = await listObjects('oracle-music/', 500);

    const audioExts = /\.(mp3|wav|ogg|opus|webm)$/i;
    const tracks = objects
      .filter((o) => audioExts.test(o.key))
      .map((o) => {
        const filename = o.key.split('/').pop() ?? o.key;
        const nameWithoutTimestamp = filename.replace(/^\d+-/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
        return {
          key: o.key,
          url: o.url,
          title: nameWithoutTimestamp || filename,
          sizeBytes: o.size,
          lastModified: o.lastModified,
        };
      });

    return NextResponse.json({ tracks, truncated });
  } catch (err) {
    console.error('[oracle/music/scan GET] Error:', err);
    return NextResponse.json({ error: 'Failed to scan R2' }, { status: 500 });
  }
}
