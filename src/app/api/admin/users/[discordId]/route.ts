import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getUserProfile } from '@/lib/admin/db';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';

export async function GET(
  _request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  try {
    const profile = await getUserProfile(discordId);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error('User profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
