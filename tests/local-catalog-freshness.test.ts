import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewCatalogIsLive } from '../src/lib/cinematic/preview-catalog-cache';

test('the loopback fixture preview uses fresh data without changing the established production cache', () => {
  assert.equal(previewCatalogIsLive({NODE_ENV:'development',LUNA_DEV_V19_VISUAL_FIXES:'1'}), true);
  assert.equal(previewCatalogIsLive({NODE_ENV:'development'}), false);
  assert.equal(previewCatalogIsLive({NODE_ENV:'production',LUNA_DEV_V19_VISUAL_FIXES:'1'}), false);
  for (const reader of ['characters.ts','cards.ts','faction-war.ts']) {
    const src = readFileSync('src/lib/'+reader,'utf8');
    assert.match(src,/const livePreview = previewCatalogIsLive\(\)/);
    assert.match(src,/if \(!livePreview\b|if \(livePreview \|\|/);
  }
});
