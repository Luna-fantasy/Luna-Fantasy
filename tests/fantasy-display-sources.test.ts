import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import release from '../src/lib/cinematic/release-card-index.json';
import { projectFantasyCardArtwork, projectLunaCardArtwork } from '../src/lib/release-card-art';
import { inspectorArtworkViewerSrc } from '../src/lib/cinematic/native-art-inspector';

function record(id: string) {
  const row = release.fantasy.find(value => value[3] === id);
  assert.ok(row, id);
  return { imageUrl: row[0], name: { en: row[1] }, rarity: row[2] };
}

test('Baby Wisp shows the native print at each Luna and Grand display size', () => {
  const id = 'LUNA-0247';
  const card = record(id);
  const luna = projectLunaCardArtwork(card, true);
  assert.ok(luna);
  assert.equal(luna.thumb, '/luna-cinematic/cards/fantasy/LUNA-0247/display-b962c7a530565f94-thumb.webp');
  assert.equal(luna.detail, '/luna-cinematic/cards/fantasy/LUNA-0247/display-b962c7a530565f94-medium.webp');
  assert.equal(luna.original, card.imageUrl);
  assert.deepEqual(projectFantasyCardArtwork(card, true), luna);
  assert.equal(projectLunaCardArtwork(card, false), undefined);
  for (const url of [luna.thumb,luna.detail]) assert.ok(existsSync(join('public',url)), url);
  assert.notEqual(inspectorArtworkViewerSrc(id), luna.detail);
});

test('Secret Codex display changes retain the exact native inspector and Luna-only membership', () => {
  const id = 'LUNA-0344';
  const card = record(id);
  const luna = projectLunaCardArtwork(card, true);
  assert.match(luna?.thumb ?? '', /display-[a-f0-9]{16}-thumb\.webp$/);
  assert.equal(projectFantasyCardArtwork(card, true), undefined);
  assert.notEqual(inspectorArtworkViewerSrc(id), luna?.thumb);
});
