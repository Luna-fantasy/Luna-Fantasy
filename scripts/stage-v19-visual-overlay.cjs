'use strict';
const { createHash, randomBytes } = require('node:crypto');
const { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const { tmpdir } = require('node:os');
const { once } = require('node:events');
const { prepareVisualOverlay, missingRequiredInspectors } = require('../src/lib/cinematic/v19-visual-overlay.cjs');
const { prepareReviewedStaging } = require('./stage-reviewed-reconstructions.cjs');
const historical = require('../src/lib/cinematic/native-art-expected.json');
const exact = require('../src/lib/cinematic/native-art-available.json');

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function prepareCombinedReview(input, expected = historical, recovered = exact) {
  const data = readFileSync(input.ledger);
  if (!/^[a-f0-9]{64}$/.test(input.sha256) || sha(data) !== input.sha256) {
    throw Error('The exact reviewed reconstruction ledger SHA-256 pin is required');
  }
  const root = realpathSync(input.root);
  const stage = prepareReviewedStaging(JSON.parse(data.toString('utf8')), root, expected, recovered, true);
  return { ...stage, root };
}

function reviewedChildEnv(reviewed, parent) {
  if (!reviewed) return {};
  const path = join(parent, 'reviewed-stage.json');
  const bytes = Buffer.from(JSON.stringify(reviewed.manifest));
  writeFileSync(path, bytes, { flag:'wx', mode:0o600 });
  return {
    LUNA_DEV_RECONSTRUCTION_PREVIEW:'1',
    LUNA_DEV_RECONSTRUCTION_ROOT:reviewed.root,
    LUNA_DEV_RECONSTRUCTION_MANIFEST:path,
    LUNA_DEV_RECONSTRUCTION_MANIFEST_SHA256:sha(bytes),
    NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTORS:'1',
    NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTOR_SHA256S:JSON.stringify(Object.fromEntries(
      Object.entries(reviewed.manifest.entries).map(([id,row]) => [id,row.replacementSha256]),
    )),
  };
}

async function serve(staged, root, port, reviewed) {
  const worktree = join(__dirname, '..');
  if (readdirSync(worktree).some(name => /^\.env(?:\.|$)/.test(name) && !name.endsWith('.example'))) {
    throw Error('Use the detached worktree without .env application credentials');
  }
  const nativeRoot = process.env.LUNA_NATIVE_ART_ROOT || '';
  if (reviewed && !nativeRoot) throw Error('Set LUNA_NATIVE_ART_ROOT to the verified Artwork/raw directory for the combined preview');
  const localMongo = process.env.LUNA_QA_MONGODB_URI;
  if (localMongo && !/^mongodb:\/\/127\.0\.0\.1:[0-9]{1,5}\/[A-Za-z0-9_-]*$/.test(localMongo)) {
    throw Error('Only an explicit loopback fixture database is allowed');
  }
  const parent = mkdtempSync(join(tmpdir(), 'luna-v19-overlay-'));
  const manifest = join(parent, 'local-stage.json');
  const bytes = Buffer.from(JSON.stringify(staged));
  try {
    writeFileSync(manifest, bytes, { flag:'wx', mode:0o600 });
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|HOME|TMPDIR|TMP|TEMP|LANG|LC_.+)$/i.test(name)));
    const pins = Object.fromEntries(Object.entries(staged.entries)
      .filter(([,x]) => x.role !== 'story-cover-native')
      .map(([key,row]) => [key,row.afterSha256]));
    const app = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H','127.0.0.1','-p',String(port)], {
      cwd:worktree, stdio:'inherit', env:{
        ...env,
        NODE_ENV:'development',
        AUTH_URL:'http://127.0.0.1:' + port,
        AUTH_SECRET:randomBytes(32).toString('hex'),
        NEXT_TELEMETRY_DISABLED:'1',
        AWS_EC2_METADATA_DISABLED:'true',
        LUNA_NATIVE_ART_ROOT:nativeRoot,
        LUNA_DEV_V19_VISUAL_FIXES:'1',
        LUNA_DEV_V19_VISUAL_FIX_ROOT:root,
        LUNA_DEV_V19_VISUAL_FIX_MANIFEST:manifest,
        LUNA_DEV_V19_VISUAL_FIX_MANIFEST_SHA256:sha(bytes),
        NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIXES:'1',
        NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIX_PINS:JSON.stringify(pins),
        ...reviewedChildEnv(reviewed, parent),
        NEXT_PUBLIC_LUNA_CINEMATIC:'1',
        LUNA_GRAND_BOOK_V16:'1',
        ...(localMongo ? { MONGODB_URI:localMongo } : {}),
      },
    });
    const halt = signal => app.kill(signal);
    process.once('SIGINT', halt); process.once('SIGTERM', halt);
    try {
      const [code, signal] = await once(app, 'exit');
      if (code !== 0 && signal !== 'SIGINT' && signal !== 'SIGTERM') throw Error('Local Next development preview exited: ' + (code ?? signal));
    } finally {
      process.off('SIGINT', halt); process.off('SIGTERM', halt);
    }
  } finally {
    rmSync(parent, { recursive:true, force:true });
  }
}

