import index from './release-card-index.json';
import { reviewedArtwork } from './reviewed-artwork';
import { projectLunaCardArtwork } from '../release-card-art';

type Print = { thumb: string; detail: string };
const prints = new Map<string, Print>();
const historicalPaths = new Map<string, Print | null>();
for (const [source, name, rarity, id] of index.fantasy) {
  const art = projectLunaCardArtwork({ name: { en: name }, rarity, imageUrl: source }, true);
  if (!art) continue;
  const print = { thumb: art.thumb, detail: reviewedArtwork(id)?.detail ?? art.detail };
  prints.set(source, print);
  const path = source.replace(/\?v=\d+$/, '');
  historicalPaths.set(path, historicalPaths.has(path) ? null : print);
}

/** Inventories and trades store the original CDN URL as the card identity. */
export function collectibleDisplayImage(source: string, size: 'thumb' | 'detail' = 'detail') {
  if (!source) return source;
  const key = source.replace(/ /g, '%20');
  const print = prints.get(key) ?? historicalPaths.get(key.replace(/\?v=\d+$/, ''));
  return print?.[size] ?? '';
}
