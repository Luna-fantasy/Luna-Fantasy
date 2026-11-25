import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { readPinnedReviewManifest, reconstructionPreviewEnabled, reviewedDevelopmentArtwork } from '@/lib/cinematic/reviewed-reconstruction-dev';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unavailable() {
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: Request, { params }: { params: { id: string; digest: string } }) {
  if (!reconstructionPreviewEnabled(process.env.NODE_ENV, process.env.LUNA_DEV_RECONSTRUCTION_PREVIEW, request.url)) {
    return unavailable();
  }
  const staged = await readPinnedReviewManifest(
    process.env.LUNA_DEV_RECONSTRUCTION_MANIFEST, process.env.LUNA_DEV_RECONSTRUCTION_MANIFEST_SHA256,
  );
  if (!staged) return unavailable();
  const item = reviewedDevelopmentArtwork(params.id, params.digest, staged);
  const configuredRoot = process.env.LUNA_DEV_RECONSTRUCTION_ROOT;
  if (!item || !configuredRoot) return unavailable();
  try {
    const root = await realpath(configuredRoot);
    const path = resolve(root, item.file);
    if (!path.startsWith(root + sep) || await realpath(path) !== path) return unavailable();
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size !== item.bytes) return unavailable();
    const image = await readFile(path);
    const png = '89504e470d0a1a0a';
    if (image.length !== item.bytes || image.length < 24 || image.subarray(0, 8).toString('hex') !== png
      || image.toString('ascii', 12, 16) !== 'IHDR' || image.readUInt32BE(16) !== item.width
      || image.readUInt32BE(20) !== item.height || createHash('sha256').update(image).digest('hex') !== item.replacementSha256) {
      return unavailable();
    }
    return new Response(new Uint8Array(image), { headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(item.bytes),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Luna-Artwork-Provenance': 'reviewed-reconstruction-not-historical',
      ...(item.dimensionNote ? { 'X-Luna-Artwork-Dimension-Note': item.dimensionNote } : {}),
    } });
  } catch {
    return unavailable();
  }
}
