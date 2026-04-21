import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const DB_NAME = 'Database';
const DOC_ID = 'tickets';

interface TicketPackage {
  id: string;
  amount: number;
  price: number;
  imageUrl?: string;
  description?: string;
}

function sanitizeId(v: string): string {
  return v.replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
}

function validatePackages(pkgs: unknown): string | null {
  if (!Array.isArray(pkgs)) return 'packages must be an array';
  if (pkgs.length > 30) return 'too many packages (max 30)';
  const seen = new Set<string>();
  for (let i = 0; i < pkgs.length; i++) {
    const p: any = pkgs[i];
    if (!p || typeof p !== 'object') return `packages[${i}] must be an object`;
    if (typeof p.id !== 'string' || !p.id) return `packages[${i}].id required`;
    if (seen.has(p.id)) return `duplicate package id: ${p.id}`;
    seen.add(p.id);
    if (typeof p.amount !== 'number' || !Number.isInteger(p.amount) || p.amount < 1 || p.amount > 1_000_000) {
      return `packages[${i}].amount must be 1-1,000,000`;
    }
    if (typeof p.price !== 'number' || !Number.isInteger(p.price) || p.price < 1 || p.price > 10_000_000) {
      return `packages[${i}].price must be 1-10,000,000 Lunari`;
    }
    if (p.imageUrl !== undefined && typeof p.imageUrl !== 'string') return `packages[${i}].imageUrl must be a string`;
    if (p.description !== undefined && typeof p.description !== 'string') return `packages[${i}].description must be a string`;
  }
  return null;
}

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('vendor_config');
    const doc = await col.findOne({ _id: DOC_ID as any });
    const packages: TicketPackage[] = Array.isArray(doc?.data?.packages) ? doc!.data.packages : [];
    return NextResponse.json({
      packages,
      image: (doc?.data?.image as string) ?? null,
      updatedAt: doc?.updatedAt ?? null,
      updatedBy: doc?.updatedBy ?? null,
    });
  } catch (err) {
    console.error('Zoldar admin GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: { packages?: TicketPackage[]; image?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { packages, image } = body;
  if (!packages) return NextResponse.json({ error: 'packages required' }, { status: 400 });

  const cleaned = packages.map((p) => ({
    id: sanitizeId(String(p.id ?? '')),
    amount: Math.floor(Number(p.amount ?? 0)),
    price: Math.floor(Number(p.price ?? 0)),
    imageUrl: typeof p.imageUrl === 'string' ? p.imageUrl.slice(0, 500) : undefined,
    description: typeof p.description === 'string' ? p.description.slice(0, 300) : undefined,
  }));

  const err = validatePackages(cleaned);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('vendor_config');
    const before = await col.findOne({ _id: DOC_ID as any });
    const beforeData = before?.data ?? {};
    const nextData = {
      ...beforeData,
      packages: cleaned,
      ...(typeof image === 'string' ? { image: image.slice(0, 500) } : {}),
    };

    await col.updateOne(
      { _id: DOC_ID as any },
      { $set: { data: nextData, updatedAt: new Date(), updatedBy: adminId } },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? 'Unknown',
      action: 'zoldar_packages_update',
      before: { packages: beforeData.packages ?? [] },
      after: { packages: cleaned },
      metadata: { count: cleaned.length },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Zoldar admin POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
