import assert from 'node:assert/strict';
import test from 'node:test';
import exact from '../src/lib/cinematic/native-art-available.json';
import expected from '../src/lib/cinematic/native-art-expected.json';
import reviewed from '../src/lib/cinematic/native-art-v19-reviewed.json';
import { nativeArtworkViewerSrc } from '../src/lib/cinematic/native-art-url';

test('V19 adds an independently pinned image for each unrecovered historical ID', () => {
  assert.deepEqual(Object.keys({ ...exact, ...reviewed }).sort(), Object.keys(expected).sort());
  assert.equal(Object.keys(reviewed).length, 217);
  for (const [id, row] of Object.entries(reviewed)) {
    assert.equal(Object.hasOwn(exact, id), false);
    assert.equal(row.historicalSha256, expected[id as keyof typeof expected].sha256);
    assert.notEqual(row.sha256, row.historicalSha256);
  }
});

test('the release choice keeps historical URLs stable and scopes replacements to V19', t => {
  const prior = process.env.NEXT_PUBLIC_LUNA_ART_RELEASE;
  t.after(() => {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_LUNA_ART_RELEASE;
    else process.env.NEXT_PUBLIC_LUNA_ART_RELEASE = prior;
  });
  delete process.env.NEXT_PUBLIC_LUNA_ART_RELEASE;
  const original = nativeArtworkViewerSrc('LUNA-0001');
  assert.ok(original?.endsWith(exact['LUNA-0001'].sha256));
  assert.equal(nativeArtworkViewerSrc('LUNA-0002'), undefined);
  process.env.NEXT_PUBLIC_LUNA_ART_RELEASE = 'v19';
  assert.equal(nativeArtworkViewerSrc('LUNA-0001'), original);
  assert.equal(nativeArtworkViewerSrc('LUNA-0002'), '/api/cinematic/native-art/LUNA-0002/' + reviewed['LUNA-0002'].sha256);
});
