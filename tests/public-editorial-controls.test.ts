import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('editorial routes expose their visible content through a main landmark', () => {
  for (const route of ['about', 'contact', 'faq', 'privacy', 'terms', 'refund']) {
    const source = readFileSync(resolve('src/app/[locale]', route, 'page.tsx'), 'utf8');
    assert.match(source, /<main\b/, route);
  }
});

test('the attachment picker is a form-safe button and invalid fields announce their errors', () => {
  const source = readFileSync(resolve('src/app/[locale]/contact/ContactForm.tsx'), 'utf8');
  assert.match(source, /<button\s+type="button"\s+className="contact-dropzone"/);
  for (const field of ['discord', 'reason', 'area', 'message']) {
    assert.ok(source.includes('aria-invalid={errors.' + field), field);
    assert.ok(source.includes('id="contact-' + field + '-error"'), field);
  }
});
