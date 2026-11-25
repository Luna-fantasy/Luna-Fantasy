import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import cardIndex from '../src/lib/cinematic/release-card-index.json';
import { projectFactionCardArtwork } from '../src/lib/release-card-art';
import { approvedPortraitFor, CHARACTER_TEXTURES } from '../src/lib/cinematic/people-art';
import { inspectorArtworkViewerSrc } from '../src/lib/cinematic/native-art-inspector';
import { councilRepresentative } from '../src/lib/cinematic-luna-faction';

const cases = [
  ['LUNA-0457', 'ancient-viaduct'],
  ['LUNA-0467', 'eclipse-ravine'],
  ['LUNA-0470', 'glacial-shelf'],
  ['LUNA-0474', 'magma-basalt-bite'],
] as const;

for (const [id, version] of cases) {
  test('Faction stage, index and native viewer expose the reviewed ' + id, () => {
    const [image, name, group] = cardIndex.faction.find(row => row[3] === id)!;
    const result = projectFactionCardArtwork(group, { image, name }, true)!;
    assert.equal(result.releaseId, id);
    assert.ok(result.thumb.includes('/' + version + '-'), result.thumb);
    assert.ok(result.detail.includes('/' + version + '-'), result.detail);
    assert.ok(inspectorArtworkViewerSrc(id)?.includes('/' + version + '-'));
    assert.equal(projectFactionCardArtwork(group, { image: image + '1', name }, true), undefined);
    assert.equal(projectFactionCardArtwork(group, { image, name }, false), undefined);
  });
}

test('Silver Bird uses the intact print on the Faction index, stage and native reader', () => {
  const id = 'LUNA-0594';
  const sha = '84fd3f4c79922293ed3cde1880283fd6960a8c2786699ae5664104f63ff61e56';
  const [image, name, group] = cardIndex.faction.find(row => row[3] === id)!;
  const stage = projectFactionCardArtwork(group, { image, name }, true)!;
  const base = `/luna-cinematic/cards/faction/${id}/v19-print-${sha.slice(0, 12)}`;
  assert.equal(stage.thumb, base + '-thumb.webp');
  assert.equal(stage.detail, base + '-stage.webp');
  const native = inspectorArtworkViewerSrc(id);
  assert.equal(native, base + '.png');
  const bytes = readFileSync(new URL('../public' + native, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha);
});

test('Glacial character artwork uses the reviewed eastern identity and its own pose', () => {
  const [dbSource] = Object.entries(CHARACTER_TEXTURES).find(([, value]) => value === 'LUNA-0093')!;
  const portrait = approvedPortraitFor(dbSource)!;
  assert.ok(portrait.medium.includes('/glacial-riverbank-'), portrait.medium);
  assert.ok(portrait.thumb.includes('/glacial-riverbank-'));
  assert.equal(approvedPortraitFor(dbSource + '1'), null);
});

test('the dragon representative in the council opens with the renewed Ancient artwork', () => {
  const [image,name,group] = cardIndex.faction.find(row => row[3] === 'LUNA-0457')!;
  const council = councilRepresentative(group,[{image,name}]);
  assert.ok(council);
  assert.ok(council.card.includes('/ancient-viaduct-'), council.card);
  assert.match(council.seal ?? '', /seal-LUNA-0457/);
});
