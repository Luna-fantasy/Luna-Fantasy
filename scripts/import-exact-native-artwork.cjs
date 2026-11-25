'use strict';
const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, renameSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { rowMatchesExpected, readExactSource } = require('../src/lib/cinematic/native-art-exact.cjs');
const roster = require('../src/lib/cinematic/native-art-expected.json');
const mimeByFormat = Object.freeze({ PNG: 'image/png', JPEG: 'image/jpeg', WEBP: 'image/webp' });

function validateStagedLedger(ledger, rawRoot, expected) {
  const pending = new Map();
  for (const [lineIndex, line] of ledger.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let item;
    try { item = JSON.parse(line); }
    catch { throw Error('Invalid recovery JSON line ' + (lineIndex + 1)); }
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Invalid recovery row ' + (lineIndex + 1));
    if (Object.hasOwn(item, 'replacement') || Object.hasOwn(item, 'replacementSha256') || Object.hasOwn(item, 'approval')) {
      throw Error('Replacement rows are ineligible for an exact-native import');
    }
    const { id, surface, revision, sha256, width, height, bytes, format } = item;
    if (typeof id !== 'string' || !Object.hasOwn(expected, id)) throw Error('Not the locked historical revision: ' + id);
    if (pending.has(id)) throw Error('Duplicate ID in exact-native recovery: ' + id);
    const locked = expected[id];
    const mime = Object.hasOwn(mimeByFormat, format) ? mimeByFormat[format] : undefined;
    const row = { sha256, bytes, width, height, mime };
    if (!rowMatchesExpected(id, locked, row) || locked.surface !== surface || locked.revision !== revision) {
      throw Error('Not the locked historical revision: ' + id);
    }
    // The recovery ledger's workspace path is descriptive only; the serving path
    // is derived under the configured raw root from the immutable surface and ID.
    pending.set(id, row);
  }
  const available = {};
  const summary = { count: pending.size, expected: Object.keys(expected).length, bytes: 0, bySurface: {} };
  for (const id of Array.from(pending.keys()).sort()) {
    const row = pending.get(id);
    const locked = expected[id];
    readExactSource(rawRoot, id, locked, row);
    available[id] = row;
    summary.bytes += row.bytes;
    summary.bySurface[locked.surface] = (summary.bySurface[locked.surface] || 0) + 1;
  }
  return { available, summary };
}

function compactRoster(rows) {
  return '{\n' + Object.entries(rows).map(([key, row]) => '  ' + JSON.stringify(key) + ': ' + JSON.stringify(row)).join(',\n') + '\n}\n';
}

function main(args, rawRoot) {
  const [ledger, action, ...extra] = args;
  if (!ledger || extra.length || (action !== undefined && action !== '--write') || !rawRoot) {
    throw Error('Usage: LUNA_NATIVE_ART_ROOT=/absolute/approved/raw node scripts/import-exact-native-artwork.cjs PATH_TO_LEDGER.jsonl [--write]');
  }
  if (Object.keys(roster).length !== 796) throw Error('Historical release roster must contain exactly 796 IDs');
  const result = validateStagedLedger(readFileSync(ledger, 'utf8'), rawRoot, roster);
  if (action === '--write') {
    const target = join(__dirname, '../src/lib/cinematic/native-art-available.json');
    const tmp = target + '.' + randomBytes(8).toString('hex') + '.stage';
    try { writeFileSync(tmp, compactRoster(result.available), { flag: 'wx' }); renameSync(tmp, target); }
    finally { rmSync(tmp, { force: true }); }
  }
  console.log(JSON.stringify({ ...result.summary, written: action === '--write' }));
}
module.exports = { validateStagedLedger };
if (require.main === module) {
  try { main(process.argv.slice(2), process.env.LUNA_NATIVE_ART_ROOT); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
