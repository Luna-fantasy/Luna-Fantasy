import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotGuestCatalog, readGuestCatalog } from '../src/lib/bazaar/public-catalog-snapshot';

const stock = {
  luckboxTiers: [{ tier: 'common', price: 90 }],
  stoneBox: { price: 100 },
  ticketPackages: [],
  lunariPackages: [],
  merchants: { kael: '/example.webp' },
};

test('a cached guest catalogue contains public stock only', () => {
  const input = { ...stock, user: { balance: 7000, hasPassport: true }, session: 'fixture-only' };
  const snapshot = snapshotGuestCatalog(input, 160);
  input.stoneBox = { price: 9999 };
  assert.deepEqual(JSON.parse(readGuestCatalog(snapshot, 159)!), stock);
});

test('an absent or expired guest catalogue cannot satisfy another request', () => {
  assert.equal(readGuestCatalog(undefined, 100), null);
  const snapshot = snapshotGuestCatalog(stock, 160);
  assert.equal(readGuestCatalog(snapshot, 160), null);
  assert.equal(readGuestCatalog(snapshot, 161), null);
});
