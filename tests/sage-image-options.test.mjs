import test from 'node:test';
import assert from 'node:assert/strict';

const options = await import('../src/app/admin/sage/imageOptions.ts').catch(() => ({}));

test('Sage offers both current image models and all supported quality choices', () => {
  assert.ok('SAGE_IMAGE_MODELS' in options, 'Sage image options are required');
  assert.deepEqual(options.SAGE_IMAGE_MODELS.map(entry => entry.value), ['gpt-image-2.6-sunburst', 'gpt-image-2.6-flare']);
  assert.deepEqual(options.SAGE_IMAGE_QUALITIES.map(entry => entry.value), ['auto', 'low', 'medium', 'high', 'xhigh', 'max']);
});

test('Sage image quality validation accepts only supported values', () => {
  assert.ok('isSageImageQuality' in options, 'Sage image quality validation is required');
  assert.equal(options.isSageImageQuality('medium'), true);
  assert.equal(options.isSageImageQuality('max'), true);
  assert.equal(options.isSageImageQuality('ultra'), false);
  assert.equal(options.isSageImageQuality({ $ne: null }), false);
});
