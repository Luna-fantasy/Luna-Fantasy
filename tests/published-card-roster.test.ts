import test from 'node:test';
import assert from 'node:assert/strict';
import index from '../src/lib/cinematic/release-card-index.json';
import { approvedPortraitFor } from '../src/lib/cinematic/people-art';
import { publishedCardRoster, projectLunaCardArtwork } from '../src/lib/release-card-art';

const cards = index.fantasy.map(([source, name, rarity]) => ({
  name: { en: name }, rarity, imageUrl: source.replaceAll('%20', ' '),
}));

test('public tables admit only matching releases and count unique printed cards', () => {
  const bumper = cards.find(c => c.name.en === 'Bumper 1')!;
  const extra = [
    { ...bumper, rarity: 'forbidden', name: { en: 'General Radahn' } },
    { ...bumper, rarity: 'common', imageUrl: 'https://assets.lunarian.app/cards/Forbidden/Whitebeard.png' },
    { ...bumper, imageUrl: bumper.imageUrl.replace(/v=.*/, 'v=999') },
    { ...bumper, imageUrl: bumper.imageUrl.replaceAll(' ', '%20') },
  ];
  const records = [...extra.slice(0, 3), ...cards, extra[3]];
  assert.deepEqual(publishedCardRoster(records, 'luna'), cards);
  assert.deepEqual(publishedCardRoster(records, 'grand'), cards.filter(c => c.rarity !== 'secret'));
  assert.equal(projectLunaCardArtwork(bumper, true)?.releaseId, 'LUNA-0350');
});

test('a stored space resolves the Night Fangs portrait while preserving version pins', () => {
  const source = 'https://assets.lunarian.app/characters/Beasts/Night Fangs.jpeg';
  assert.equal(approvedPortraitFor(source)?.id, 'LUNA-0004');
  assert.equal(approvedPortraitFor(source + '?v=obsolete'), null);
});
