export type NavigationGroup = 'games' | 'world' | 'economy';
export type DesktopDisclosure = { group: NavigationGroup; pinned: boolean } | null;

type NavigationLink = { tab: string; label: string; path: string };
type NavigationSection = { key: NavigationGroup; links: NavigationLink[] };

const sections: NavigationSection[] = [
  { key: 'games', links: [
    { tab: 'luna-fantasy', label: 'lunaFantasy', path: '/luna-fantasy' },
    { tab: 'grand-fantasy', label: 'grandFantasy', path: '/grand-fantasy' },
    { tab: 'faction-war', label: 'factionWar', path: '/faction-war' },
  ] },
  { key: 'world', links: [
    { tab: 'story', label: 'story', path: '/story' },
    { tab: 'characters', label: 'characters', path: '/characters' },
    { tab: 'partners', label: 'partners', path: '/partners' },
    { tab: 'members', label: 'members', path: '/members' },
  ] },
  { key: 'economy', links: [
    { tab: 'bank', label: 'bank', path: '/bank' },
    { tab: 'bazaar', label: 'bazaar', path: '/bazaar' },
    { tab: 'trading', label: 'trading', path: '/trading' },
    { tab: 'marketplace', label: 'marketplace', path: '/marketplace' },
  ] },
];

export function publicNavigationGroups(closed: ReadonlySet<string>, isMastermind: boolean, marketplace: boolean) {
  const visible = (key: string) => isMastermind || !closed.has(key);
  return sections.filter(section => visible(section.key)).map(section => ({
    key: section.key,
    links: section.links.filter(link => visible(link.tab) && (marketplace || link.tab !== 'marketplace')),
  })).filter(section => section.links.length > 0);
}

export function toggleDesktopGroup(current: DesktopDisclosure, group: NavigationGroup): DesktopDisclosure {
  return current?.group === group && current.pinned ? null : { group, pinned: true };
}

export function localeNavigationHref(pathname: string, search: string, hash: string) {
  return pathname + search + hash;
}

export function guestSignInHref(locale: string, returnPath: string) {
  const gate = '/' + locale + '/auth/signin';
  if (returnPath.split(/[?#]/, 1)[0].replace(/\/$/, '') === gate) return returnPath;
  return gate + '?' + new URLSearchParams({ callbackUrl: returnPath });
}
