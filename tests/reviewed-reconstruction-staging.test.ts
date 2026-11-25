import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const load = createRequire(import.meta.url);
const img = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgk88AAADUAJazp7vjAAAAAElFTkSuQmCC', 'base64');
const imgB = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOYcWMjAAQtAiLzV/yvAAAAAElFTkSuQmCC', 'base64');
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const a = 'LUNA-0001', b = 'LUNA-0002', c = 'LUNA-0003';
const historical = { [a]: { sha256: 'a'.repeat(64), width: 1, height: 1 }, [b]: { sha256: 'b'.repeat(64), width: 1, height: 1 }, [c]: { sha256: 'c'.repeat(64), width: 1, height: 1 } };
const exact = { [c]: { sha256: historical[c].sha256, width: 1, height: 1 } };
const row = { id: a, historical_sha256: historical[a].sha256, replacement_sha256: sha(img), dimensions: [1, 1], file: 'luna-raw-index-check/LUNA-0001.png', origin: 'new-reconstruction', status: 'reviewed-locally-not-published' };

async function withDirectory(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'luna-review-stage-test-'));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('runner separates staged exact and reviewed counts, lists gaps, and never claims approval', async () => {
  const { prepareReviewedStaging } = load('../scripts/stage-reviewed-reconstructions.cjs');
  await withDirectory(async (dir) => {
    await writeFile(join(dir, 'LUNA-0001.png'), img);
    const stage = prepareReviewedStaging([row], dir, historical, exact);
    assert.deepEqual(stage.summary, { expected: 3, exact: 1, reviewed: 1, uncovered: [b] });
    assert.equal(stage.manifest.kind, 'luna-reviewed-reconstruction-staging-v1');
    assert.deepEqual(Object.keys(stage.manifest.entries), [a]);
    assert.equal(stage.manifest.entries[a].file, 'LUNA-0001.png');
    assert.throws(() => prepareReviewedStaging([row], dir, historical, exact, true), /uncovered: LUNA-0002/i);
  });
});

test('absent ledger/rows and duplicates, unreviewed IDs, exact collisions and forged hashes fail closed', async () => {
  const { prepareReviewedStaging } = load('../scripts/stage-reviewed-reconstructions.cjs');
  await withDirectory(async (dir) => {
    assert.throws(() => prepareReviewedStaging(undefined, dir, historical, exact), /nonempty.*reviewed.*ledger/i);
    assert.throws(() => prepareReviewedStaging([], dir, historical, exact), /nonempty.*reviewed.*ledger/i);
    assert.throws(() => prepareReviewedStaging([row, row], dir, historical, exact), /duplicate.*ID/i);
    assert.throws(() => prepareReviewedStaging([{ ...row, status: 'awaiting-review' }], dir, historical, exact), /not an approved staging row/i);
    assert.throws(() => prepareReviewedStaging([{ ...row, id: c, historical_sha256: historical[c].sha256 }], dir, historical, exact), /exact historical file already staged/i);
    assert.throws(() => prepareReviewedStaging([{ ...row, historical_sha256: 'd'.repeat(64) }], dir, historical, exact), /historical hash mismatch/i);
    assert.throws(() => prepareReviewedStaging([{ ...row, file: 'luna-raw-index-check/../a.png' }], dir, historical, exact), /invalid staged file path/i);
    await writeFile(join(dir, 'LUNA-0001.png'), img);
    assert.throws(() => prepareReviewedStaging([{ ...row, replacement_sha256: 'd'.repeat(64) }], dir, historical, exact), /candidate bytes do not match reviewed hash/i);
  });
});

test('pin mismatch and absent staged manifest do not silently enable another set', async () => {
  const { readPinnedReviewManifest } = await import('../src/lib/cinematic/reviewed-reconstruction-dev');
  await withDirectory(async (dir) => {
    const path = join(dir, 'reviewed.json');
    assert.equal(await readPinnedReviewManifest(path, 'e'.repeat(64)), undefined);
    const input = JSON.stringify({ kind: 'luna-reviewed-reconstruction-staging-v1', entries: {} });
    await writeFile(path, input);
    assert.equal(await readPinnedReviewManifest(path, 'e'.repeat(64)), undefined);
    assert.equal(await readPinnedReviewManifest(path, undefined), undefined);
    assert.deepEqual(await readPinnedReviewManifest(path, sha(input)), {});
  });
});

