import { knownNativeArtwork } from '@/lib/cinematic/native-art-url';
import { type HistoricalArtworkExpectation, readExactSource } from '@/lib/cinematic/native-art-exact.cjs';
import expectedData from '@/lib/cinematic/native-art-expected.json';
import reviewedData from '@/lib/cinematic/native-art-v19-reviewed.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const expected: Readonly<Record<string, HistoricalArtworkExpectation>> = expectedData;

function unavailable() {
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(_request: Request, { params }: { params: { id: string; digest: string } }) {
  const row = knownNativeArtwork(params.id);
  const historical = expected[params.id];
  const replacement = process.env.NEXT_PUBLIC_LUNA_ART_RELEASE === 'v19'
    ? reviewedData[params.id as keyof typeof reviewedData] : undefined;
  const locked = historical && replacement?.historicalSha256 === historical.sha256
    ? { ...historical, ...replacement } : historical;
  // Reject unknown or replacement digests before opening any file.
  if (!row || !locked || params.digest !== row.sha256 || locked.sha256 !== row.sha256) return unavailable();
  try {
    const image = readExactSource(process.env.LUNA_NATIVE_ART_ROOT, params.id, locked, row);
    return new Response(new Uint8Array(image), { headers: {
      'Content-Type': row.mime,
      'Content-Length': String(row.bytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': '"' + row.sha256 + '"',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return unavailable();
  }
}
