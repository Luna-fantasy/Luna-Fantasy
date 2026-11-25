import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const story = join('src','app','[locale]','story');
const read = (filename: string) => readFileSync(join(story,filename),'utf8');

test('the previous illustration and printed text turn together and are hidden from assistive technology', () => {
  const folio = read('StoryFolio.tsx');
  assert.match(folio,/data-folio-incoming/);
  const departure = folio.match(/<div[^>]*data-folio-outgoing[\s\S]*?<\/article>/)?.[0] ?? '';
  assert.match(departure,/aria-hidden="true"/);
  assert.match(departure,/turn\.src/);
  assert.match(departure,/turn\.from/);
  assert.match(folio,/turn\?\.chapter\s*===\s*active/);
});

test('the three chapter atmospheres preserve the local harbour movie and the reduced-motion reading path', () => {
  assert.ok(existsSync(join(story,'ChapterAtmosphere.tsx')));
  const art = read('ChapterAtmosphere.tsx');
  const css = read('FolioMotion.module.css');
  for (const cue of ['tide','ash','rays']) assert.match(art,new RegExp("['\"]"+cue+"['\"]"));
  assert.match(art,/IntersectionObserver/);
  assert.match(art,/visibilitychange/);
  assert.match(art,/\.pause\(\)/);
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  assert.match(css,/forced-colors:\s*active/);
  assert.ok(existsSync(join('public','luna-cinematic','home-story','story','lunvor-harbour-c881b497.mp4')));
});
