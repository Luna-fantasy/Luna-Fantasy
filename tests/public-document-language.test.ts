import assert from 'node:assert/strict';
import { test } from 'node:test';
import { documentLocaleForPath } from '../src/lib/document-locale';

test('the document follows the locale route segment and defaults to the English application shell', () => {
  for (const path of ['/ar', '/ar/', '/ar/story', '/ar/faq']) {
    assert.deepEqual(documentLocaleForPath(path), { lang: 'ar', dir: 'rtl' });
  }
  for (const path of [null, '/', '/en', '/en/about', '/admin', '/archives', '/auth/error']) {
    assert.deepEqual(documentLocaleForPath(path), { lang: 'en', dir: 'ltr' });
  }
});
