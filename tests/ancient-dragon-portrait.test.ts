import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inspectorArtworkViewerSrc } from '../src/lib/cinematic/native-art-inspector';
import { approvedPortraitFor } from '../src/lib/cinematic/people-art';

test('the Ancient Dragon gallery and detail viewer select the same current character, independently of its Mythical card', () => {
  const characterSource = 'https://assets.lunarian.app/characters/ancient-dragon.png?v=1777538107142';
  const portrait = approvedPortraitFor(characterSource);
  assert.ok(portrait);
  assert.equal(portrait.id, 'LUNA-0019');
  for (const variant of [portrait.thumb, portrait.medium]) {
    const data = readFileSync('public' + variant);
    assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    assert.match(variant, /ancient-dragon-rampart-a9e61c158dcb/);
  }
  const detail = inspectorArtworkViewerSrc(portrait.id);
  assert.ok(detail);
  const original = readFileSync('public' + detail);
  assert.equal(createHash('sha256').update(original).digest('hex'), 'a9e61c158dcbee626ad57b071988c214cdb33acc6bff922fb2acd5d40711f25d');
  assert.deepEqual([original.readUInt32BE(16), original.readUInt32BE(20)], [1024, 1536]);
  assert.notEqual(inspectorArtworkViewerSrc('LUNA-0342'), detail);
  assert.equal(approvedPortraitFor(characterSource + '&other-revision=1'), null);
});
