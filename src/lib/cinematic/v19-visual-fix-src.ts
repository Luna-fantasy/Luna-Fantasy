import { reviewedArtwork } from './reviewed-artwork';

type Role = 'card-inspector' | 'card-thumb' | 'story-cover';
const cards = new Set(['LUNA-0490', 'LUNA-0547', 'LUNA-0576', 'LUNA-0588',
  'LUNA-0594', 'LUNA-0612', 'LUNA-0618', 'LUNA-0658']);
export const STORY_COVER_BASE = '/luna-cinematic/home-story/story/champion-remastered.webp';

/** Empty by default; only the isolated staging runner injects this dev-only map. */
export function visualFixSrc(id: string | undefined | null, role: Role): string | undefined {
  if (role !== 'story-cover' && reviewedArtwork(id)) return;
  if (!id || (role === 'story-cover' ? id !== 'LUNA-0803' : !cards.has(id))
    || process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIXES !== '1') return;
  if (typeof window !== 'undefined' && !['127.0.0.1','localhost','[::1]'].includes(window.location.hostname)) return;
  try {
    const pins: unknown = JSON.parse(process.env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIX_PINS || '{}');
    const key = id + '/' + role;
    if (!pins || typeof pins !== 'object' || !Object.hasOwn(pins, key)) return;
    const sha = (pins as Record<string, unknown>)[key];
    if (typeof sha === 'string' && /^[a-f0-9]{64}$/.test(sha)) return '/api/cinematic/v19-visual-fix/' + key + '/' + sha;
  } catch { /* Keep the ordinary role if a private proof flag is misconfigured. */ }
}

export function storyCoverPresentationSrc(): string | undefined {
  return visualFixSrc('LUNA-0803', 'story-cover');
}
