import { ANCIENT_DRAGON_PORTRAIT, WITCH_DETAIL } from './people-art';
import { revisedFantasyFace } from './revised-fantasy-face';
import { revisedDragonArtwork } from './revised-dragon-art';
import { nativeArtworkViewerSrc } from './native-art-url';
import { reviewedArtwork } from './reviewed-artwork';

/** Used only when an inspector opens; never put originals on gallery thumbnails. */
export function inspectorArtworkViewerSrc(id: string | null | undefined): string | undefined {
  if (id === ANCIENT_DRAGON_PORTRAIT.id) return ANCIENT_DRAGON_PORTRAIT.detail;
  if (id === 'LUNA-0240') return WITCH_DETAIL;
  const revision = reviewedArtwork(id) ?? revisedFantasyFace(id) ?? revisedDragonArtwork(id);
  if (revision) return revision.detail;
  const exact = nativeArtworkViewerSrc(id);
  if (exact) return exact;
  if (!id || !/^LUNA-\d{4}$/.test(id) || process.env.NODE_ENV !== 'development'
    || process.env.NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTORS !== '1') return;
  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;

  try {
    // Injected only by the private local runner after it validates the pinned
    // manifest. The chosen image still goes through the server-side pin check.
    const pins = JSON.parse(process.env.NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTOR_SHA256S || '{}');
    if (!pins || typeof pins !== 'object' || Array.isArray(pins) || !Object.hasOwn(pins, id)) return;
    const digest = pins[id];
    if (typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest)) {
      return '/api/cinematic/reviewed-reconstruction/' + id + '/' + digest;
    }
  } catch { /* A malformed opt-in falls back to the existing derivative. */ }
}