function parsePreviewArgs(args) {
  const [ledger, root, approvedSha, ...flags] = args;
  const usage = 'Usage: node scripts/stage-v19-visual-overlay.cjs LEDGER ASSET_ROOT APPROVAL_SHA [--require-complete] [--serve=3095] '
    + '[--reviewed-ledger=FILE --reviewed-root=DIR --reviewed-sha256=SHA]';
  if (!ledger || !root || !approvedSha) throw Error(usage);
  const values = {};
  for (const flag of flags) {
    const option = /^(--serve|--reviewed-ledger|--reviewed-root|--reviewed-sha256)=(.+)$/.exec(flag);
    const key = option ? option[1] : flag;
    if (!option && flag !== '--require-complete') throw Error(usage);
    if (Object.hasOwn(values,key)) throw Error('Duplicate option: ' + key);
    values[key] = option ? option[2] : true;
  }
  const rawPort = values['--serve'];
  const port = rawPort !== undefined ? Number(rawPort) : undefined;
  if (port !== undefined && (!/^\d{1,5}$/.test(rawPort) || port < 1024 || port > 65535)) throw Error('Use a loopback port from 1024 to 65535');
  const reviewKeys = ['--reviewed-ledger','--reviewed-root','--reviewed-sha256'];
  const count = reviewKeys.filter(key => Object.hasOwn(values,key)).length;
  if (count !== 0 && count !== reviewKeys.length) throw Error('Supply all three reviewed reconstruction flags together');
  const reviewed = count ? { ledger:values[reviewKeys[0]], root:values[reviewKeys[1]], sha256:values[reviewKeys[2]] } : undefined;
  return { ledger, root, approvedSha, port, requireComplete:!!values['--require-complete'], reviewed };
}

async function main(args) {
  const { ledger, root, approvedSha, port, requireComplete, reviewed:input } = parsePreviewArgs(args);
  const stage = prepareVisualOverlay(readFileSync(ledger), approvedSha, root);
  const gaps = missingRequiredInspectors(stage);
  if (requireComplete && gaps.length) throw Error('Required defect inspectors are missing: ' + gaps.join(', '));
  const reviewed = input && prepareCombinedReview(input);
  const rows = Object.values(stage.entries);
  console.log(JSON.stringify({ approvalSha256: approvedSha, replacementRoles:rows.length,
    replacedIDs:[...new Set(rows.map(r=>r.id))].sort(), missingRequiredInspectors:gaps,
    protectedGrand:stage.preservedGrand,
    ...(reviewed ? { reviewedCoverage:reviewed.summary } : {}),
  }, null, 2));
  if (port !== undefined) await serve(stage, realpathSync(root), port, reviewed);
}
module.exports = { parsePreviewArgs, prepareCombinedReview, reviewedChildEnv };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
