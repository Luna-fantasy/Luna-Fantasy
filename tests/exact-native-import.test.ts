import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { linkArtworkFixture } from './helpers/artwork-link';

const load = createRequire(import.meta.url);
const img = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3Z0AAAAASUVORK5CYII=', 'base64');
const sha256 = createHash('sha256').update(img).digest('hex');
const id = 'LUNA-0003';
const expected = { [id]: { sha256, width: 1, height: 1, surface: 'gallery', revision: 'baseline' } };
const row = { id, surface: 'gallery', revision: 'baseline', sha256, width: 1, height: 1, format: 'PNG', bytes: img.length };

async function fixture(run: (root: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'luna-exact-art-import-'));
  try { await mkdir(join(dir, 'gallery')); await run(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('importer verifies exact staged digest/dimensions and emits no local paths or copies', async () => {
  const { validateStagedLedger } = load('../scripts/import-exact-native-artwork.cjs');
  await fixture(async (root) => {
    const expectedFile = join(root, 'gallery', id + '.png');
    await writeFile(expectedFile, img);
    const result = validateStagedLedger(JSON.stringify({ ...row, staged_path: 'old-environment-prefix/raw/gallery/' + id + '.png' }), root, expected);
    assert.deepEqual(result.available, { [id]: { sha256, bytes: img.length, width: 1, height: 1, mime: 'image/png' } });
    assert.deepEqual(result.summary, { count: 1, expected: 1, bytes: img.length, bySurface: { gallery: 1 } });
  });
});

test('unapproved and conflicting rows fail before opening any file', async () => {
  const { validateStagedLedger } = load('../scripts/import-exact-native-artwork.cjs');
  await fixture(async (root) => {
    assert.throws(() => validateStagedLedger(JSON.stringify({ ...row, sha256: 'c'.repeat(64) }), root, expected), /not the locked historical revision/i);
    assert.throws(() => validateStagedLedger(JSON.stringify({ ...row, id: 'LUNA-9999' }), root, expected), /not the locked historical revision/i);
    assert.throws(() => validateStagedLedger(JSON.stringify({ ...row, height: 2 }), root, expected), /not the locked historical revision/i);
    assert.throws(() => validateStagedLedger(JSON.stringify({ ...row, replacement: true }), root, expected), /replacement rows are ineligible/i);
  });
});

test('importer rejects duplicate IDs, symlinks and hashed images with incompatible expected dimensions', async () => {
  const { validateStagedLedger } = load('../scripts/import-exact-native-artwork.cjs');
  await fixture(async (root) => {
    const sourceDir = join(root, 'source');
    const gallery = join(root, 'gallery');
    const physical = join(sourceDir, id + '.png');
    const enrolled = join(gallery, id + '.png');
    await mkdir(sourceDir);
    await writeFile(physical, img);
    const lines = [JSON.stringify(row), JSON.stringify(row)].join('\n');
    assert.throws(() => validateStagedLedger(lines, root, expected), /duplicate ID/i);
    const linkedFile = linkArtworkFixture(physical, enrolled);
    assert.deepEqual(await readFile(linkedFile), img);
    assert.throws(() => validateStagedLedger(JSON.stringify(row), root, expected), {
      message: 'Artwork symlink is not allowed: ' + id,
    });
    await unlink(enrolled);
    await writeFile(enrolled, img);
    assert.equal(validateStagedLedger(JSON.stringify(row), root, expected).summary.count, 1);
    const wrong = { [id]: { ...expected[id], height: 2 } };
    assert.throws(() => validateStagedLedger(JSON.stringify({ ...row, height: 2 }), root, wrong), /image dimensions or media type did not match/i);

    const originalGallery = join(root, 'original-gallery');
    await rename(gallery, originalGallery);
    await symlink(originalGallery, gallery, process.platform === 'win32' ? 'junction' : 'dir');
    assert.deepEqual(await readFile(enrolled), img);
    assert.throws(() => validateStagedLedger(JSON.stringify(row), root, expected), {
      message: 'Artwork surface symlink or invalid directory: ' + id,
    });
  });
});
