import approved from './archive-card-search-approved.json';

type Route = 'luna-fantasy' | 'grand-fantasy' | 'faction-war';
type Locale = 'ar' | 'en';
type AliasIndex = Readonly<Record<string, Partial<Record<Locale, readonly string[]>>>>;
const grandIds = new Set(approved.grandIds);
const fantasy: AliasIndex = approved.fantasy;
const faction: AliasIndex = approved.faction;

function normalize(value: string) {
  return value.normalize('NFKD').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').trim();
}

export function archiveLabelMatcher(query: string) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return () => true;
  return (...labels: Array<string | undefined>) => {
    const haystack = normalize(labels.join(' '));
    return tokens.every(token => haystack.includes(token));
  };
}

/** Labels are visible catalog names; search-only aliases must have a proven release identity. */
export function archiveCardMatcher(route: Route, locale: Locale, query: string) {
  const matches = archiveLabelMatcher(query);
  if (!query.trim()) return () => true;
  const index = route === 'faction-war' ? faction : fantasy;
  return (id: string | undefined, ...labels: Array<string | undefined>) => {
    if (!id || !Object.hasOwn(index, id) || (route === 'grand-fantasy' && !grandIds.has(id))) {
      return matches(...labels);
    }
    const names = index[id];
    if (route === 'faction-war') return matches(...labels, id, ...(names.en ?? []), ...(names.ar ?? []));
    return matches(...labels, id, ...(names[locale] ?? []));
  };
}
