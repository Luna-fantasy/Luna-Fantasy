import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = (file) => readFileSync(new URL('../src/styles/' + file, import.meta.url), 'utf8');
const roots = css('globals.css');
function property(source, name) {
  return source.match(new RegExp('(?:^|[;{\\s])' + name + ':\\s*([^;]+);'))?.[1].trim();
}
function color(value) {
  if (value?.startsWith('var(')) return color(property(roots, value.slice(4, -1)));
  if (value === 'white') return 'ffffff';
  assert.match(value ?? '', /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i);
  const hex = value.slice(1);
  return hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
}
function luminance(hex) {
  const rgb = hex.match(/../g).map(c => parseInt(c, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
for (const [file, selector] of [
  ['bazaar-reveal.css', '.reveal-another-btn'],
  ['card-detail.css', '.card-detail-action-primary'],
  ['marketplace.css', '.listing-card-buy-btn'],
  ['marketplace.css', '.create-listing-submit'],
  ['bank.css', '.seluna-buy-btn'],
]) {
  test(selector + ' label is legible across the accent fill', () => {
    const block = css(file).split(selector + ' {')[1].split('}')[0];
    const label = luminance(color(property(block, 'color')));
    const background = property(block, 'background');
    for (const token of background.match(/var\(--accent-(?:primary|secondary)\)/g)) {
      const fill = luminance(color(token));
      const ratio = (Math.max(label, fill) + 0.05) / (Math.min(label, fill) + 0.05);
      assert.ok(ratio >= 4.5, selector + ' has contrast ' + ratio.toFixed(2) + ' on ' + token);
    }
  });
}
