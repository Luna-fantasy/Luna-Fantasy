// GET /api/admin/passports/list
// Returns every user that currently holds a Luna Passport, joined with
// basic display info (username, globalName, avatar). Used by the admin
// passport page to render the "Issued Passports" table.

import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

interface PassportRow {
  discordId: string;
  username: string | null;
  globalName: string | null;
  avatar: string | null;
  passport: {
    number: string;
    faction: string;
    fullName: string;
    dateOfBirth: string;
    issuedAt: number;
    issuedBy: string;
  };
}

export async function GET(_request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('Database');

    // Profiles with a non-null passport. Butler stores profile fields under
    // either `data.passport` (st.db wrapper format) or top-level `passport`.
    const profileDocs = await db.collection('profiles').find(
      {
        $or: [
          { 'data.passport': { $type: 'object' } },
          { passport: { $type: 'object' } },
        ],
      },
      { limit: 200 }
    ).toArray();

    // Normalize the passport object location + collect discordIds for the user-metadata join
    const normalized: { discordId: string; passport: any }[] = [];
    for (const doc of profileDocs) {
      const rawData = doc.data && typeof doc.data === 'object'
        ? doc.data
        : (typeof doc.data === 'string' ? (() => { try { return JSON.parse(doc.data); } catch { return null; } })() : doc);
      const passport = rawData?.passport ?? null;
      if (passport && typeof passport === 'object' && passport.number) {
        normalized.push({ discordId: String(doc._id), passport });
      }
    }

    // Sort newest-issued first
    normalized.sort((a, b) => (b.passport.issuedAt ?? 0) - (a.passport.issuedAt ?? 0));

    const discordIds = normalized.map(n => n.discordId);

    // Join with website users + discord_users cache for display names + avatars
    const [websiteUsers, discordUsers] = await Promise.all([
      db.collection('users').find({ discordId: { $in: discordIds } }).toArray(),
      db.collection('discord_users').find({ _id: { $in: discordIds as any[] } }).toArray(),
    ]);

    const nameMap = new Map<string, { username: string | null; globalName: string | null; avatar: string | null }>();
    for (const u of websiteUsers) {
      nameMap.set(String(u.discordId), {
        username: u.username ?? u.name ?? null,
        globalName: u.globalName ?? null,
        avatar: u.image ?? null,
      });
    }
    // Discord cache fills gaps (users who never logged into the website).
    // avatar is stored as a hash — construct full CDN URL.
    for (const u of discordUsers) {
      const id = String(u._id);
      const existing = nameMap.get(id);
      const avatarUrl = u.avatar
        ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=64`
        : null;
      if (!existing) {
        nameMap.set(id, {
          username: u.username ?? null,
          globalName: u.globalName ?? null,
          avatar: avatarUrl,
        });
      } else if (!existing.avatar && avatarUrl) {
        existing.avatar = avatarUrl;
      }
    }

    const passports: PassportRow[] = normalized.map(n => {
      const meta = nameMap.get(n.discordId);
      return {
        discordId: n.discordId,
        username: meta?.username ?? null,
        globalName: meta?.globalName ?? null,
        avatar: meta?.avatar ?? null,
        passport: {
          number: n.passport.number ?? '',
          faction: n.passport.faction ?? '',
          fullName: n.passport.fullName ?? '',
          dateOfBirth: n.passport.dateOfBirth ?? '',
          issuedAt: n.passport.issuedAt ?? 0,
          issuedBy: n.passport.issuedBy ?? '',
        },
      };
    });

    return NextResponse.json({ passports });
  } catch (error) {
    console.error('[admin/passports/list GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
