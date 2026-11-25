'use strict';
const expected = require('../src/lib/cinematic/native-art-expected.json');
const exact = require('../src/lib/cinematic/native-art-available.json');
const reviewed = require('../src/lib/cinematic/native-art-v19-reviewed.json');
const { readExactSource } = require('../src/lib/cinematic/native-art-exact.cjs');
const { reviewDimensions } = require('../src/lib/cinematic/reviewed-reconstruction-dimension-policy.cjs');

function assertCompleteV19ArtworkRelease() {
  const ids = Object.keys(expected);
  if (ids.length !== 796 || Object.keys(exact).length + Object.keys(reviewed).length !== ids.length) {
    throw Error('Incomplete V19 artwork manifest');
  }
  const used = new Set(Object.values(expected).map(row => row.sha256));
  for (const id of ids) {
    const original = expected[id];
    const replacement = reviewed[id];
    if (replacement) {
      if (exact[id] || replacement.historicalSha256 !== original.sha256 || used.has(replacement.sha256)
        || reviewDimensions(id, original, replacement.sha256, replacement.width, replacement.height) === undefined) {
        throw Error('Invalid V19 artwork revision: ' + id);
      }
      used.add(replacement.sha256);
    }
    readExactSource(process.env.LUNA_NATIVE_ART_ROOT, id,
      replacement ? { ...original, ...replacement } : original, replacement ?? exact[id]);
  }
}

module.exports = { assertCompleteV19ArtworkRelease };
