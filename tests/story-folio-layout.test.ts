import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const css = readFileSync(join('src', 'app', '[locale]', 'story', 'FolioMotion.module.css'), 'utf8');

test('the capped book cannot consume the unused monitor width as its own gutter', () => {
  const book = Array.from(css.matchAll(/\.book\s*\{([^}]+)\}/g), rule => rule[1]).join('\n');
  assert.doesNotMatch(book, /padding[^;]*calc\(\(100%\s*-/);
  assert.match(book, /inline-size:\s*100%/);
});

test('the leaf layout responds to the book and long edited titles can wrap', () => {
  assert.match(css, /container:\s*story-book\s*\/\s*inline-size/);
  assert.match(css, /@container story-book\s*\(min-width:[^)]+\)\s*\{\s*\.spread\s*\{[^}]+grid-template-columns/);
  assert.match(css, /\.textLeaf\s*\{[^}]*overflow-wrap:\s*anywhere/);
});
