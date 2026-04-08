import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import clientPromise from '@/lib/mongodb';

const ALLOWED_TYPES = ['keyword', 'reaction', 'periodic', 'unanswered_question'] as const;
const CHANNEL_ID_REGEX = /^\d{17,20}$/;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);

    // Parse and validate pagination
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const limit = limitParam
      ? Math.min(MAX_LIMIT, Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT))
      : DEFAULT_LIMIT;

    // Parse optional filters
    const typeFilter = searchParams.get('type');
    const channelFilter = searchParams.get('channel');

    // Build query filter
    const filter: Record<string, any> = {};

    if (typeFilter) {
      if (!ALLOWED_TYPES.includes(typeFilter as any)) {
        return NextResponse.json(
          { error: `Invalid type filter. Allowed: ${ALLOWED_TYPES.join(', ')}` },
          { status: 400 },
        );
      }
      filter.triggerType = typeFilter;
    }

    if (channelFilter) {
      if (!CHANNEL_ID_REGEX.test(channelFilter)) {
        return NextResponse.json(
          { error: 'channel must be a valid Discord channel ID (17-20 digit string)' },
          { status: 400 },
        );
      }
      filter.channelId = channelFilter;
    }

    const client = await clientPromise;
    const db = client.db('Database');
    const collection = db.collection('sage_activity_log');

    const skip = (page - 1) * limit;

    // Run count and find in parallel
    const [rawItems, total] = await Promise.all([
      collection.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter),
    ]);

    // Remap MongoDB field names to the dashboard's expected shape
    const items = rawItems.map((doc: any) => ({
      _id: doc._id?.toString(),
      time: doc.timestamp,
      channelId: doc.channelId,
      type: doc.triggerType,
      reason: doc.triggerReason,
      action: doc.action,
      responsePreview: doc.responseText,
      emoji: doc.emoji,
    }));

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[sage-live-chat/activity-log] GET error:', err);
    return NextResponse.json({ error: 'Failed to read activity log' }, { status: 500 });
  }
}
