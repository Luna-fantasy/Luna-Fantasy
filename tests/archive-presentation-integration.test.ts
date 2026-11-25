import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lightbox } from '../src/components/Lightbox';

const route = (name: string) => readFileSync('src/app/[locale]/'+name+'-fantasy/CardsContent.tsx','utf8');
test('the Luna and Grand catalog carousels are filtered, ID-pinned, and open existing inspectors', () => {
  for (const game of ['luna','grand']) {
    const source = route(game);
    assert.match(source, /const archiveEntries = filteredCards\.flatMap/);
    assert.match(source, /const id = art\?\.releaseId \?\? card\.id/);
    assert.match(source, /archiveByReleaseId\.set\(id, card\)/);
    assert.match(source, /archiveEntries=\{archiveEntries\}/);
    assert.match(source, new RegExp('<ArchiveCardCarousel variant="' + game + '"'));
    assert.match(source, /const card = archiveByReleaseId\.get\(entry\.id\)/);
    assert.match(source, /hidden=\{showCarousel && !indexOpen\}/);
    assert.match(source, /onKeyDown=\{event =>/);
    assert.match(source, /onInspect=\{\(entry, trigger\) =>/);
    assert.match(source, /openCardArtwork\(card, trigger\)/);
    assert.match(source, /openerElement=\{lightboxImage\?\.opener\}/);
  }
});
test('verified Luna Secret cards retain their reading inside the same filtered viewer', () => {
  const luna = route('luna');
  assert.match(luna, /projectLunaSecretCodex\(card, locale, cinematic\)/);
  assert.match(luna, /readSecret=\{id => \{\s+const card = archiveByReleaseId\.get\(id\)/);
  assert.doesNotMatch(route('grand'), /readSecret=/);
});

test('the selected public print has a filtered position, bounded controls, and no historical image URL', () => {
  const archiveEntries = [
    { id:'LUNA-0593', name:'Silk Moth', detail:'/current-moth.webp' },
    { id:'LUNA-0594', name:'Silver Bird', detail:'/bird-medium.webp', visualFix:'/approved-bird.webp' },
  ];
  const html = renderToStaticMarkup(createElement(Lightbox, {
    isOpen:true, inspection:{kind:'faction',id:'LUNA-0594',original:'/historical-bird.png'}, archiveEntries,
    imageSrc:'/bird-medium.webp', alt:'Silver Bird', locale:'en', onClose() {},
  }));
  assert.match(html, /data-current-index="1"/);
  assert.match(html, /data-collection-size="2"/);
  assert.match(html, /class="archive-inspector-art" src="\/approved-bird.webp"/);
  assert.match(html, /data-read-step="previous" aria-disabled="false"/);
  assert.match(html, /data-read-step="next" aria-disabled="true"/);
  assert.doesNotMatch(html, /historical-bird|archive-inspector-versions/);
});

test('card preview dismisses when a page enters the back-forward cache', () => {
  for (const file of ['src/components/Lightbox.tsx','src/components/cinematic-games/LunaSecretCodexViewer.tsx']) {
    const source = readFileSync(file,'utf8');
    assert.match(source, /window\.addEventListener\('pagehide', handlePageHide\)/);
    assert.match(source, /window\.removeEventListener\('pagehide', handlePageHide\)/);
  }
});

test('comparison is offered in each collection with two prints and stays absent for a single print', () => {
  const entries = [{id:'LUNA-0323',name:'Cobra',detail:'/cobra.webp'}, {id:'LUNA-0333',name:'Phoenix',detail:'/phoenix.webp'}];
  for (const kind of ['luna','grand','faction'] as const) {
    const reader = (archiveEntries: typeof entries) => {
      return renderToStaticMarkup(createElement(Lightbox, {isOpen:true, inspection:{kind,id:entries[0].id}, archiveEntries,
        imageSrc:entries[0].detail, alt:entries[0].name, locale:'en', onClose() {}}));
    };
    assert.match(reader(entries), /data-art-compare="true" aria-pressed="false"/);
    assert.doesNotMatch(reader(entries.slice(0,1)), /data-art-compare/);
  }
});
