// Approved V15 presentation bytes only; all live metadata and IDs remain in the official app.
import galleryMap from './people-gallery-map.json';
import nativePreviewStems from './people-native-previews.json';
import { revisedDragonArtwork } from './revised-dragon-art';
import { reviewedArtwork } from './reviewed-artwork';

const people = '/luna-cinematic/people';
const nativePreviews: Readonly<Record<string, string | undefined>> = nativePreviewStems;
export const WITCH_CRYSTAL = 'witch-crystal-13626979815a';
export const WITCH_DETAIL = people + '/gallery/LUNA-0240/' + WITCH_CRYSTAL + '.png';
const ancientDragonBase = people + '/gallery/LUNA-0019/ancient-dragon-rampart-a9e61c158dcb';
export const ANCIENT_DRAGON_PORTRAIT = {
  id: 'LUNA-0019',
  thumb: ancientDragonBase + '-thumb.webp',
  medium: ancientDragonBase + '-medium.webp',
  detail: ancientDragonBase + '.png',
} as const;
const verifiedPortraitRepairs: Readonly<Record<string, string>> = {
  'LUNA-0240': WITCH_CRYSTAL,
  'LUNA-0074': 'visual-qa',
  'LUNA-0130': 'visual-qa',
  'LUNA-0185': 'visual-qa',
  'LUNA-0102': 'grim-reaper-v18-d2e36ece222f',
  'LUNA-0212': 'talon-review-6f450b8c8233-1dd5f4a06ee1',
  'LUNA-0224': 'twins-fragments-v18-b407c5496b5d',
};
export const CHARACTER_TEXTURES: Readonly<Record<string, string>> = galleryMap;
export const PEOPLE_HERO = {
  characters: people + '/hero/LUNA-0802/medium.webp',
  members: people + '/hero/LUNA-0799/medium.webp',
  partners: people + '/hero/LUNA-0800/medium.webp',
} as const;

export function peopleHeroSources(medium: (typeof PEOPLE_HERO)[keyof typeof PEOPLE_HERO]) {
  const thumb = medium.replace('/medium.webp', '/thumb.webp');
  const detail = medium.replace('/medium.webp', '/detail.webp');
  return { thumb, detail, srcSet: thumb + ' 1280w, ' + medium + ' 1920w, ' + detail + ' 3840w' };
}

export function approvedPortraitFor(dbSource: string | null | undefined) {
  // Preserve exact slot identity and image revisions; no guessing by name or path fragments.
  if (!dbSource || !Object.prototype.hasOwnProperty.call(CHARACTER_TEXTURES, dbSource)) return null;
  const id = CHARACTER_TEXTURES[dbSource];
  if (id === ANCIENT_DRAGON_PORTRAIT.id) return ANCIENT_DRAGON_PORTRAIT;
  const dragon = reviewedArtwork(id) ?? revisedDragonArtwork(id);
  if (dragon) return dragon;
  const root = people + '/gallery/' + id + '/';
  const repair = verifiedPortraitRepairs[id];
  if (repair) return { id, thumb: root + repair + '-thumb.webp', medium: root + repair + '.png' };
  const nativePreview = nativePreviews[id];
  if (nativePreview) return { id, thumb: root + nativePreview + '-thumb.webp', medium: root + nativePreview + '-medium.webp' };
  return { id, thumb: root + 'thumb.webp', medium: root + 'medium.webp' };
}

export function wrapPeopleIndex(index: number, size: number) {
  return size > 0 ? (index % size + size) % size : 0;
}

export function partnerDirectoryAnchor(id: string) {
  // A stable DOM-safe ID without mutable display names or URL-derived selectors.
  return 'cinematic-partner-' + Array.from(id, ch => ch.codePointAt(0)!.toString(16)).join('-');
}

// Parse character name to extract subtitle (text in quotes)
// e.g., "Buddha Ban 'The Mastermind'" → { name: "Buddha Ban", subtitle: "The Mastermind" }
export function parseCharacterName(fullName: string): { name: string; subtitle: string | null } {
  // Match patterns like: Name 'Subtitle' or Name "Subtitle" or Name «Subtitle»
  const patterns = [
    /'([^']+)'/, // Single quotes
    /"([^"]+)"/, // Double quotes
    /«([^»]+)»/, // French guillemets
    /「([^」]+)」/, // Japanese quotes
  ];

  for (const pattern of patterns) {
    const match = fullName.match(pattern);
    if (match) {
      const subtitle = match[1].trim();
      const name = fullName.replace(match[0], '').trim();
      return { name, subtitle };
    }
  }

  return { name: fullName, subtitle: null };
}
