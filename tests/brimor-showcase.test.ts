import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { archiveRoleSwatches, displayRoleColors, sortRoleStock } from '../src/lib/bazaar/brimor-showcase';

test('the reviewed Brimor catalogue preserves all sixteen names and historic reference prices', () => {
  assert.equal(archiveRoleSwatches.length, 16);
  assert.deepEqual(archiveRoleSwatches.map(role => role.name).slice(6, 10), ['Emerald', 'Opal', 'Ruby', 'Diamond']);
  assert.equal(archiveRoleSwatches[0].price, 250000);
  assert.equal(archiveRoleSwatches.at(-1)?.price, 1500000);
  assert.ok(archiveRoleSwatches.every(role => !('roleId' in role)));
});

test('stock is sorted by real price, preserves merchant order for ties and keeps each original ID', () => {
  const items = [{ id: 'later', price: 400 }, { id: 'first', price: 20 }, { id: 'second', price: 20 }];
  assert.deepEqual(sortRoleStock(items).map(item => item.id), ['first', 'second', 'later']);
  assert.equal(items[0].id, 'later');
  assert.deepEqual(sortRoleStock([]), []);
});

test('role previews preserve individual colours and reject invalid CSS colour values', () => {
  assert.deepEqual(displayRoleColors(['#abc']), ['#abc']);
  assert.deepEqual(displayRoleColors(['#846c44', 'broken', '#696969', '#12345']), ['#846c44', '#696969']);
  assert.deepEqual(displayRoleColors(undefined), []);
});
