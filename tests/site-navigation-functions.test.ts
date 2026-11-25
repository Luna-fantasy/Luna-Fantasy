import test from 'node:test';
import assert from 'node:assert/strict';
import { guestSignInHref, localeNavigationHref, publicNavigationGroups, toggleDesktopGroup } from '../src/lib/site-navigation';

test('a public login link carries the complete local return destination into the localized sign-in page', () => {
  const returnTo = '/ar/story?reading=a%2Bb&reading=b#chapter-3';
  const signIn = new URL(guestSignInHref('ar', returnTo), 'http://localhost');
  assert.equal(signIn.pathname, '/ar/auth/signin');
  assert.equal(signIn.searchParams.get('callbackUrl'), returnTo);
  assert.equal(guestSignInHref('ar', signIn.pathname + signIn.search), signIn.pathname + signIn.search);
  assert.equal(guestSignInHref('en', '/en/auth/signin'), '/en/auth/signin');
});

test('changing language retains the current chapter, repeated query parameters and encoded member identity', () => {
  assert.equal(localeNavigationHref('/story', '?edition=1&edition=2', '#chapter-3'), '/story?edition=1&edition=2#chapter-3');
  assert.equal(localeNavigationHref('/profile', '?discordId=A%2BB', ''), '/profile?discordId=A%2BB');
  assert.equal(localeNavigationHref('/', '', ''), '/');
});

test('hover followed by the first click opens a disclosure, and a second click closes it', () => {
  assert.deepEqual(toggleDesktopGroup({ group: 'world', pinned: false }, 'world'), { group: 'world', pinned: true });
  assert.deepEqual(toggleDesktopGroup(null, 'world'), { group: 'world', pinned: true });
  assert.equal(toggleDesktopGroup({ group: 'world', pinned: true }, 'world'), null);
  assert.deepEqual(toggleDesktopGroup({ group: 'games', pinned: true }, 'world'), { group: 'world', pinned: true });
});

test('desktop and mobile navigation receive the same visible groups and destinations', () => {
  const groups = publicNavigationGroups(new Set(['luna-fantasy', 'world', 'bank']), false, false);
  assert.deepEqual(groups.map(group => group.key), ['games', 'economy']);
  assert.deepEqual(groups[0].links.map(link => link.path), ['/grand-fantasy', '/faction-war']);
  assert.deepEqual(groups[1].links.map(link => link.path), ['/bazaar', '/trading']);
  const owner = publicNavigationGroups(new Set(['world', 'story']), true, true);
  assert.ok(owner.find(group => group.key === 'world')?.links.find(link => link.path === '/story'));
  assert.ok(owner.find(group => group.key === 'economy')?.links.find(link => link.path === '/marketplace'));
});
