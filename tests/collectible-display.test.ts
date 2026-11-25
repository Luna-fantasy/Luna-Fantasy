import assert from 'node:assert/strict';
import test from 'node:test';
import index from '../src/lib/cinematic/release-card-index.json';
import { collectibleDisplayImage } from '../src/lib/cinematic/collectible-display';
import { projectLunaCardArtwork } from '../src/lib/release-card-art';
import { reviewedArtwork } from '../src/lib/cinematic/reviewed-artwork';

test('purchase, trading and collection surfaces resolve the admitted artwork for every published collectible', () => {
  for (const [source, name, rarity, id] of index.fantasy) {
    const art = projectLunaCardArtwork({name: {en:name}, rarity, imageUrl:source}, true)!;
    assert.equal(collectibleDisplayImage(source.replace(/%20/g, ' '), 'thumb'), art.thumb, id);
    assert.equal(collectibleDisplayImage(source.split('?')[0], 'thumb'), art.thumb, id);
    assert.equal(collectibleDisplayImage(source.replace(/\?v=\d+$/, '?v=1'), 'thumb'), art.thumb, id);
    assert.equal(collectibleDisplayImage(source + '&other=1'), '');
    assert.equal(collectibleDisplayImage(source), reviewedArtwork(id)?.detail ?? art.detail, id);
  }
});
test('unapproved card sources stay out of presentation and historical Kaidan links keep the approved unarmed print', () => {
  const src = index.fantasy.find(row => row[1] === 'Kaidan')![0];
  assert.equal(collectibleDisplayImage(src.replace(/\?v=\d+$/, '?v=1')), reviewedArtwork('LUNA-0392')!.detail);
  for (const unknown of [src.replace('/Unique/', '/Rare/'), 'https://example.org/cards/Epic/Paladin.png', 'https://assets.lunarian.app/cards/Forbidden/Whitebeard.png', '']) {
    assert.equal(collectibleDisplayImage(unknown), '');
  }
});