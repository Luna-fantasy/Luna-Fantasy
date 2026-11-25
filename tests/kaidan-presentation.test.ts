import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import test from 'node:test';
import index from '../src/lib/cinematic/release-card-index.json';
import receipts from './fixtures/kaidan-prints.json';
import { collectibleDisplayImage, kaidanForRelease } from '../src/lib/cinematic/kaidan-art';
import { projectFactionCardArtwork, projectFantasyCardArtwork, projectLunaCardArtwork } from '../src/lib/release-card-art';
import { inspectorArtworkViewerSrc } from '../src/lib/cinematic/native-art-inspector';

test('one official Unique print follows Kaidan from both catalogues into collections, sales and reveals', () => {
  const matches = index.fantasy.filter(row => row[1] === 'Kaidan' && row[2] === 'unique');
  assert.equal(matches.length, 1);
  const [url, name, rarity, id] = matches[0];
  assert.equal(id, 'LUNA-0392');
  const record = { name: { en: name }, rarity, imageUrl: url };
  for (const art of [projectLunaCardArtwork(record, true), projectFantasyCardArtwork(record, true)]) {
    assert.equal(art?.releaseId, id);
    assert.equal(art?.original, url);
    assert.equal(art?.detail, receipts.luna.detail);
    assert.equal(art?.thumb, receipts.luna.thumb);
  }
  assert.equal(inspectorArtworkViewerSrc(id), receipts.luna.detail);
  for (const official of [url, 'https://assets.lunarian.app/cards/Unique/Kaidan.png?v=1']) {
    assert.equal(collectibleDisplayImage(official), receipts.luna.detail);
    assert.equal(collectibleDisplayImage(official, 'thumb'), receipts.luna.thumb);
  }
  const directory = dirname('public' + receipts.luna.detail);
  assert.deepEqual(readdirSync(directory).filter(name => name.endsWith('.webp')).sort(),
    [basename(receipts.luna.detail), basename(receipts.luna.thumb)].sort());
});

test('the character portrait and Faction War print have their own identities', () => {
  const faction = index.faction.find(row => row[3] === 'LUNA-0420')!;
  const projected = projectFactionCardArtwork(faction[2], { name: faction[1], image: faction[0] }, true);
  assert.equal(projected?.detail, receipts.faction.detail);
  assert.equal(projected?.original, faction[0]);
  assert.equal(kaidanForRelease('LUNA-0243')?.detail, receipts.gallery.detail);
  assert.equal(new Set(Object.values(receipts).map(row => row.detail)).size, 3);
  for (const row of Object.values(receipts)) {
    for (const [file, expected] of [[row.detail, row.detailSha], [row.thumb, row.thumbSha]]) {
      const data = readFileSync('public' + file);
      assert.equal(createHash('sha256').update(data).digest('hex'), expected);
    }
  }
});

test('other cards retain their official source', () => {
  const official = 'https://assets.lunarian.app/cards/Unique/Kaidan.png';
  for (const other of [official.replace('Unique', 'Rare'), official.replace('Kaidan', 'Kael'), official.replace('assets.lunarian.app', 'art.example')])
    assert.equal(collectibleDisplayImage(other), other);
});
