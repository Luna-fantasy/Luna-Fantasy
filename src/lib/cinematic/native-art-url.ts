import availableData from './native-art-available.json';
import reviewedData from './native-art-v19-reviewed.json';

export type VerifiedNativeArtwork = {
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  mime: string;
};
const available: Readonly<Record<string, VerifiedNativeArtwork>> = availableData;
const reviewed: Readonly<Record<string, VerifiedNativeArtwork>> = reviewedData;
const allowedType = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function knownNativeArtwork(id: string | null | undefined): VerifiedNativeArtwork | undefined {
  if (!id || !/^LUNA-\d{4}$/.test(id)) return;
  const row = available[id] ?? (process.env.NEXT_PUBLIC_LUNA_ART_RELEASE === 'v19' ? reviewed[id] : undefined);
  if (!row) return;
  if (!/^[0-9a-f]{64}$/.test(row.sha256) || !allowedType.has(row.mime)
    || !Number.isSafeInteger(row.bytes) || row.bytes <= 0
    || !Number.isSafeInteger(row.width) || row.width <= 0
    || !Number.isSafeInteger(row.height) || row.height <= 0) return;
  return row;
}

/** Call only for an already-open detail view with a proven release ID. */
export function nativeArtworkViewerSrc(id: string | null | undefined): string | undefined {
  const row = knownNativeArtwork(id);
  return row ? '/api/cinematic/native-art/' + id + '/' + row.sha256 : undefined;
}
