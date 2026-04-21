// /api/admin/users/[discordId]/passport
// GET    → read the user's passport object (or null)
// PUT    → create or update the passport with validated fields
// DELETE → revoke the passport (sets passport: null on the profile)

import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { addGuildMemberRole, removeGuildMemberRole } from '@/lib/bank/discord-roles';

// Factions must stay in sync with Butler's PASSPORT_FACTIONS + Jester's faction war config.
// Keep this list identical to FACTION_NAMES in src/app/admin/cards/page.tsx:22.
const VALID_FACTIONS = [
  'Beasts', 'Colossals', 'Dragons', 'Knights', 'Lunarians', 'Moon Creatures',
  'Mythical Creatures', 'Strange Beings', 'Supernatural', 'Underworld', 'Warriors',
] as const;

// Accept standard Luna IDs + staff passport IDs
const PASSPORT_NUMBER_RE = /^(LUNA-110317\d{5}|GUARDIAN|SENTINEL|MASTERMIND)$/;
const DOB_RE = /^\d{2}\/\d{2}$/;

// Luna Passport role — granted on issue/edit, revoked on delete. Keep in sync
// with PASSPORT_ROLE_ID in Butler's application_commands.ts and Jester's
// passport_discount helper.
const PASSPORT_ROLE_ID = '1492596002295648266';

interface PassportPayload {
  number: string;
  fullName: string;
  dateOfBirth: string;
  faction: string;
  issuedAt?: number;
  issuedBy?: string;
  // Staff passport fields — preserved across edits
  originalNumber?: string;
  staffRole?: string;
}

function validatePassport(body: any): { valid: PassportPayload } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Body required' };
  const number = String(body.number ?? '').trim();
  const fullName = String(body.fullName ?? '').trim();
  const dateOfBirth = String(body.dateOfBirth ?? '').trim();
  const faction = String(body.faction ?? '').trim();

  if (!PASSPORT_NUMBER_RE.test(number)) {
    return { error: 'number must match LUNA-110317##### or GUARDIAN/SENTINEL/MASTERMIND' };
  }
  if (fullName.length < 1 || fullName.length > 80) {
    return { error: 'fullName must be 1–80 characters' };
  }
  if (!DOB_RE.test(dateOfBirth)) {
    return { error: 'dateOfBirth must be DD/MM (no year)' };
  }
  const [ddStr, mmStr] = dateOfBirth.split('/');
  const dd = parseInt(ddStr, 10);
  const mm = parseInt(mmStr, 10);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) {
    return { error: 'dateOfBirth day/month out of range' };
  }
  if (!VALID_FACTIONS.includes(faction as any)) {
    return { error: `faction must be one of: ${VALID_FACTIONS.join(', ')}` };
  }

  const issuedAt = typeof body.issuedAt === 'number' && Number.isFinite(body.issuedAt)
    ? body.issuedAt
    : Date.now();
  const issuedBy = typeof body.issuedBy === 'string' && /^\d{17,20}$/.test(body.issuedBy)
    ? body.issuedBy
    : '';

  // Preserve staff passport fields if present
  const staffFields: Pick<PassportPayload, 'originalNumber' | 'staffRole'> = {};
  if (typeof body.originalNumber === 'string' && body.originalNumber) {
    staffFields.originalNumber = body.originalNumber;
  }
  if (typeof body.staffRole === 'string' && ['mastermind', 'sentinel', 'guardian'].includes(body.staffRole)) {
    staffFields.staffRole = body.staffRole;
  }

  return { valid: { number, fullName, dateOfBirth, faction, issuedAt, issuedBy, ...staffFields } };
}

