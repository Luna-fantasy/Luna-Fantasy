'use strict';
const { createHash, randomBytes } = require('node:crypto');
const { lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve, sep } = require('node:path');
const { tmpdir } = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { imageSize } = require('next/dist/compiled/image-size');
const historical = require('../src/lib/cinematic/native-art-expected.json');
const exact = require('../src/lib/cinematic/native-art-available.json');
const { reviewDimensions } = require('../src/lib/cinematic/reviewed-reconstruction-dimension-policy.cjs');

const kind = 'luna-reviewed-reconstruction-staging-v1';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const isSha = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const isId = (value) => typeof value === 'string' && /^LUNA-\d{4}$/.test(value);

function prepareReviewedStaging(ledger, approvedRoot, expected, recovered, requireComplete = false) {
  if (!Array.isArray(ledger) || ledger.length === 0) throw Error('A nonempty authoritative reviewed reconstruction ledger is required');
  const expectedIds = Object.keys(expected).sort();
  const recoveredIds = Object.keys(recovered);
  const historicalDigests = new Set(expectedIds.map(id => expected[id].sha256));
  for (const id of recoveredIds) {
    const original = expected[id];
    const staged = recovered[id];
    if (!isId(id) || !original || staged.sha256 !== original.sha256
      || staged.width !== original.width || staged.height !== original.height) throw Error('Invalid exact historical entry: ' + id);
  }

  // Validate all approvals before touching any candidate path.
  const active = new Map();
  const used = new Set();
  for (const claim of ledger) {
    const id = claim?.id;
    if (!isId(id) || !Object.hasOwn(expected, id) || claim.origin !== 'new-reconstruction'
      || claim.status !== 'reviewed-locally-not-published') throw Error('Not an approved staging row: ' + id);
    if (active.has(id)) throw Error('Duplicate reviewed ID: ' + id);
    if (Object.hasOwn(recovered, id)) throw Error('Exact historical file already staged: ' + id);
    const locked = expected[id];
    if (!isSha(claim.historical_sha256) || claim.historical_sha256 !== locked.sha256) throw Error('Historical hash mismatch: ' + id);
    if (!isSha(claim.replacement_sha256) || historicalDigests.has(claim.replacement_sha256)
      || used.has(claim.replacement_sha256)) throw Error('Invalid or duplicate reviewed replacement hash: ' + id);
    if (!Array.isArray(claim.dimensions) || claim.dimensions.length !== 2) throw Error('Locked dimensions mismatch: ' + id);
    const [width, height] = claim.dimensions;
    const dimensionException = reviewDimensions(id, locked, claim.replacement_sha256, width, height);
    if (dimensionException === undefined) throw Error('Locked dimensions mismatch: ' + id);
    const file = typeof claim.file === 'string' ? claim.file.replace(/^luna-raw-index-check\//, '') : '';
    if (!/^[A-Za-z0-9_.\/-]+\.png$/.test(file) || file.split('/').some(p => p === '' || p === '.' || p === '..')) {
      throw Error('Invalid staged file path: ' + id);
    }
    // The path is an independent identity receipt. Check every path segment
    // before any file opens; swapping both the bytes and digest is not allowed.
    const pathIds = file.match(/(?<![A-Za-z0-9])LUNA-\d{4}(?![A-Za-z0-9])/gi) || [];
    if (!pathIds.length || pathIds.some(token => token.toUpperCase() !== id)) {
      throw Error('Staged file path must identify only ' + id);
    }
    active.set(id, { historicalSha256: locked.sha256, replacementSha256: claim.replacement_sha256,
      width, height, file, status: claim.status, ...dimensionException });
    used.add(claim.replacement_sha256);
  }

  const uncovered = expectedIds.filter(id => !Object.hasOwn(recovered, id) && !active.has(id));
  if (requireComplete && uncovered.length) throw Error('Staging coverage incomplete; uncovered: ' + uncovered.join(', '));
  const root = realpathSync(approvedRoot);
  const entries = {};
  for (const id of [...active.keys()].sort()) {
    const candidate = active.get(id);
    const path = resolve(root, candidate.file);
    if (!path.startsWith(root + sep) || realpathSync(path) !== path) throw Error('Candidate path escapes the approved root or uses a link: ' + id);
    const info = lstatSync(path);
    if (!info.isFile()) throw Error('Candidate is not a regular image file: ' + id);
    const data = readFileSync(path);
    if (data.length !== info.size || digest(data) !== candidate.replacementSha256) throw Error('Candidate bytes do not match reviewed hash: ' + id);
    const dimensions = imageSize(data);
    if (dimensions.width !== candidate.width || dimensions.height !== candidate.height || dimensions.type !== 'png') {
      throw Error('Candidate dimension or type mismatch: ' + id);
    }
    entries[id] = { ...candidate, bytes: data.length };
  }
  return { manifest: { kind, entries }, summary: { expected: expectedIds.length, exact: recoveredIds.length, reviewed: active.size, uncovered } };
}

async function serve(manifest, root, port, withInspectors) {
  const worktree = join(__dirname, '..');
  if (readdirSync(worktree).some(name => /^\.env(?:\.|$)/.test(name) && !name.endsWith('.example'))) {
    throw Error('Use the isolated worktree without local application credentials');
  }
  const rootDir = mkdtempSync(join(tmpdir(), 'luna-reviewed-stage-'));
  const path = join(rootDir, 'manifest.json');
  const data = JSON.stringify(manifest);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|HOME|TMPDIR|TMP|TEMP|LANG|LC_.+)$/i.test(name)));
  const localMongo = process.env.LUNA_QA_MONGODB_URI;
  try {
    if (localMongo && !/^mongodb:\/\/127\.0\.0\.1:[0-9]{1,5}\/[A-Za-z0-9_-]*$/.test(localMongo)) {
      throw Error('Only an explicit loopback fixture database is allowed');
    }
    writeFileSync(path, data, { flag: 'wx', mode: 0o600 });
    const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: worktree, stdio: 'inherit', env: {
        ...env,
        NODE_ENV: 'development',
        NEXT_TELEMETRY_DISABLED: '1',
        AWS_EC2_METADATA_DISABLED: 'true',
        AUTH_URL: 'http://127.0.0.1:' + port,
        AUTH_SECRET: randomBytes(32).toString('hex'),
        LUNA_NATIVE_ART_ROOT: process.env.LUNA_NATIVE_ART_ROOT || '',
        LUNA_DEV_RECONSTRUCTION_PREVIEW: '1',
        LUNA_DEV_RECONSTRUCTION_ROOT: root,
        LUNA_DEV_RECONSTRUCTION_MANIFEST: path,
        LUNA_DEV_RECONSTRUCTION_MANIFEST_SHA256: digest(data),
        ...(withInspectors ? {
          NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTORS: '1',
          NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTOR_SHA256S: JSON.stringify(Object.fromEntries(
            Object.entries(manifest.entries).map(([id, row]) => [id, row.replacementSha256]),
          )),
        } : {}),
        NEXT_PUBLIC_LUNA_CINEMATIC: '1',
        LUNA_GRAND_BOOK_V16: '1',
        ...(localMongo ? { MONGODB_URI: localMongo } : {}),
      },
    });
    const halt = (signal) => child.kill(signal);
    process.once('SIGINT', halt);
    process.once('SIGTERM', halt);
    try {
      const [code, signal] = await once(child, 'exit');
      if (code !== 0 && signal !== 'SIGINT' && signal !== 'SIGTERM') throw Error('Local development Next exited: ' + (code ?? signal));
    } finally {
      process.off('SIGINT', halt);
      process.off('SIGTERM', halt);
    }
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

