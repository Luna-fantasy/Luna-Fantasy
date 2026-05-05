import type { Db } from 'mongodb';

// Translate vendor_config.mells_selvair items (typed schema) → butler_shop
// items (legacy schema) and write to bot_config.butler_shop.
//
// Per-item translation:
//   { imageUrl: X, type: 'profile' } → { backgroundUrl: X }
//   { imageUrl: X, type: 'rank' }    → { rankBackgroundUrl: X }
//   seluna_locked mirror             → carry both URL fields directly
//   no imageUrl                      → passed through (role-only items, etc.)
//
// Top-level fields (title/description/image) are forwarded verbatim. Anything
// not on the known list is preserved by spreading the source item, so legacy
// fields like `roleId`, `exclusive`, etc. survive the round trip.
export async function mirrorMellsToButler(db: Db, vendorData: any): Promise<void> {
    if (!vendorData || typeof vendorData !== 'object') return;
    const items = Array.isArray(vendorData.items) ? vendorData.items : [];
    const butlerItems = items.map((it: any) => {
        const base: Record<string, unknown> = {
            id: it.id,
            name: it.name,
            description: it.description ?? '',
            price: it.price,
            roleId: it.roleId ?? '',
        };
        if (it.exclusive) base.exclusive = it.exclusive;
        if (it.seluna_locked) {
            if (it.backgroundUrl) base.backgroundUrl = it.backgroundUrl;
            if (it.rankBackgroundUrl) base.rankBackgroundUrl = it.rankBackgroundUrl;
            base.seluna_locked = true;
            if (it.seluna_origin_id) base.seluna_origin_id = it.seluna_origin_id;
            if (it.seluna_archived) base.seluna_archived = true;
        } else if (it.imageUrl) {
            if (it.type === 'rank') base.rankBackgroundUrl = it.imageUrl;
            else base.backgroundUrl = it.imageUrl;
        } else {
            if (it.backgroundUrl) base.backgroundUrl = it.backgroundUrl;
            if (it.rankBackgroundUrl) base.rankBackgroundUrl = it.rankBackgroundUrl;
        }
        return base;
    });

    await db.collection('bot_config').updateOne(
        { _id: 'butler_shop' as any },
        {
            $set: {
                'data.items': butlerItems,
                'data.title': vendorData.title ?? "Mells Selvair's Gallery",
                'data.description': vendorData.description ?? '',
                'data.image': vendorData.image ?? '',
                'data.updatedAt': new Date(),
            },
        },
        { upsert: true },
    );
}
