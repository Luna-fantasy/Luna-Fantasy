import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lightbox } from '../src/components/Lightbox';
import { readFileSync } from 'node:fs';

test('the public card viewer exposes a named modal and keyboard-visible close control', () => {
  const props = { isOpen:true, imageSrc:'/example.webp', alt:'Card art', title:'Approved card', onClose(){} };
  const html = renderToStaticMarkup(createElement(Lightbox,props));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-label="Approved card"/);
  assert.match(html, /<button[^>]*aria-label="Close preview"/);
});

test('closing the viewer restores the previous body overflow and opening control focus', () => {
  const src = readFileSync('src/components/Lightbox.tsx','utf8');
  assert.match(src, /const previousOverflow = document\.body\.style\.overflow/);
  assert.match(src, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(src, /opener\.focus\(\{ preventScroll: true \}\)/);
  assert.match(src, /\}, \[isOpen\]\)/);
});

test('a recovered native URL can be retried when an inspector is reopened', () => {
  const src = readFileSync('src/components/Lightbox.tsx','utf8');
  assert.match(src, /if \(!isOpen\) \{\s*setFailedNative\(undefined\);\s*setFailedVisualFix\(undefined\);\s*return;/);
});
