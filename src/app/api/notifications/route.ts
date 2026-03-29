import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserNotifications, getUnreadCount } from '@/lib/bazaar/marketplace-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';

/**
 * GET /api/notifications
 * Get user's notifications with unread count.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  const rl = checkRateLimit('notifications', discordId, RATE_LIMITS.notifications.maxRequests, RATE_LIMITS.notifications.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(discordId, 20),
    getUnreadCount(discordId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
