import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { assertNoWipe } from '@/lib/admin/wipe-guard';

const DB_NAME = 'Database';
const COLLECTION = 'characters';

interface CharacterDoc {
    _id?: any;
    id: string;
    name: { en: string; ar: string };
    lore?: { en: string; ar: string };
    faction: string;
    imageUrl: string;
    isMainCharacter?: boolean;
    cardId?: string;
}

function validateChar(body: any): CharacterDoc | { error: string } {
    if (!body || typeof body !== 'object') return { error: 'Invalid body' };
    const id = String(body.id ?? '').trim();
    const faction = String(body.faction ?? '').trim();
    const imageUrl = String(body.imageUrl ?? '').trim();
    const nameEn = String(body.name?.en ?? '').trim();
    const nameAr = String(body.name?.ar ?? '').trim();
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) return { error: 'id must be alphanumeric (a-z, 0-9, _-)' };
    if (!faction) return { error: 'faction is required' };
    if (!nameEn) return { error: 'name.en is required' };
    if (!imageUrl) return { error: 'imageUrl is required' };

    const doc: CharacterDoc = {
        id, faction, imageUrl,
        name: { en: nameEn.slice(0, 200), ar: nameAr.slice(0, 200) },
    };
    const loreEn = body.lore?.en ? String(body.lore.en).slice(0, 4000) : '';
    const loreAr = body.lore?.ar ? String(body.lore.ar).slice(0, 4000) : '';
    if (loreEn || loreAr) doc.lore = { en: loreEn, ar: loreAr };
    if (typeof body.isMainCharacter === 'boolean') doc.isMainCharacter = body.isMainCharacter;
    if (body.cardId) doc.cardId = String(body.cardId).slice(0, 80);
    return doc;
}

export async function GET() {
    const authResult = await requireMastermindApi();
    if (!authResult.authorized) return authResult.response;

    const adminId = authResult.session.user?.discordId ?? '';
    const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const client = await clientPromise;
    const docs = await client.db(DB_NAME).collection(COLLECTION).find({}).toArray();
    const characters = docs.map((d: any) => ({
        _id: d._id?.toString?.() ?? null,
        id: d.id,
        name: d.name ?? { en: '', ar: '' },
        lore: d.lore ?? null,
        faction: d.faction ?? '',
        imageUrl: d.imageUrl ?? '',
        isMainCharacter: !!d.isMainCharacter,
        cardId: d.cardId ?? null,
    }));
    return NextResponse.json({ characters });
}

export async function POST(request: NextRequest) {
    const authResult = await requireMastermindApi();
    if (!authResult.authorized) return authResult.response;

    const csrfValid = await validateCsrf(request);
    if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

    const adminId = authResult.session.user?.discordId ?? '';
    const adminName = authResult.session.user?.globalName ?? 'Mastermind';
    const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 30, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const validated = validateChar(body);
    if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

    const client = await clientPromise;
    const col = client.db(DB_NAME).collection(COLLECTION);
    const existing = await col.findOne({ id: validated.id });
    if (existing) return NextResponse.json({ error: `Character with id "${validated.id}" already exists` }, { status: 409 });

    const result = await col.insertOne(validated as any);
    await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: adminName,
        action: 'character_create',
        before: null,
        after: validated,
        metadata: { id: validated.id },
        ip: getClientIp(request),
    });
    return NextResponse.json({ _id: result.insertedId.toString(), ...validated });
}

export async function PATCH(request: NextRequest) {
    const authResult = await requireMastermindApi();
    if (!authResult.authorized) return authResult.response;

    const csrfValid = await validateCsrf(request);
    if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

    const adminId = authResult.session.user?.discordId ?? '';
    const adminName = authResult.session.user?.globalName ?? 'Mastermind';
    const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 60, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const validated = validateChar(body);
    if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

    const client = await clientPromise;
    const col = client.db(DB_NAME).collection(COLLECTION);
    const existing = await col.findOne({ id: validated.id });
    if (!existing) return NextResponse.json({ error: `No character with id "${validated.id}"` }, { status: 404 });

    await col.updateOne({ id: validated.id }, { $set: validated as any });
    await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: adminName,
        action: 'character_update',
        before: { id: existing.id, name: existing.name, faction: existing.faction, imageUrl: existing.imageUrl },
        after: validated,
        metadata: { id: validated.id },
        ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, ...validated });
}

export async function DELETE(request: NextRequest) {
    const authResult = await requireMastermindApi();
    if (!authResult.authorized) return authResult.response;

    const csrfValid = await validateCsrf(request);
    if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

    const adminId = authResult.session.user?.discordId ?? '';
    const adminName = authResult.session.user?.globalName ?? 'Mastermind';
    const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 30, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

    const client = await clientPromise;
    const col = client.db(DB_NAME).collection(COLLECTION);
    const existing = await col.findOne({ id });
    if (!existing) return NextResponse.json({ error: `No character with id "${id}"` }, { status: 404 });

    // Defensive wipe guard. Characters use one-doc-at-a-time semantics, so a
    // single DELETE never shrinks the collection by ≥50%. But if anyone ever
    // adds a bulk-delete endpoint or someone scripts mass deletes, this will
    // refuse a runaway. (No mass-delete is supported today — this is purely
    // belt-and-suspenders following the cards-config wipe incident.)
    const totalBefore = await col.countDocuments({});
    const guardResult = assertNoWipe(totalBefore, totalBefore - 1, {
        label: 'characters',
        // 1 deletion at a time is allowed even when the collection is small.
        // The guard only fires if `removed >= ceil(total/2)`, which a single
        // delete only triggers when total ≤ 2 — at which point asking for
        // confirmation is reasonable, but DELETE has no confirmShrink param,
        // so we just let it through with a high threshold.
        shrinkThreshold: 0.99,
        minSize: 4,
    });
    if (!guardResult.ok && guardResult.error) {
        return NextResponse.json(
            { error: guardResult.error.message, before: guardResult.error.before, after: guardResult.error.after },
            { status: 409 },
        );
    }

    await col.deleteOne({ id });
    await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: adminName,
        action: 'character_delete',
        before: { id: existing.id, name: existing.name, faction: existing.faction },
        after: null,
        metadata: { id },
        ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, id });
}
