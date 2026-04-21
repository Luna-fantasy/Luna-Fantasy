import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface SearchHit {
  kind: 'user' | 'passport' | 'action' | 'audit';
  id: string;
  label: string;
  sub?: string;
  href: string;
  icon?: string;
}

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const { session } = authResult;
  const adminId = session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { searchParams } = request.nextUrl;
  const q = (searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 1) return NextResponse.json({ hits: [] });

  const client = await clientPromise;
  const db = client.db('Database');
  const rx = new RegExp(escapeRegex(q), 'i');
  const numeric = /^[0-9]{5,}$/.test(q);

  const [users, passports, audits] = await Promise.all([
    // User hits — search by username, globalName, or exact ID
    db.collection('discord_users')
      .find(numeric
        ? { _id: q as any }
        : { $or: [{ username: rx }, { globalName: rx }] })
      .project({ _id: 1, username: 1, globalName: 1, avatar: 1 })
      .limit(8).toArray(),
    // Passport hits — number match
    db.collection('profiles')
      .find({ $or: [
        { 'data.passport.number': rx },
        { 'data.passport.fullName': rx },
        { 'passport.number': rx },
      ] })
      .project({ _id: 1, 'data.passport': 1, passport: 1 })
      .limit(5).toArray(),
    // Audit log hits — action or reason
    db.collection('admin_audit_log')
      .find({ $or: [{ action: rx }, { 'metadata.reason': rx }, { adminUsername: rx }] })
      .project({ action: 1, adminUsername: 1, targetDiscordId: 1, 'metadata.reason': 1, timestamp: 1 })
      .sort({ timestamp: -1 })
      .limit(6).toArray(),
  ]);

  const hits: SearchHit[] = [];

  for (const u of users) {
    const id = String((u as any)._id);
    const label = (u as any).globalName ?? (u as any).username ?? id;
    hits.push({
      kind: 'user',
      id,
      label,
      sub: id,
      href: `/admin/users/${id}`,
      icon: '◇',
    });
  }

  for (const p of passports) {
    const passport = (p as any)?.data?.passport ?? (p as any)?.passport;
    if (!passport) continue;
    const id = String((p as any)._id);
    hits.push({
      kind: 'passport',
      id: `passport:${id}`,
      label: passport.fullName || passport.number || 'Passport',
      sub: `${passport.number ?? ''} — ${passport.faction ?? ''}`.trim().replace(/^—\s*|\s*—$/g, ''),
      href: `/admin/users/${id}`,
      icon: '❂',
    });
  }

  for (const a of audits) {
    const id = String((a as any)._id);
    hits.push({
      kind: 'audit',
      id: `audit:${id}`,
      label: (a as any).action,
      sub: `by ${(a as any).adminUsername ?? '—'}${(a as any).metadata?.reason ? ' · ' + (a as any).metadata.reason : ''}`,
      href: `/admin/audit?q=${encodeURIComponent((a as any).action)}`,
      icon: '✎',
    });
  }

  return NextResponse.json({ hits });
}
