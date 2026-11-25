import assert from 'node:assert/strict';
import test from 'node:test';
import { mellsShopImage } from '../src/lib/cinematic/mells-shop-art';
import { reviewedArtwork } from '../src/lib/cinematic/reviewed-artwork';

for (const [key, file, id] of [
  ['emberfall_chasm', 'Emberfall_Chasm', 'LUNA-0745'],
  ['rocky_terrain', 'Rocky_terrain', 'LUNA-0765'],
]) {
  test('Mells only projects the recorded profile and rank artwork for ' + key, () => {
    const imageUrl = 'https://assets.lunarian.app/profiles/' + file + '.png';
    const verified = reviewedArtwork(id);
    assert.ok(verified);
    for (const [prefix, type] of [['bg_', 'profile'], ['rank_', 'rank']]) {
      const item = Object.freeze({ id: prefix + key, imageUrl, type });
      assert.equal(mellsShopImage(item, true, 'thumb'), verified.thumb);
      assert.equal(mellsShopImage(item, true, 'detail'), verified.detail);
      assert.equal(mellsShopImage(item, false, 'thumb'), imageUrl);
      for (const wrong of [{ ...item, imageUrl: imageUrl + '?unregistered=1' }, { ...item, id: 'other' }, { ...item, type: 'other' }, { ...item, imageUrl: imageUrl.replace('assets.lunarian.app', 'other.test') }])
        assert.equal(mellsShopImage(wrong, true, 'thumb'), wrong.imageUrl);
    }
  });
}
