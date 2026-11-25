import assert from 'node:assert/strict';
import test from 'node:test';
import {formatMembershipMonth, registeredMembership} from '../src/lib/profile-membership';

test('an absent or invalid guild membership date is never replaced with the viewing month', () => {
  for (const unknown of [undefined, null, '', '1', '2021-02-31', 'missing', '2025-55-99T00:00:00Z']) {
    assert.equal(formatMembershipMonth(unknown, 'en'), null);
    assert.equal(formatMembershipMonth(unknown, 'ar'), null);
  }
});

test('the verified guild month is localized consistently across client timezones', () => {
  const joinedAt = '2021-02-01T00:00:00.000Z';
  assert.equal(formatMembershipMonth(joinedAt, 'en'), 'February 2021');
  const arabic = formatMembershipMonth(joinedAt, 'ar');
  assert.match(arabic || '', /فبراير/);
  assert.doesNotMatch(arabic || '', /February/);
});

test('the API exposes only an identified membership source and a recorded date', () => {
  const instant = '2021-02-01T00:00:00.000Z';
  assert.deepEqual(registeredMembership('guild', instant), {source: 'guild', at: instant});
  assert.deepEqual(registeredMembership('website', new Date(instant)), {source: 'website', at: instant});
  for (const raw of [null, undefined, '1', '2021-02-31', 'bad date', 0, new Date(NaN)]) {
    assert.equal(registeredMembership('website', raw), null);
  }
});
