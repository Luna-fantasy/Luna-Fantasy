'use strict';
const { createHash } = require('node:crypto');
const { lstatSync, readFileSync, realpathSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { imageSize } = require('next/dist/compiled/image-size');

const idPattern = /^LUNA-\d{4}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const surfaces = new Set(['gallery', 'fantasy', 'faction', 'hero', 'mells']);
const media = Object.freeze({
  'image/png': ['png', 'png'],
  'image/jpeg': ['jpeg', 'jpg'],
  'image/webp': ['webp', 'webp'],
});

function rowMatchesExpected(id, expected, row) {
  return !!(idPattern.test(id) && expected && row && digestPattern.test(expected.sha256)
    && row.sha256 === expected.sha256 && surfaces.has(expected.surface)
    && Number.isSafeInteger(row.bytes) && row.bytes > 0
    && Number.isSafeInteger(row.width) && row.width > 0 && row.width === expected.width
    && Number.isSafeInteger(row.height) && row.height > 0 && row.height === expected.height
    && Object.hasOwn(media, row.mime));
}

function readExactSource(root, id, expected, row) {
  if (!rowMatchesExpected(id, expected, row)) throw Error('Not the locked historical revision: ' + id);
  if (!root) throw Error('LUNA_NATIVE_ART_ROOT is not configured');
  const home = realpathSync(resolve(root));
  const [ext, format] = media[row.mime];
  const folder = join(home, expected.surface);
  const target = join(folder, id + '.' + ext);
  if (!lstatSync(folder).isDirectory() || realpathSync(folder) !== folder) {
    throw Error('Artwork surface symlink or invalid directory: ' + id);
  }
  const info = lstatSync(target);
  if (info.isSymbolicLink() || realpathSync(target) !== target) throw Error('Artwork symlink is not allowed: ' + id);
  if (!info.isFile() || info.size !== row.bytes) throw Error('Artwork file or byte count did not match: ' + id);
  const image = readFileSync(target);
  if (image.length !== row.bytes || createHash('sha256').update(image).digest('hex') !== expected.sha256) {
    throw Error('Artwork SHA-256 did not match: ' + id);
  }
  const measured = imageSize(image);
  if (measured.type !== format || measured.width !== expected.width || measured.height !== expected.height) {
    throw Error('Artwork image dimensions or media type did not match: ' + id);
  }
  return image;
}

module.exports = { rowMatchesExpected, readExactSource };
