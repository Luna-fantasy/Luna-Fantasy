import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(path, 'utf8');

test('cinematic shell preserves the official navigation, account controls and edit provider', () => {
  const layout = source('src/app/[locale]/layout.tsx');
  assert.match(layout, /data-luna-shell=\{cinematic \? 'cinematic' : undefined\}/);
  const nav = source('src/components/Navbar.tsx');
  for (const marker of ['<NextIntlClientProvider', '<EditModeProvider', '<EditToolbar', '<Navbar', '{children}', '<Footer config={footerConfig}']) {
    assert.ok(layout.includes(marker), marker);
  }
  for (const marker of ['useSession', 'signOut', 'NotificationBell', 'mobile-sidebar', '/api/site-tabs/state']) {
    assert.ok(nav.includes(marker), marker);
  }
});

test('shell stylesheet is confined to explicitly opted-in navigation and footer', () => {
  const css = source('src/styles/luna-cinematic-shell.css');
  for (const line of css.split('\n').map(line => line.trim())) {
    if (!line || !line.endsWith('{') || line.startsWith('@')) continue;
    assert.match(line, /^\[data-luna-shell="cinematic"\]/);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /position\s*:\s*(?:fixed|absolute)|display\s*:\s*none/);
});
