import 'server-only';
import clientPromise from '@/lib/mongodb';
import {
    TAB_KEYS,
    defaultMap,
    type SiteTabsMap,
    type TabKey,
    type TabState,
} from './site-tabs-shared';

export {
    TAB_KEYS,
    TAB_GROUPS,
    TAB_LABELS,
    TAB_PATHS,
    defaultState,
    defaultMap,
} from './site-tabs-shared';

export type { TabKey, TabState, SiteTabsMap } from './site-tabs-shared';

const DB_NAME = 'Database';
const COLLECTION = 'bot_config';
const DOC_ID = 'site_features';
const CACHE_TTL_MS = 30_000;

let cache: { data: SiteTabsMap; expiresAt: number } | null = null;

export async function getSiteTabs(): Promise<SiteTabsMap> {
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    try {
        const client = await clientPromise;
        const col = client.db(DB_NAME).collection(COLLECTION);
        const doc = await col.findOne({ _id: DOC_ID as any });
        const stored = ((doc as any)?.data?.tabs ?? {}) as Partial<Record<TabKey, Partial<TabState>>>;
        const merged = defaultMap();
        for (const k of TAB_KEYS) {
            const s = stored[k];
            if (s) {
                merged[k] = {
                    closed: !!s.closed,
                    closedAt: s.closedAt ? new Date(s.closedAt as any) : null,
                    closedBy: s.closedBy ?? null,
                    closedByName: s.closedByName ?? null,
                    reason: s.reason ?? null,
                };
            }
        }
        cache = { data: merged, expiresAt: Date.now() + CACHE_TTL_MS };
        return merged;
    } catch (err: any) {
        console.error('[SITE-TABS] read failed:', err.message);
        return defaultMap();
    }
}

export async function isTabClosed(key: TabKey): Promise<boolean> {
    const tabs = await getSiteTabs();
    return tabs[key]?.closed ?? false;
}

export async function setTabState(
    key: TabKey,
    closed: boolean,
    modId: string,
    modName: string,
    reason: string | null,
): Promise<TabState> {
    if (!TAB_KEYS.includes(key)) throw new Error(`Unknown tab key: ${key}`);

    const client = await clientPromise;
    const col = client.db(DB_NAME).collection(COLLECTION);
    const existing = await col.findOne({ _id: DOC_ID as any });
    const data: any = (existing as any)?.data ?? {};
    const tabs: any = data.tabs ?? {};

    const newState: TabState = closed
        ? {
            closed: true,
            closedAt: new Date(),
            closedBy: modId,
            closedByName: modName,
            reason: reason?.slice(0, 500) ?? null,
        }
        : { closed: false, closedAt: null, closedBy: null, closedByName: null, reason: null };

    tabs[key] = newState;
    data.tabs = tabs;

    await col.updateOne(
        { _id: DOC_ID as any },
        { $set: { data, updatedAt: new Date(), updatedBy: modId } },
        { upsert: true },
    );
    invalidateCache();
    return newState;
}

export function invalidateCache(): void {
    cache = null;
}

export function getClosedKeysSync(map: SiteTabsMap): TabKey[] {
    return TAB_KEYS.filter(k => map[k]?.closed);
}
