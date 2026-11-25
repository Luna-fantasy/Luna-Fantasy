import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { approvedPortraitFor, CHARACTER_TEXTURES } from '../src/lib/cinematic/people-art';
import { inspectorArtworkViewerSrc } from '../src/lib/cinematic/native-art-inspector';
import index from '../src/lib/cinematic/release-card-index.json';
import { projectFactionCardArtwork } from '../src/lib/release-card-art';
import prints from './fixtures/luna-v19-dragon-prints.json';
import reviewed from './fixtures/luna-final-art-prints.json';

const expectedPrints = new Map(Object.entries({ ...prints, ...reviewed }));

const pairs = [
  { portrait: 'LUNA-0037', card: 'LUNA-0458', personStem: 'blood-marsh-wading', cardStem: 'blood-marsh-folded-wing' },
  { portrait: 'LUNA-0093', card: 'LUNA-0470', personStem: 'glacial-riverbank', cardStem: 'glacial-shelf' },
];

for (const { portrait, card, personStem, cardStem } of pairs) {
  test(portrait + ' and its Faction War face load independent prints at all sizes', () => {
    const source = Object.entries(CHARACTER_TEXTURES).find(([, id]) => id === portrait)?.[0];
    assert.ok(source);
    const person = approvedPortraitFor(source);
    assert.ok(person);
    assert.equal(person.id, portrait);
    assert.equal(approvedPortraitFor(source + '&changed=1'), null);

    const row = index.faction.find(entry => entry[3] === card);
    assert.ok(row);
    const [image, name, group] = row;
    const print = projectFactionCardArtwork(group, { name, image }, true);
    assert.ok(print);
    assert.equal(print.releaseId, card);
    assert.equal(print.original, image);
    assert.deepEqual(projectFactionCardArtwork(group, { name, image }, false), undefined);
    assert.deepEqual(projectFactionCardArtwork(group, { name, image: image + '&changed=1' }, true), undefined);

    for (const [id, stem, thumb, stage] of [
      [portrait, personStem, person.thumb, person.medium], [card, cardStem, print.thumb, print.detail],
    ]) {
      const native = inspectorArtworkViewerSrc(id);
      assert.ok(native);
      const bytes = readFileSync('public' + native);
      const expected = expectedPrints.get(id);
      assert.ok(expected);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.detail);
      const digest = expected.detail.slice(0, 16);
      assert.ok(native.endsWith('/' + stem + '-' + digest + '.png'));
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1024, 1536]);
      for (const [url, role] of [[thumb, 'thumb'], [stage, 'medium']] as const) {
        assert.ok(url.endsWith('/' + stem + '-' + digest + '-' + role + '.webp'));
        const image = readFileSync('public' + url);
        assert.equal(image.toString('ascii', 8, 12), 'WEBP');
        assert.equal(createHash('sha256').update(image).digest('hex'), expected[role]);
      }
    }
  });
}
