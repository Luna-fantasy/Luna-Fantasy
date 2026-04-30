// Pure types + constants — no Mongo. Safe to import from client and server.

export type TabKey =
    | 'home'
    | 'profile'
    | 'games' | 'luna-fantasy' | 'grand-fantasy' | 'faction-war'
    | 'world' | 'story' | 'characters' | 'partners' | 'members'
    | 'economy' | 'bank' | 'bazaar' | 'trading' | 'marketplace';

export const TAB_KEYS: TabKey[] = [
    'home', 'profile',
    'games', 'luna-fantasy', 'grand-fantasy', 'faction-war',
    'world', 'story', 'characters', 'partners', 'members',
    'economy', 'bank', 'bazaar', 'trading', 'marketplace',
];

export interface TabState {
    closed: boolean;
    closedAt: Date | null;
    closedBy: string | null;
    closedByName: string | null;
    reason: string | null;
}

export type SiteTabsMap = Record<TabKey, TabState>;

export const TAB_GROUPS: Record<string, { label: string; keys: TabKey[]; parent?: TabKey }> = {
    top: { label: 'Top-level', keys: ['home', 'profile'] },
    games: { label: 'Luna Games', keys: ['games', 'luna-fantasy', 'grand-fantasy', 'faction-war'], parent: 'games' },
    world: { label: 'World', keys: ['world', 'story', 'characters', 'partners', 'members'], parent: 'world' },
    economy: { label: 'Economy', keys: ['economy', 'bank', 'bazaar', 'trading', 'marketplace'], parent: 'economy' },
};

export const TAB_LABELS: Record<TabKey, string> = {
    home: 'Home',
    profile: 'Profile',
    games: 'Luna Games (group)',
    'luna-fantasy': 'Luna Fantasy',
    'grand-fantasy': 'Grand Fantasy',
    'faction-war': 'Faction War',
    world: 'World (group)',
    story: 'Story',
    characters: 'Characters',
    partners: 'Partners',
    members: 'Members',
    economy: 'Economy (group)',
    bank: 'Bank',
    bazaar: 'Bazaar',
    trading: 'Trading',
    marketplace: 'Marketplace',
};

export const TAB_PATHS: Partial<Record<TabKey, string>> = {
    home: '/',
    profile: '/profile',
    'luna-fantasy': '/luna-fantasy',
    'grand-fantasy': '/grand-fantasy',
    'faction-war': '/faction-war',
    story: '/story',
    characters: '/characters',
    partners: '/partners',
    members: '/members',
    bank: '/bank',
    bazaar: '/bazaar',
    trading: '/trading',
    marketplace: '/marketplace',
};

export function defaultState(): TabState {
    return { closed: false, closedAt: null, closedBy: null, closedByName: null, reason: null };
}

export function defaultMap(): SiteTabsMap {
    const out = {} as SiteTabsMap;
    for (const k of TAB_KEYS) out[k] = defaultState();
    return out;
}
