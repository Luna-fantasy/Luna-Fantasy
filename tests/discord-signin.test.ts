import assert from 'node:assert/strict';
import test from 'node:test';
import { discordOAuthCredentials, guestSignInDestination, signInReturnPath } from '../src/lib/discord-signin';

test('guests can return to a public page without looping through private account gates', () => {
  assert.equal(guestSignInDestination('/ar/story/?edition=one&edition=two#chapter-3', 'ar'), '/ar/story/?edition=one&edition=two#chapter-3');
  assert.equal(guestSignInDestination('/en/profile/', 'en'), '/en/');
  assert.equal(guestSignInDestination('/ar/profile/?discordId=123456789012345678', 'ar'), '/ar/profile/?discordId=123456789012345678');
});

test('Discord is offered only with a numeric application ID and its server-side secret', () => {
  for (const env of [
    {}, { AUTH_DISCORD_ID: 'undefined', AUTH_DISCORD_SECRET: 'test-secret' },
    { AUTH_DISCORD_ID: '123456789012345678' }, { AUTH_DISCORD_SECRET: 'test-secret' },
    { AUTH_DISCORD_ID: '123456789012345678', AUTH_DISCORD_SECRET: '   ' },
  ]) {
    assert.equal(discordOAuthCredentials(env), null);
  }
  assert.deepEqual(discordOAuthCredentials({
    AUTH_DISCORD_ID: '123456789012345678', AUTH_DISCORD_SECRET: 'test-secret',
  }), { clientId: '123456789012345678', clientSecret: 'test-secret' });
});

test('sign-in restores the requested Luna route including its query and fragment', () => {
  assert.equal(signInReturnPath('/ar/trading/?tab=offers#desk', 'ar'), '/ar/trading/?tab=offers#desk');
  assert.equal(signInReturnPath('http://localhost:3097/en/profile/?view=cards', 'ar', 'http://localhost:3097'), '/en/profile/?view=cards');
  assert.equal(signInReturnPath(undefined, 'ar'), '/ar/');
  assert.equal(signInReturnPath('/en/auth/signin/?error=Configuration', 'en'), '/en/');
  assert.equal(signInReturnPath('/api/auth/signin/discord', 'ar'), '/ar/');
  assert.equal(signInReturnPath('https://example.org/en/profile/', 'ar', 'http://localhost:3097'), '/ar/');
  assert.equal(signInReturnPath('//example.org/', 'en'), '/en/');
});
