import test from 'node:test';
import assert from 'node:assert/strict';

const aurel = {
  id: 'LUNA-0025',
  historical: 'e147bd4c4fa1b1457e1705cb0eb2c1c5b0cb31fc93846aa02aa524ecff3887da',
  reviewed: 'dcfa8645b80510d4da4098a586ee68efe5e744cec83acb7af494ac11b8d64f2c',
};

test('reviewed reconstruction entries are disjoint from exact originals and pinned by both digests', async () => {
  const { reviewedDevelopmentArtwork } = await import('../src/lib/cinematic/reviewed-reconstruction-dev');
  const scoped = { [aurel.id]: {
    historicalSha256: aurel.historical, replacementSha256: aurel.reviewed,
    width: 1024, height: 1536, bytes: 1, file: 'test.png', status: 'reviewed-locally-not-published',
  } };
  const row = reviewedDevelopmentArtwork(aurel.id, aurel.reviewed, scoped);
  assert.equal(row?.historicalSha256, aurel.historical);
  assert.deepEqual([row.width, row.height], [1024, 1536]);
  assert.equal(reviewedDevelopmentArtwork(aurel.id, aurel.historical, scoped), undefined);
  assert.equal(reviewedDevelopmentArtwork(aurel.id, '0'.repeat(64), scoped), undefined);
  assert.equal(reviewedDevelopmentArtwork('LUNA-0003', aurel.reviewed, scoped), undefined);
});

test('review route is forbidden in production, without opt-in, or on non-loopback host', async () => {
  const { reconstructionPreviewEnabled } = await import('../src/lib/cinematic/reviewed-reconstruction-dev');
  assert.equal(reconstructionPreviewEnabled('production', '1', 'http://127.0.0.1/'), false);
  assert.equal(reconstructionPreviewEnabled('development', undefined, 'http://127.0.0.1/'), false);
  assert.equal(reconstructionPreviewEnabled('development', 'true', 'http://127.0.0.1/'), false);
  assert.equal(reconstructionPreviewEnabled('development', '1', 'https://lunarian.app/'), false);
  assert.equal(reconstructionPreviewEnabled('development', '1', 'http://127.0.0.1:3089/'), true);
});

test('a reviewed reconstruction cannot be selected in the exact historical inspector or API', async () => {
  const { nativeArtworkViewerSrc } = await import('../src/lib/cinematic/native-art-url');
  const { GET } = await import('../src/app/api/cinematic/native-art/[id]/[digest]/route');
  assert.equal(nativeArtworkViewerSrc(aurel.id), undefined);
  for (const digest of [aurel.historical, aurel.reviewed]) {
    const request = new Request('http://127.0.0.1/api/cinematic/native-art/' + aurel.id + '/' + digest);
    const result = await GET(request, { params: { id: aurel.id, digest } });
    assert.equal(result.status, 404);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
  }
});
