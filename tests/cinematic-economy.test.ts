import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (path: string) => readFileSync(path, 'utf8');
const root = 'src/app/[locale]';
const bank = `${root}/bank/BankContent.tsx`;
const bazaar = `${root}/bazaar/BazaarContent.tsx`;
const merchant = `${root}/bazaar/[merchant]/MerchantPage.tsx`;
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

test('Bank, Bazaar, and Mells show their approved cinematic scenes without changing data providers', () => {
  assert.match(read(bank), /cinematic-economy-hero--bank/);
  assert.match(read(bazaar), /cinematic-economy-hero--bazaar/);
  assert.match(read(merchant), /cinematic-economy-hero--merchant/);
  assert.match(read(merchant), /cinematicMerchantHero\(merchant\)/);
  assert.match(read(bank), /const \{ data: bankData, isLoading, error, refetch \} = useBankData\(\)/);
  assert.match(read(bank), /<BankDashboard bankData=\{bankData\}/);
  assert.match(read(bazaar), /fetch\('\/api\/bazaar\/catalog'\)/);
  assert.match(read(merchant), /fetch\('\/api\/bazaar\/catalog'\)/);
  assert.match(read(merchant), /<VendorMells/);
  for (const role of ['vault', 'ledger', 'seal']) {
    assert.ok(read(bank).includes('<BankArt role="' + role + '"'), 'bank ' + role);
  }
  assert.match(read(bazaar), /<BazaarOverlay scene="hub"/);
  assert.match(read(bazaar), /cinematicMerchantHero\(merchant\.slug\)/);
  assert.match(read(merchant), /<BazaarOverlay scene=\{merchant\}/);
  assert.match(read(merchant), /<MerchantSequence merchant=\{merchant\}/);
  assert.match(read(merchant), /catalog\?\.merchants\?\.\[merchant\] \?\? config\.image/);
});

test('Bank displays the localized historic-sample note on both original paper and zoom, without hardcoding a loan limit', () => {
  const rendered = read(bank);
  assert.match(rendered, /Historical sample\. Not current loan terms\./);
  assert.match(rendered, /نموذج تاريخي، وليس شروط القرض الحالية\./);
  assert.match(rendered, /data\.loans\.tiers\.map\(/);
  assert.match(rendered, /<p className="cinematic-bank-contract-note"[^>]*>\{loanSampleNote\}<\/p>/);
  assert.match(rendered, /<Lightbox[^>]+title=\{loanSampleNote\}/);
  assert.match(rendered, /EImg editId="bank-loan-contract" src="\/images\/loan_contract\.png"/);
});

test('Each admitted visual is the same as the approved release source', () => {
  const assets = {
    'bank.webp': 'd03def879f37a8ad535b435e33700d67d4039eb15070d87198d1971e79ab5f4a',
    'bazaar.webp': 'e63e39674f6980070f0541926a1b99b12c137f66564de1b589b00ad4bff80d4d',
    'kael.webp': '66379d335df9b91f33221e57a1d6c871987e031df21ac1c8e7f5b7bd5ef85658',
    'meluna.webp': '41d48c81124886f55d3571b511fd1597b8e7806df5e2e60dae17e4c4c9d4fda1',
    'zoldar.webp': '8abf21e7921ef409d18a8d202260f77309f883c6b099ff6604e15a2e8d599809',
    'seluna.webp': '2f4eb8372be6d04a782924a552104dd3e0ade6d0654910d2665c76bfcc494c28',
    'brimor.webp': '833dd6537a84fa0c78a5cf4a40ee54d8495abca6447cdbc9d225cc8f05f09210',
    'mells.webp': '011f43667535556810e5359e9ee8859d61381bfef78fa796369439698879ad85',
    'meluna-specimens.webp': 'be45525bb22cba79bc0926e854b9440d2cc7c3b685e9bab2a9f46999a06c037f',
    'brimor-loom.webp': '261138051660952a3ae4b866b239d1260173f8e16409b9ad36b49cdfa485a571',
    'bank-exterior.webp': '779e3f8ea2834b3a14f0f14bb4df7695a1442d679a5478262bf53f133f6c90ee',
    'bank-salary.webp': 'b5f8c574b4c8064153ea8e55d37264b663928dc092653ba574effa5218dc9fb2',
  };
  for (const [target, expected] of Object.entries(assets)) {
    const path = 'public/luna-cinematic/economy/' + target;
    assert.ok(existsSync(path), target + ' must exist in the review package');
    assert.equal(sha(path), expected, target);
  }
  assert.match(read('src/styles/luna-cinematic-economy.css'), /prefers-reduced-motion:\s*reduce/);
});
