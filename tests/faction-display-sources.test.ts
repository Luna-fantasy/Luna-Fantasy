import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectFactionCardArtwork } from '../src/lib/release-card-art';
import release from '../src/lib/cinematic/release-card-index.json';

test('the Hydra grid and stage use renditions of the face opened by the reader', () => {
  const row = release.faction.find(([, , , id]) => id === 'LUNA-0471');
  assert.ok(row);
  const [image, name, group] = row;
  const art = projectFactionCardArtwork(group, { image, name }, true);
  assert.ok(art);
  assert.match(art.thumb, /\/LUNA-0471\/from-[a-f0-9]{16}-thumb\.webp$/);
  assert.equal(art.detail, art.thumb.replace('-thumb.webp', '-medium.webp'));
  for (const url of [art.thumb, art.detail]) {
    const filename = join(process.cwd(), 'public', url);
    assert.ok(existsSync(filename), url);
    assert.equal(readFileSync(filename).subarray(8, 12).toString(), 'WEBP');
  }
  assert.equal(art.original, image);
  assert.equal(projectFactionCardArtwork(group, { image, name }, false), undefined);
});
