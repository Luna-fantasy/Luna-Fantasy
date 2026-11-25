import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import historical from './native-art-expected.json';
import exact from './native-art-available.json';
import { reviewDimensions } from './reviewed-reconstruction-dimension-policy.cjs';

type Historical = { sha256: string; width: number; height: number };
type DevelopmentReconstruction = {
  historicalSha256: string;
  replacementSha256: string;
  width: number;
  height: number;
  bytes: number;
  file: string;
  status: string;
  historicalWidth?: number;
  historicalHeight?: number;
  dimensionNote?: string;
};
const expected: Readonly<Record<string, Historical>> = historical;

export function reconstructionPreviewEnabled(mode: string | undefined, optIn: string | undefined, url: string) {
  if (mode !== 'development' || optIn !== '1') return false;
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
  } catch {
    return false;
  }
}

export async function readPinnedReviewManifest(path: string | undefined, digest: string | undefined) {
  if (!path || !digest || !/^[0-9a-f]{64}$/.test(digest)) return;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > 512 * 1024) return;
    const content = await readFile(path);
    if (content.length !== stat.size || createHash('sha256').update(content).digest('hex') !== digest) return;
    const document = JSON.parse(content.toString('utf8'));
    if (document?.kind !== 'luna-reviewed-reconstruction-staging-v1' || !document.entries
      || typeof document.entries !== 'object' || Array.isArray(document.entries)
      || Object.keys(document.entries).length > 796) return;
    return document.entries as Readonly<Record<string, DevelopmentReconstruction>>;
  } catch { return; }
}

export function reviewedDevelopmentArtwork(id: string, digest: string, allowlist: Readonly<Record<string, DevelopmentReconstruction>>) {
  if (!/^LUNA-\d{4}$/.test(id) || !/^[0-9a-f]{64}$/.test(digest) || Object.hasOwn(exact, id)
    || !Object.hasOwn(expected, id) || !Object.hasOwn(allowlist, id)) return;
  const item = allowlist[id];
  const history = expected[id];
  if (!item || typeof item !== 'object' || item.status !== 'reviewed-locally-not-published' || item.historicalSha256 !== history.sha256
    || item.replacementSha256 === history.sha256 || item.replacementSha256 !== digest
    || !Number.isSafeInteger(item.bytes) || item.bytes <= 0 || typeof item.file !== 'string' || !item.file.endsWith('.png')) return;
  const dimensions = reviewDimensions(id, history, item.replacementSha256, item.width, item.height);
  if (dimensions === undefined || (dimensions && (
    item.historicalWidth !== dimensions.historicalWidth || item.historicalHeight !== dimensions.historicalHeight
    || item.dimensionNote !== dimensions.dimensionNote
  ))) return;
  if (dimensions === null && (item.historicalWidth !== undefined || item.historicalHeight !== undefined || item.dimensionNote !== undefined)) return;
  return item;
}