async function main(args) {
  const [ledger, root, ...opts] = args;
  const ports = opts.filter(option => /^--serve=\d{1,5}$/.test(option));
  if (!ledger || !root || opts.some(option => option !== '--require-complete' && option !== '--with-inspectors' && !ports.includes(option)) || new Set(opts).size !== opts.length || ports.length > 1) {
    throw Error('Usage: node scripts/stage-reviewed-reconstructions.cjs REVIEWED_LEDGER.json APPROVED_ROOT [--require-complete] [--serve=3085 [--with-inspectors]]');
  }
  const port = ports.length ? Number(ports[0].split('=')[1]) : undefined;
  if (port !== undefined && (port < 1024 || port > 65535)) throw Error('Use a localhost port between 1024 and 65535');
  const withInspectors = opts.includes('--with-inspectors');
  if (withInspectors && !port) throw Error('--with-inspectors requires a deliberate localhost --serve port');
  if (Object.keys(historical).length !== 796) throw Error('Unexpected locked historical roster');
  const { manifest, summary } = prepareReviewedStaging(JSON.parse(readFileSync(ledger, 'utf8')), root, historical, exact, opts.includes('--require-complete'));
  console.log(JSON.stringify(summary));
  if (port) await serve(manifest, realpathSync(root), port, withInspectors);
}

module.exports = { prepareReviewedStaging };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
