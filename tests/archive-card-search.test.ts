import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const helper = '../src/lib/cinematic/archive-card-search.ts';
const component = '../src/components/cinematic-games/ArchiveCardSearch.tsx';

test('approved archive aliases combine with names and release IDs without assigning aliases to unrelated rows', async () => {
  const { archiveCardMatcher } = await import(helper);
  const examples = [
    { id:'LUNA-0322', name:'Luna Blacksmith', group:'rare' },
    { id:'LUNA-0383', name:'Luna Champion', group:'unique' },
    { id:'LUNA-0297', name:'Bloodforged Warlord', group:'legendary' },
    { id:'LUNA-0298', name:'Chaos King', group:'legendary' },
    { id:'LUNA-0321', name:'Luna Archer', group:'rare' },
    { id:undefined, name:'Another Luna Blacksmith', group:'rare' },
  ];
  for (const route of ['luna-fantasy','grand-fantasy']) {
    const search = (query: string, group = 'all', locale = 'en') => {
      const match = archiveCardMatcher(route, locale, query);
      return examples.filter(row => (group === 'all' || row.group === group) && match(row.id, row.name)).map(row => row.id);
    };
    assert.deepEqual(search('Thorin luna-0322'), ['LUNA-0322']);
    assert.deepEqual(search('thorin','legendary'), []);
    assert.deepEqual(search('Bod Aban'), ['LUNA-0383']);
    assert.deepEqual(search('Movarth'), ['LUNA-0298']);
    assert.deepEqual(search('Bloodforged Knight'), ['LUNA-0297']);
    assert.deepEqual(search('ثُورِين','rare','ar'), ['LUNA-0322']);
    assert.deepEqual(search('    ','rare'), ['LUNA-0322','LUNA-0321',undefined]);
  }
  assert.ok(archiveCardMatcher('luna-fantasy','en','LUNA-0350')('LUNA-0350',''));
  assert.ok(!archiveCardMatcher('grand-fantasy','en','LUNA-0350')('LUNA-0350',''), 'never expand Grand to Luna-only rows');
  const guild = archiveCardMatcher('faction-war','ar','الحصان المُجَنَّح');
  assert.ok(guild('LUNA-0588','Pegasus'));
  assert.ok(!guild('LUNA-0262','Luna Pegasus'), 'do not give Faction the Luna ID alias');
  const deer = archiveCardMatcher('faction-war','en','great dear');
  assert.ok(deer('LUNA-0608','Great Deer'));
  assert.ok(!deer(undefined,'Great Deer'));
  assert.ok(!deer('LUNA-0609','Great Sage'));
  assert.ok(archiveCardMatcher('faction-war','en','Pegasus')(undefined,'Pegasus'), 'still find a real displayed label');
});

test('the Faction catalogue accepts its verified Arabic identity in both interface languages', async () => {
  const { archiveCardMatcher } = await import(helper);
  for (const locale of ['en', 'ar']) {
    const match = archiveCardMatcher('faction-war', locale, 'التنين المصوغ بالدم');
    assert.ok(match('LUNA-0458', 'Bloodforged Drake', 'Bloodforged Dragon'));
    assert.ok(!match('LUNA-0493', 'Bloodforged Knight', 'Bloodforged Warlord'));
  }
});

test('the initial archive search control is rendered server-side with exact localized accessible count and empty copy', async () => {
  const { ArchiveCardSearch } = await import(component);
  const english = renderToStaticMarkup(createElement(ArchiveCardSearch,{locale:'en',query:'',count:326,onQuery(){}}));
  assert.match(english,/for="catalog-search-input"/);
  assert.match(english,/type="search"/);
  assert.match(english,/Search the collection/);
  assert.match(english,/Search by name…/);
  assert.match(english,/role="status" aria-live="polite"/);
  assert.match(english,/Results: 326/);
  const arabic = renderToStaticMarkup(createElement(ArchiveCardSearch,{locale:'ar',query:'غير موجود',count:0,onQuery(){}}));
  assert.match(arabic,/بحث في المجموعة/);
  assert.match(arabic,/ابحث بالاسم…/);
  assert.match(arabic,/لا توجد نتائج مطابقة\./);
  const arabicResult = renderToStaticMarkup(createElement(ArchiveCardSearch,{locale:'ar',query:'الحصان',count:12,onQuery(){}}));
  assert.ok(arabicResult.includes('النتائج: ' + new Intl.NumberFormat('ar').format(12)));
});
