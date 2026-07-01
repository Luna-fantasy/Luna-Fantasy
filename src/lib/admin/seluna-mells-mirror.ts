import type { Db } from 'mongodb';

// Seluna background items mirror into vendor_config.mells_selvair as locked
// rows so that:
//   1) Resolution durability — even if the Seluna source is archived, the
//      Mells mirror keeps the metadata available for the bot's lookups.
//   2) Re-add safety — a Seluna ID always has a permanent Mells mirror, so
//      reusing the same id would collide and is prevented at the editor.
//
// Mirror items are non-editable from the Mells UI and never sellable through
// Mells. The Mells PUT route enforces the "do not strip mirrors" rule on the
// server side; this helper handles the upsert side from the Seluna writes.

export interface SelunaMirrorSourceItem {
    id: string;
    type: 'card' | 'stone' | 'role' | 'tickets' | 'background';
    name: string;
    price: number;
    description?: string;
    backgroundType?: 'profile' | 'rank' | 'both';
    backgroundUrl?: string;
    rankBackgroundUrl?: string;
    archived?: boolean;
}

export interface MellsMirrorItem {
    id: string;
    name: string;
    price: number;
    description?: string;
    type: 'profile' | 'rank';
    imageUrl?: string;
    backgroundUrl?: string;
    rankBackgroundUrl?: string;
    seluna_locked: true;
    seluna_origin_id: string;
    seluna_archived?: boolean;
    seluna_background_type?: 'profile' | 'rank' | 'both';
}

export function mirrorIdFor(selunaId: string): string {
    return `mells_${selunaId}`;
}

export function buildMellsMirrorItem(src: SelunaMirrorSourceItem): MellsMirrorItem | null {
    if (src.type !== 'background') return null;
    const bgType: 'profile' | 'rank' | 'both' = src.backgroundType || 'profile';
    const profileUrl = src.backgroundUrl?.trim() || undefined;
    const rankUrl = src.rankBackgroundUrl?.trim() || undefined;
    if (!profileUrl && !rankUrl) return null;

    // Mells UI grid filters by item.type ('profile' vs 'rank'). 'both' goes
    // into the profile bucket so it appears in the default Mells filter view —
    // the seluna_locked flag is the authoritative gate for sale eligibility.
    const surfaceType: 'profile' | 'rank' = bgType === 'rank' ? 'rank' : 'profile';

    return {
        id: mirrorIdFor(src.id),
        name: src.name,
        price: src.price,
        description: src.description,
        type: surfaceType,
        imageUrl: profileUrl ?? rankUrl,
        backgroundUrl: profileUrl,
        rankBackgroundUrl: rankUrl,
        seluna_locked: true,
        seluna_origin_id: src.id,
        seluna_archived: src.archived === true ? true : undefined,
        seluna_background_type: bgType,
    };
}

// Reconcile Seluna's full inventory_items list into Mells's items[] without
// ever removing existing mirrors. Active sources upsert metadata, archived
// sources flip seluna_archived: true, sources that disappear from Seluna
// entirely are left alone (mirror lives forever).
export async function reconcileSelunaMirrors(db: Db, selunaItems: SelunaMirrorSourceItem[]): Promise<{ added: number; updated: number; preservedOrphans: number }> {
    const col = db.collection('vendor_config');
    const mellsDoc = await col.findOne({ _id: 'mells_selvair' as any });
    const data = (mellsDoc?.data && typeof mellsDoc.data === 'object') ? { ...mellsDoc.data } : {};
    const items: any[] = Array.isArray(data.items) ? [...data.items] : [];

    let added = 0;
    let updated = 0;
    const seenMirrorIds = new Set<string>();

    for (const src of selunaItems) {
        if (src.type !== 'background') continue;
        const mirror = buildMellsMirrorItem(src);
        if (!mirror) continue;
        seenMirrorIds.add(mirror.id);

        const existingIdx = items.findIndex((it) => it && it.id === mirror.id);
        if (existingIdx === -1) {
            items.push(mirror);
            added++;
        } else {
            // Preserve any unrelated fields that may have crept onto the mirror
            // (e.g. roleId), but always reassert seluna_locked/origin/type so
            // they cannot be bypassed by direct edits to vendor_config.
            const merged = {
                ...items[existingIdx],
                ...mirror,
                seluna_locked: true as const,
                seluna_origin_id: src.id,
            };
            // strip undefined keys so $set doesn't write nulls
            for (const k of Object.keys(merged)) {
                if (merged[k] === undefined) delete merged[k];
            }
            items[existingIdx] = merged;
            updated++;
        }
    }

    // Orphan mirrors (Seluna source removed entirely) — leave them in place,
    // just note the count for telemetry.
    const preservedOrphans = items.filter((it) => it && it.seluna_locked && !seenMirrorIds.has(it.id)).length;

    // Surgical dot-path update: only touch data.items, not the whole `data`.
    // A blanket `$set: { data }` would race with the admin vendor PUT
    // (src/app/api/admin/vendors/route.ts) — that endpoint reads `data`,
    // mutates it, and writes it back. If the admin saved a new title/image
    // between our findOne above and this updateOne, replacing the entire
    // data object would silently discard their write.
    await col.updateOne(
        { _id: 'mells_selvair' as any },
        { $set: { 'data.items': items } },
        { upsert: true },
    );

    return { added, updated, preservedOrphans };
}

// Used by the vendor PUT endpoint to defensively re-attach any mirrors that
// the incoming payload may have stripped. Frontend ought to leave them in
// place, but this is the belt-and-suspenders enforcement on the server.
export function preserveMirrorsInPayload(currentItems: any[], incomingItems: any[]): any[] {
    if (!Array.isArray(currentItems)) return incomingItems;
    if (!Array.isArray(incomingItems)) return incomingItems;
    const result = [...incomingItems];
    const incomingIds = new Set(result.map((it) => it?.id));
    for (const cur of currentItems) {
        if (cur && cur.seluna_locked && !incomingIds.has(cur.id)) {
            result.push(cur);
        }
    }
    return result;
}
