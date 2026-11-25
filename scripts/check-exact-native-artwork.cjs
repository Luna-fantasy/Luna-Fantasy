'use strict';
const { readExactSource } = require('../src/lib/cinematic/native-art-exact.cjs');
const expected = require('../src/lib/cinematic/native-art-expected.json');
const available = require('../src/lib/cinematic/native-art-available.json');

function assertCompleteNativeArtworkRelease() {
  const ids = Object.keys(expected);
  if (ids.length !== 796 || !ids.every(id => /^LUNA-\d{4}$/.test(id) && /^[0-9a-f]{64}$/.test(expected[id].sha256))) {
    throw Error('Exact-native artwork release incomplete: expected roster is invalid');
  }
  const root = process.env.LUNA_NATIVE_ART_ROOT;
  let verified = 0;
  const missing = [];
  for (const id of ids) {
    try { readExactSource(root, id, expected[id], available[id]); verified++; }
    catch { missing.push(id); }
  }
  const unexpected = Object.keys(available).some(id => !Object.hasOwn(expected, id));
  if (missing.length || unexpected) throw Error(
    'Exact-native artwork release incomplete: verified ' + verified + '/' + ids.length
    + (missing.length ? '; unavailable or invalid: ' + missing.slice(0, 8).join(', ') : '')
    + (unexpected ? '; unrecognized entries present' : '')
  );
}
module.exports = { assertCompleteNativeArtworkRelease };
if (require.main === module) assertCompleteNativeArtworkRelease();
