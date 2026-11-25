import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import index from '../src/lib/cinematic/release-card-index.json';

const secretRows = index.fantasy.filter(([, , , id]) => /^LUNA-03(?:4[4-9]|[5-7]\d|8[0-2])$/.test(id));
const input = (id: string) => {
  const row = index.fantasy.find(x => x[3] === id);
  assert.ok(row, id);
  const [imageUrl, name, rarity] = row;
  return Object.freeze({ imageUrl, name: Object.freeze({ en: name, ar: 'اسم قاعدة البيانات' }), rarity, attack: 4 });
};

test('all 39 exact approved bilingual Codex rows are byte-pinned and join via release ID', async () => {
  const { projectLunaSecretCodex } = await import('../src/lib/cinematic/luna-secret-codex');
  const file = readFileSync('src/lib/cinematic/luna-secret-codex-data.json');
  assert.equal(createHash('sha256').update(file).digest('hex'), '94de8934b57ccd3bc4ca0e49c82bcede4ebea8955e4e3ad419abdf9afdb10d89');
  const catalog = JSON.parse(file.toString());
  assert.equal(catalog.length, 39);
  assert.equal(secretRows.length, 39);
  assert.deepEqual(new Set(catalog.map((r: {id: string}) => r.id)), new Set(secretRows.map(x => x[3])));
  for (const row of catalog) {
    const card = input(row.id);
    for (const locale of ['en', 'ar'] as const) {
      const selected = projectLunaSecretCodex(card, locale, true);
      assert.ok(selected, row.id);
      assert.equal(selected.releaseId, row.id);
      assert.deepEqual(selected.reading, {
        lang: locale,
        name: (locale === 'ar' ? row.ar : row).name,
        lore: (locale === 'ar' ? row.ar : row).lore,
        value: (locale === 'ar' ? row.ar : row).value,
        schema: (locale === 'ar' ? row.ar : row).schema ?? '',
        facts: (locale === 'ar' ? row.ar : row).facts,
        margin: (locale === 'ar' ? row.ar : row).margin,
      });
      if (row.id === 'LUNA-0347') {
        assert.equal(selected.artwork.detail, '/luna-v16/grand/card-revisions-v19/LUNA-0347/detail.webp?v=df267afae4252e10');
        assert.deepEqual(selected.reading.margin.map(note => note.text), ['Verbum • Umbra • Voluntas • Vitas.']);
        assert.equal(selected.reading.value, 112);
      } else {
        assert.match(selected.artwork.detail, new RegExp('^/luna-cinematic/cards/fantasy/' + row.id + '/'));
      }
      assert.doesNotMatch(JSON.stringify(selected), /https:\/\/assets\.lunarian\.app|imageUrl|"original"/);
      assert.equal(card.attack, 4, 'official assigned value has not been swapped for transcription value');
    }
  }
});

test('Codex projects neither edited, version drifted, misidentified, non-Secret nor disabled cards', async () => {
  const { projectLunaSecretCodex } = await import('../src/lib/cinematic/luna-secret-codex');
  const card = input('LUNA-0350');
  assert.equal(projectLunaSecretCodex(card, 'en', false), undefined);
  for (const alternative of [
    { ...card, imageUrl: card.imageUrl.replace(/\?v=\d+$/, '?v=123456') },
    { ...card, name: { en: 'Bumper 2' } },
    { ...card, imageUrl: card.imageUrl.split('?')[0] },
    { ...card, rarity: 'mythical' },
    { ...card, rarity: 'rare' },
    input('LUNA-0342'), input('LUNA-0343'), input('LUNA-0264'),
  ]) assert.equal(projectLunaSecretCodex(alternative, 'en', true), undefined);
});

test('same display name does not conflate Bumper variants or route Silent Ancient to retired art', async () => {
  const { projectLunaSecretCodex } = await import('../src/lib/cinematic/luna-secret-codex');
  const cards = ['LUNA-0350', 'LUNA-0351', 'LUNA-0352'].map(id => projectLunaSecretCodex(input(id), 'en', true)!);
  assert.equal(new Set(cards.map(x => x.reading.name)).size, 1);
  assert.equal(new Set(cards.map(x => x.reading.lore)).size, 3);
  assert.equal(new Set(cards.map(x => x.artwork.detail)).size, 3);
  const silent = projectLunaSecretCodex({...input('LUNA-0382'), rarity:'mythical'}, 'en', true);
  assert.ok(silent);
  assert.equal(silent.reading.value, 1000);
  assert.match(silent.artwork.detail, /silent-owner-approved-ea4b169dcc31-69bd7ad7c8dd\.jpeg$/);
});

test('reading has a closed native disclosure, accessible bilingual labels, and exact localized text', async () => {
  const { projectLunaSecretCodex } = await import('../src/lib/cinematic/luna-secret-codex');
  const { LunaSecretCodexReading } = await import('../src/components/cinematic-games/LunaSecretCodexReading');
  const en = projectLunaSecretCodex(input('LUNA-0352'), 'en', true)!;
  const ar = projectLunaSecretCodex(input('LUNA-0352'), 'ar', true)!;
  const enHtml = renderToStaticMarkup(createElement(LunaSecretCodexReading, { selection: en }));
  const arHtml = renderToStaticMarkup(createElement(LunaSecretCodexReading, { selection: ar }));
  assert.match(enHtml, /<details[^>]*><summary>Read the Secret Codex<\/summary>/);
  assert.doesNotMatch(enHtml, /<details[^>]*\bopen(?:\s|>|=)/);
  assert.match(enHtml, /<section[^>]*lang="en"[^>]*dir="ltr"/);
  assert.match(enHtml, /Inscription: Bog Kin \| Class: Clumsy \| Disposition: Dense/);
  assert.match(enHtml, /<dt>Tail Study<\/dt>/);
  assert.match(enHtml, /<h3>Marginalia<\/h3>/);
  assert.match(arHtml, /<summary>اقرأ سجل الكرت السري<\/summary>/);
  assert.match(arHtml, /<section[^>]*lang="ar"[^>]*dir="rtl"/);
  assert.ok(arHtml.includes(ar.reading.lore));
  assert.match(arHtml, /<dl>/);
});

test('the Jester retains the authored unknown value in either language, not NaN or a gameplay guess', async () => {
  const { projectLunaSecretCodex } = await import('../src/lib/cinematic/luna-secret-codex');
  const { LunaSecretCodexReading } = await import('../src/components/cinematic-games/LunaSecretCodexReading');
  for (const locale of ['en', 'ar'] as const) {
    const selection = projectLunaSecretCodex(input('LUNA-0366'), locale, true)!;
    const rendered = renderToStaticMarkup(createElement(LunaSecretCodexReading, { selection }));
    assert.match(rendered, /data-codex-value="true">[^<]+: \?\?\?<\/p>/);
    assert.doesNotMatch(rendered, /NaN/);
  }
});
