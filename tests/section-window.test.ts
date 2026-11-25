import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { additionalWindows, sectionWindowFor } from '../src/lib/cinematic/section-window';
const paths = ["","story","characters","luna-fantasy","grand-fantasy","faction-war","members","partners","bank","bazaar","bazaar/kael","bazaar/meluna","bazaar/zoldar","bazaar/seluna","bazaar/brimor","bazaar/mells","trading","marketplace","about","faq","contact","privacy","terms","refund","profile","auth/signin"];
test('English and Arabic sections resolve to individual, local artworks and motion profiles', () => {
  const windows = paths.map(path => sectionWindowFor('/en/' + path));
  assert.equal(new Set(windows.map(scene => scene.art)).size, paths.length);
  assert.equal(new Set(windows.map(scene => scene.profile)).size, paths.length);
  windows.forEach((scene, index) => {
    assert.equal(sectionWindowFor('/ar/' + paths[index] + '/?ref=nav#stock').id, scene.id);
    assert.ok(existsSync(join(process.cwd(), 'public', scene.art)), scene.art);
    assert.doesNotMatch(scene.art, /night-worlds\/story|closed-book|book_background/);
  });
  for (const unknown of ['unknown-route','constructor','toString','__proto__']) {
    assert.equal(sectionWindowFor('/en/'+unknown).id, 'unlisted');
  }
});
test('the quay, market and treasury each ship their own photograph and matching local cinema', () => {
  const cases = [
    [sectionWindowFor('/en/'), 'quayside', 'wide-3840.webp', 'wide.mp4'],
    [additionalWindows['home-market'], 'night-market', 'scene-1942.webp', 'scene.mp4'],
    [additionalWindows['home-bank'], 'treasury', 'scene-1942.webp', 'scene.mp4'],
  ] as const;
  for (const [scene, location, poster, movie] of cases) {
    const directory = '/luna-cinematic/harbour-films/' + location + '/';
    assert.equal(scene.art, directory + poster);
    assert.equal(scene.film, location);
    assert.ok(existsSync(join(process.cwd(), 'public', directory, movie)), movie);
  }
});
test('a footer stays anchored to the current section when its links receive focus', () => {
  const footer = readFileSync('src/components/cinematic/FooterHarbour.tsx','utf8');
  assert.doesNotMatch(footer, /pointerover|focusin|setScene\('story'\)/);
});
