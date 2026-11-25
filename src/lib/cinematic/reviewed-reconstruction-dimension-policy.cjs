'use strict';

// This is only the reviewed-dev policy. The exact historical verifier does not import it.
function reviewDimensions(id, history, candidateSha256, width, height) {
  if (width === history.width && height === history.height) return null;
  if (id !== 'LUNA-0150' || history.sha256 !== 'a4887ec7aaaf1908b5f2f5258650fa3af180a851737689019ea10b548260a4ea'
    || candidateSha256 !== 'e7a2360e8026ee04092c5857d53e483be7900a14337f1d67ba9420f022b6c776'
    || history.width !== 1025 || history.height !== 1535 || width !== 1024 || height !== 1536) return;
  return {
    historicalWidth: 1025,
    historicalHeight: 1535,
    dimensionNote: 'LUNA-0150 native tool grid; no scaling or upscale',
  };
}
module.exports = { reviewDimensions };
