import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { markNotificationsRead } from '@/lib/bazaar/marketplace-ops';

/**
 * POST /api/notifications/read
 * Mark notifications as read. If notificationIds provided, marks only those. Otherwise marks all.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  let notificationIds: string[] | undefined;
  try {
    const body = await request.json();
    if (body.notificationIds && Array.isArray(body.notificationIds)) {
      notificationIds = body.notificationIds;
    }
  } catch {
    // No body = mark all as read
  }

  await markNotificationsRead(discordId, notificationIds);

  return NextResponse.json({ success: true });
}
