import test from 'node:test';
import assert from 'node:assert/strict';
import { getGifRoles, isSageMediaRoleList } from '../src/app/admin/sage/mediaRoles.ts';

test('GIF roles inherit the existing image list until explicitly configured', () => {
  const image = ['123456789012345678'];
  assert.deepEqual(getGifRoles({ image_gen_roles: image }), image);
  assert.deepEqual(getGifRoles({ image_gen_roles: image, gif_gen_roles: [] }), []);
  assert.deepEqual(getGifRoles({ image_gen_roles: image, gif_gen_roles: null }), image);
  assert.deepEqual(getGifRoles({ image_gen_roles: image, gif_gen_roles: ['223456789012345678'] }), ['223456789012345678']);
});

test('dashboard accepts only bounded lists of Discord role identifiers', () => {
  assert.equal(isSageMediaRoleList([]), true);
  assert.equal(isSageMediaRoleList(['123456789012345678']), true);
  assert.equal(isSageMediaRoleList({ $ne: null }), false);
  assert.equal(isSageMediaRoleList([{}]), false);
  assert.equal(isSageMediaRoleList(['not-a-role']), false);
  assert.equal(isSageMediaRoleList(Array(101).fill('123456789012345678')), false);
});
