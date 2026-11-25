import assert from 'node:assert/strict';
import test from 'node:test';
import { changedPassportCosmetics, DEFAULT_PASSPORT_MERCHANT, type PassportCosmetics } from '../src/lib/admin/passport-cosmetics';
import { validateButlerConfig } from '../src/lib/admin/config-validation';

const baseline: PassportCosmetics = {
  passport_vip_roles: ['900000000000000001'],
  passport_staff_roles: { mastermind: ['900000000000000002'], sentinel: [], guardian: [] },
  merchantPhotoUrl: '',
};

test('saving or undoing a portrait edit leaves every role out of the write', () => {
  const portrait = 'https://assets.lunarian.app/test/portrait.png';
  const next = { ...baseline, merchantPhotoUrl: portrait };
  assert.deepEqual(changedPassportCosmetics(baseline, next), { portrait });
  assert.deepEqual(changedPassportCosmetics(next, baseline), { portrait: DEFAULT_PASSPORT_MERCHANT });
  assert.deepEqual(changedPassportCosmetics(baseline, { ...baseline, merchantPhotoUrl: DEFAULT_PASSPORT_MERCHANT }), {});
});

test('multiple edits include only their changed fields and accept an explicit empty role list', () => {
  const sentinel = ['900000000000000003'];
  const next = { ...baseline, passport_vip_roles: [], passport_staff_roles: { ...baseline.passport_staff_roles, sentinel } };
  const patch = changedPassportCosmetics(baseline, next);
  assert.deepEqual(patch, { vip: [], sentinel });
  assert.ok(!validateButlerConfig('passport_cosmetics', patch));
  for (const invalid of [{}, { enabled: false }, { sentinel: 'Guardian' }, { portrait: 'invalid' }]) {
    assert.ok(validateButlerConfig('passport_cosmetics', invalid));
  }
});
