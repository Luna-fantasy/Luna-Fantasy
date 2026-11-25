import revisions from './reviewed-artwork.json';
import { kaidanForRelease } from './kaidan-art';

type ReviewedFace = Readonly<{ thumb: string; medium: string; detail: string }>;
const images: Readonly<Record<string, ReviewedFace | undefined>> = revisions;

/** Called after a record has been matched to its original release identity. */
export function reviewedArtwork(id: string | null | undefined) {
  const kaidan = kaidanForRelease(id);
  if (kaidan) return kaidan;
  if (!id || !Object.hasOwn(images, id)) return;
  const face = images[id];
  if (face) return { id, ...face };
}
