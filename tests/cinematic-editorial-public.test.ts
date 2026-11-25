import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'src/app/[locale]';
const names = ['about','contact','faq','terms','privacy','refund','trading'] as const;
const src = (f: string) => readFileSync(f,'utf8');

test('all seven pages mount their own editorial motif and the Trading page still has its server guard', () => {
  for(const page of names){
    const file = page==='trading'?'TradingContent.tsx':'page.tsx';
    const text = src(`${base}/${page}/${file}`);
    assert.match(text,new RegExp(`<EditorialMotif motif="${page}"`));
  }
  assert.match(src(`${base}/trading/page.tsx`),/<TabGuard tabKey="trading">/);
});

test('only downloaded approved art is shipped and no mock trading is introduced', () => {
  const p = 'public/luna-cinematic/editorial-public/trading.webp';
  assert.ok(existsSync(p),p);
  const art = readFileSync(p);
  assert.equal(createHash('sha256').update(art).digest('hex'), '275239fbff7e35db0dcf2f65c6348ed2eb7f8658e71c914a1ce1d1e2ed292bec');
  const trader = src(`${base}/trading/TradingContent.tsx`);
  assert.equal((trader.match(/fetch\('\/api\/bank\/trade'/g)||[]).length,2);
  assert.match(trader, /new URLSearchParams\(\{ callbackUrl: pathname \+ search \+ hash \}\)/);
  assert.ok(trader.includes('window.location.assign(`/${locale}/auth/signin/?${callback}`)'));
  const signInPage = src(`${base}/auth/signin/page.tsx`);
  assert.match(signInPage, /signInReturnPath\(callback, locale,/);
  assert.match(signInPage, /returnPath=\{returnPath\}/);
  const signInContent = src(`${base}/auth/signin/SignInContent.tsx`);
  assert.match(signInContent, /signIn\('discord',\s*\{\s*redirectTo:\s*returnPath\s*\}\)/);
  assert.doesNotMatch(trader,/Preview only|Trading is disabled|sample trading/);
});

test('decoration is aria-hidden and idempotent under route teardown', () => {
  const art = src(`${base}/cinematic-editorial/EditorialMotif.tsx`);
  assert.match(art,/aria-hidden="true"/);
  assert.match(art,/return mountEditorialMotif\(/);
  const runtime = src('src/lib/cinematic/editorial-public.js');
  assert.match(runtime,/AbortController/);
  assert.match(runtime,/cancelAnimationFrame/);
  assert.match(runtime,/disconnect\(/);
  assert.doesNotMatch(runtime,/document\.body|innerHTML|localStorage|fetch\(/);
});