test('only pinned reviewed Moonglass accepts its independently rendered alternate grid', async () => {
  const { reviewDimensions } = load('../src/lib/cinematic/reviewed-reconstruction-dimension-policy.cjs');
  const id = 'LUNA-0150';
  const history = { sha256: 'a4887ec7aaaf1908b5f2f5258650fa3af180a851737689019ea10b548260a4ea', width: 1025, height: 1535 };
  const reviewed = 'e7a2360e8026ee04092c5857d53e483be7900a14337f1d67ba9420f022b6c776';
  assert.deepEqual(reviewDimensions(id, history, reviewed, 1024, 1536), {
    historicalWidth: 1025,
    historicalHeight: 1535,
    dimensionNote: 'LUNA-0150 native tool grid; no scaling or upscale',
  });
  assert.equal(reviewDimensions(id, history, reviewed, 1025, 1535), null);
  assert.equal(reviewDimensions(id, history, reviewed, 1024, 1535), undefined);
  assert.equal(reviewDimensions(id, history, '7'.repeat(64), 1024, 1536), undefined);
  assert.equal(reviewDimensions('LUNA-0151', history, reviewed, 1024, 1536), undefined);
  assert.equal(reviewDimensions(id, { ...history, width: 1026 }, reviewed, 1024, 1536), undefined);
});

test('development route requires honest historic dimensions and note for the 0150 exception', async () => {
  const { reviewedDevelopmentArtwork } = await import('../src/lib/cinematic/reviewed-reconstruction-dev');
  const id = 'LUNA-0150';
  const item = {
    historicalSha256: 'a4887ec7aaaf1908b5f2f5258650fa3af180a851737689019ea10b548260a4ea',
    replacementSha256: 'e7a2360e8026ee04092c5857d53e483be7900a14337f1d67ba9420f022b6c776',
    width: 1024, height: 1536, bytes: 1, file: 'reviewed.png', status: 'reviewed-locally-not-published',
    historicalWidth: 1025, historicalHeight: 1535,
    dimensionNote: 'LUNA-0150 native tool grid; no scaling or upscale',
  };
  assert.equal(reviewedDevelopmentArtwork(id, item.replacementSha256, { [id]: item }), item);
  assert.equal(reviewedDevelopmentArtwork(id, item.replacementSha256, { [id]: { ...item, historicalWidth: 1024 } }), undefined);
  assert.equal(reviewedDevelopmentArtwork(id, item.replacementSha256, { [id]: { ...item, dimensionNote: 'same as original' } }), undefined);
  assert.equal(reviewedDevelopmentArtwork(id, item.replacementSha256, { [id]: { ...item, height: 1535 } }), undefined);
});

test('staging binds reviewed bytes and path tokens to the same LUNA ID', async () => {
  const { prepareReviewedStaging } = load('../scripts/stage-reviewed-reconstructions.cjs');
  await withDirectory(async (dir) => {
    const fileA = 'LUNA-0001.png';
    const folderB = 'Rare-lUnA-0002';
    const fileB = folderB + '/plate.png';
    await mkdir(join(dir, folderB));
    await writeFile(join(dir, fileA), img);
    await writeFile(join(dir, fileB), imgB);
    const rowA = { ...row, file: fileA };
    const rowB = { ...row, id: b, historical_sha256: historical[b].sha256, replacement_sha256: sha(imgB), file: fileB };
    const intact = prepareReviewedStaging([rowA, rowB], dir, historical, exact, true);
    assert.deepEqual(intact.summary, { expected: 3, exact: 1, reviewed: 2, uncovered: [] });
    assert.equal(intact.manifest.entries[b].file, fileB);
    assert.throws(() => prepareReviewedStaging([
      { ...rowA, file: rowB.file, replacement_sha256: rowB.replacement_sha256 },
      { ...rowB, file: rowA.file, replacement_sha256: rowA.replacement_sha256 },
    ], dir, historical, exact, true), /staged file path must identify only LUNA-0001/i);
    for (const wrong of [
      'LUNA-0001/LUNA-0002-native.png', 'LUNA-00010.png',
      'NOTLUNA-0001.png', 'LUNA-0001extra.png', 'unlabelled.png',
    ]) {
      assert.throws(() => prepareReviewedStaging([{ ...rowA, file: wrong }], dir, historical, exact),
        /staged file path must identify only LUNA-0001/i);
    }
  });
});
