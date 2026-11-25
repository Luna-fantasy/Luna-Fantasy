import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MissingRoute } from '../src/components/MissingRoute';

test('both localized missing pages expose readable copy and a matching recovery URL',()=>{
  for (const locale of ['en','ar']) {
    const document = renderToStaticMarkup(createElement(MissingRoute,{locale}));
    assert.ok(document.includes('href="/'+locale+'"'));
    assert.ok(document.includes('lang="'+locale+'"'));
    assert.ok(document.includes(locale==='ar'?'الصفحة غير موجودة':'Page not found'));
    assert.ok(document.includes(locale==='ar'?'dir="rtl"':'dir="ltr"'));
  }
});

test('localized unknown paths call the real not-found boundary and private profile redirects preserve locale',()=>{
  const read = (file: string) => readFileSync(path.join('src','app','[locale]',file),'utf8');
  assert.match(read('[...unmatched]/page.tsx'),/notFound\(\)/);
  const profile = read('profile/page.tsx');
  assert.ok(profile.includes("redirect('/' + locale + '/auth/signin/?'"));
  assert.ok(profile.includes("new URLSearchParams({ callbackUrl: '/' + locale + '/profile/' })"));
  assert.ok(profile.indexOf('if (discordId)')<profile.indexOf('await auth()'));
});
