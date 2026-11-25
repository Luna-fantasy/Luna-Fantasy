import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { airborne, loadApprovedTexture } from '../public/luna-v16/grand/grand-v7/textures.mjs';

const sha = url => createHash('sha256').update(readFileSync(join('public',url.split('?')[0]))).digest('hex');
test('the airborne Cook and Moon Serpent show the same current front as the archive with retained originals', async () => {
  const visual = JSON.parse(readFileSync('src/lib/cinematic/reviewed-artwork.json','utf8'));
  const display = JSON.parse(readFileSync('src/lib/cinematic/fantasy-display-sources.json','utf8'));
  for (const [index,id,url,historical] of [
    [0,'LUNA-0252','/luna-cinematic/cards/fantasy/LUNA-0252/display-'+display['LUNA-0252'].slice(0,16)+'-medium.webp','ba5f7095b16de207593bd3b296e1981f98171f29bb60b31446038024d8d43533'],
    [4,'LUNA-0309',visual['LUNA-0309'].medium,'57981cf836c8f450489a47c4022ab454f6e09482a1ab12cdf96c1c4cd2e237b4'],
  ]) {
    const entry = airborne[index];
    assert.equal(entry.id,id);
    assert.equal(entry.url,url);
    assert.equal(sha(entry.url),entry.sha256);
    assert.equal(sha(entry.fallbackUrl),historical);
    const calls=[];
    const fallback=await loadApprovedTexture(entry,async path=>{calls.push(path);if(calls.length===1)throw Error('fixture');return path;});
    assert.deepEqual(calls,[url,entry.fallbackUrl]);
    assert.equal(fallback,entry.fallbackUrl);
  }
});
