import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

type Action = 'like' | 'dislike' | 'clear_vote' | 'accept' | 'reject';

function safeAppId(raw: string): string {
  return String(raw).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}

function sanitizeReason(raw: unknown): string {
  return String(raw ?? '')
    .replace(/@everyone|@here/gi, '')
    .replace(/<@[!&]?\d+>/g, '')
    .replace(/[\x00-\x1f]/g, ' ')
    .trim()
    .slice(0, 500);
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const adminUsername = auth.session.user?.globalName ?? 'Unknown';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const appId = safeAppId(context.params.id);
  if (!appId) return NextResponse.json({ error: 'Invalid appId' }, { status: 400 });

  let body: { action: Action; reason?: string; reopen?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const action = body.action;
  if (!['like', 'dislike', 'clear_vote', 'accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const client = await clientPromise;
  const col = client.db('Database').collection('applications');

  const existing = await col.findOne({ _id: appId as any });
  if (!existing) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const now = Date.now();

  const likes: string[] = Array.isArray((existing as any).votes?.likes) ? (existing as any).votes.likes.map(String) : [];
  const dislikes: string[] = Array.isArray((existing as any).votes?.dislikes) ? (existing as any).votes.dislikes.map(String) : [];

  let nextLikes = likes.slice();
  let nextDislikes = dislikes.slice();
  let nextStatus: string = (existing as any).status ?? 'pending';
  const setPatch: Record<string, any> = {};
  const unsetPatch: Record<string, any> = {};

  // Cap vote arrays to prevent unbounded growth (safety against thousands of admins)
  const MAX_VOTERS = 500;

  if (action === 'like') {
    nextLikes    = Array.from(new Set([...likes, adminId])).slice(-MAX_VOTERS);
    nextDislikes = dislikes.filter((id) => id !== adminId);
  } else if (action === 'dislike') {
    nextDislikes = Array.from(new Set([...dislikes, adminId])).slice(-MAX_VOTERS);
    nextLikes    = likes.filter((id) => id !== adminId);
  } else if (action === 'clear_vote') {
    nextLikes    = likes.filter((id) => id !== adminId);
    nextDislikes = dislikes.filter((id) => id !== adminId);
  } else if (action === 'accept') {
    const reopen = Boolean(body.reopen);
    if (reopen) {
      nextStatus = 'pending';
      unsetPatch.acceptedAt = '';
      unsetPatch.acceptedBy = '';
      unsetPatch.rejectedAt = '';
      unsetPatch.rejectedBy = '';
      unsetPatch.rejectionReason = '';
    } else {
      nextStatus = 'accepted';
      setPatch.acceptedAt = now;
      setPatch.acceptedBy = adminId;
      const reason = sanitizeReason(body.reason);
      if (reason) setPatch.acceptReason = reason;
    }
  } else if (action === 'reject') {
    const reason = sanitizeReason(body.reason);
    if (!reason || reason.length < 4) {
      return NextResponse.json({ error: 'Reject requires a reason (min 4 chars).' }, { status: 400 });
    }
    nextStatus = 'rejected';
    setPatch.rejectedAt = now;
    setPatch.rejectedBy = adminId;
    setPatch.rejectionReason = reason;
  }

  setPatch.votes = { likes: nextLikes, dislikes: nextDislikes };
  setPatch.status = nextStatus;

  await col.updateOne(
    { _id: appId as any },
    { $set: setPatch, ...(Object.keys(unsetPatch).length ? { $unset: unsetPatch } : {}) },
  );

  const auditAction =
    action === 'accept'
      ? (body.reopen ? 'application_reopen' : 'application_accept')
    : action === 'reject' ? 'application_reject'
    : 'application_vote';

  await logAdminAction({
    adminDiscordId: adminId,
    adminUsername,
    action: auditAction,
    targetDiscordId: String((existing as any).userId ?? ''),
    before: {
      status: (existing as any).status ?? null,
      likes: likes.length,
      dislikes: dislikes.length,
    },
    after: { status: nextStatus, likes: nextLikes.length, dislikes: nextDislikes.length },
    metadata: {
      appId,
      voteAction: action === 'like' || action === 'dislike' || action === 'clear_vote' ? action : undefined,
      reason: setPatch.rejectionReason ?? setPatch.acceptReason,
    },
    ip: getClientIp(req),
  });

  return NextResponse.json({
    success: true,
    status: nextStatus,
    votes: setPatch.votes,
    acceptedBy: setPatch.acceptedBy,
    acceptedAt: setPatch.acceptedAt ? new Date(setPatch.acceptedAt).toISOString() : undefined,
    rejectedBy: setPatch.rejectedBy,
    rejectedAt: setPatch.rejectedAt ? new Date(setPatch.rejectedAt).toISOString() : undefined,
    rejectionReason: setPatch.rejectionReason,
  });
}
