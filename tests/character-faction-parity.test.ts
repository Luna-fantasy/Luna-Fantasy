import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCharacterFaction } from '../src/lib/cinematic/character-faction';
import { readFileSync } from 'node:fs';

test('public archive normalizes the two historical faction slugs without changing DB identity', () => {
  assert.equal(canonicalCharacterFaction('moon'), 'moon-creatures');
  assert.equal(canonicalCharacterFaction('strange'), 'strange-being');
  for (const id of ['moon-creatures','strange-being','main','knights','unknown']) {
    assert.equal(canonicalCharacterFaction(id), id);
  }
});
test('grouped archive, filter, labels and styling use one character faction selection', () => {
  const src = readFileSync('src/app/[locale]/characters/CharactersContent.tsx','utf8');
  assert.match(src, /canonicalCharacterFaction\(c\.faction\) === f\.id/);
  assert.match(src, /canonicalCharacterFaction\(c\.faction\) === activeFaction/);
  assert.match(src, /canonicalCharacterFaction\(c\.faction\) === faction\.id/);
  assert.match(src, /f\.id === canonicalCharacterFaction\(factionId\)/);
});