// Helper — read the passport out of either { data: { passport } } (st.db v7 wrapper)
// or a top-level `passport` field (flat docs migrated later).
function extractPassport(doc: any): any | null {
  if (!doc) return null;
  if (doc.passport && typeof doc.passport === 'object') return doc.passport;
  const data = doc.data;
  if (!data) return null;
  if (typeof data === 'object') return data.passport ?? null;
  if (typeof data === 'string') {
    try { return JSON.parse(data)?.passport ?? null; } catch { return null; }
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const doc = await db.collection('profiles').findOne({ _id: discordId as any });
    const passport = extractPassport(doc);
    return NextResponse.json({ passport });
  } catch (error) {
    console.error('[admin passport GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Default issuedBy to the acting admin if the client didn't send one
  if (!body.issuedBy) body.issuedBy = adminId;

  const result = validatePassport(body);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const passport = result.valid;

  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const col = db.collection('profiles');

    // Number uniqueness is NOT enforced here — masterminds are trusted to
    // assign duplicate numbers when they need to (e.g. correcting a typo or
    // re-issuing a historical ID). The bot counter still mints unique numbers
    // for automatic issuance via the application flow.

    const existingDoc = await col.findOne({ _id: discordId as any });
    const before = extractPassport(existingDoc);

    // Always use the dotted path — this is atomic and doesn't race with the
    // bot's concurrent field-path writes. Previously the legacy st.db v7
    // string-format path parsed + rewrote the WHOLE `data` object which could
    // clobber sibling fields (money_earned, game stats, etc.) if the bot
    // wrote to them between our read and write. If a user still has the
    // legacy string format, the dotted path on a string field will fail
    // with a MongoDB error; that's fine — a separate migration script
    // can convert string→object at rest. We don't block the hot path on it.
    await col.updateOne(
      { _id: discordId as any },
      { $set: { 'data.passport': passport } },
      { upsert: true }
    );

    // Grant the Luna Passport Discord role so the user immediately unlocks the
    // 10% shop discount across both bots. Failure here does NOT roll back the
    // profile write — the profile is still the source of truth. Admin will see
    // a warning in the dashboard response if the role grant failed.
    const roleGranted = await addGuildMemberRole(
      discordId,
      PASSPORT_ROLE_ID,
      `Passport ${passport.number} ${before ? 'edited' : 'issued'} by admin ${adminId}`
    );

    // Fire-and-forget audit logging — a failed audit write should not
    // roll back a successful passport mutation. We log the audit failure
    // locally so operations can spot it in server logs.
    void logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? authResult.session.user?.username ?? 'Unknown',
      action: before ? 'passport_admin_edit' : 'passport_admin_issue',
      targetDiscordId: discordId,
      before: before ? { passport: before } : null,
      after: { passport },
      metadata: { number: passport.number, faction: passport.faction, roleGranted },
      ip: getClientIp(request),
    }).catch(err => console.error('[admin passport PUT] audit log failed:', err));

    return NextResponse.json({ success: true, passport, roleGranted });
  } catch (error) {
    console.error('[admin passport PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const col = db.collection('profiles');

    const existingDoc = await col.findOne({ _id: discordId as any });
    const before = extractPassport(existingDoc);
    if (!before) {
      return NextResponse.json({ error: 'User does not have a passport' }, { status: 404 });
    }

    // Atomic dotted-path write — same rationale as the PUT handler:
    // the whole-`data`-replacement path would clobber sibling profile
    // fields (money stats, game records) on a race with the bot.
    await col.updateOne(
      { _id: discordId as any },
      { $set: { 'data.passport': null } }
    );

    // Revoke the Luna Passport Discord role so the 10% shop discount is removed
    // across both bots. Same failure semantics as the PUT path — profile write
    // is the source of truth, role revoke is a best-effort derived signal.
    const roleRevoked = await removeGuildMemberRole(
      discordId,
      PASSPORT_ROLE_ID,
      `Passport ${before.number} revoked by admin ${adminId}`
    );

    // Fire-and-forget audit logging — see PUT handler comment.
    void logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? authResult.session.user?.username ?? 'Unknown',
      action: 'passport_admin_revoke',
      targetDiscordId: discordId,
      before: { passport: before },
      after: { passport: null },
      metadata: { number: before.number, faction: before.faction, roleRevoked },
      ip: getClientIp(request),
    }).catch(err => console.error('[admin passport DELETE] audit log failed:', err));

    return NextResponse.json({ success: true, roleRevoked });
  } catch (error) {
    console.error('[admin passport DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
