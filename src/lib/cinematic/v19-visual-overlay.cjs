'use strict';
// Presentation-only local proof. Never alters the exact recovery or V18 ledgers.
const { createHash } = require('node:crypto');
const { lstatSync, readFileSync, realpathSync } = require('node:fs');
const { join, resolve, sep } = require('node:path');
const { imageSize } = require('next/dist/compiled/image-size');
const exact = require('./native-art-available.json');

const kind = 'luna-v19-visual-overlay-v1';
const isSha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const digest = (data) => createHash('sha256').update(data).digest('hex');
const cardIds = new Set(['LUNA-0490', 'LUNA-0547', 'LUNA-0576', 'LUNA-0588', 'LUNA-0594',
  'LUNA-0612', 'LUNA-0618', 'LUNA-0658']);
const upgradedNativeCards = new Set(['LUNA-0547', 'LUNA-0576', 'LUNA-0588']);
const mandatoryInspectors = [...cardIds].filter(id => id !== 'LUNA-0490');
const recovered = 'exact-historical';
const reviewed = 'reviewed-reconstruction';
const presentation = 'v18-presentation';
const png = 'image/png';
const webp = 'image/webp';
const proofRoot = resolve(__dirname, '../../..');
const correctionThumb = {
  'LUNA-0547': 'bowstring-v18-15487bfce7ab-thumb.webp',
  'LUNA-0576': 'feather-qa-thumb.webp',
  'LUNA-0588': 'feather-qa-thumb.webp',
};
const previous0658 = 'f5e57a1eac8acffab07e9a125b0a0fe238b86041983eada641f13c9cecf127c6';
const historicalDigests = new Set(Object.values(exact).map(x => x.sha256));
const storyBefore = 'a5796e48084e2b47f7aa7e38dbf9b30d3951fdebc582ca88a010928a6eae675c';
const grand = [
  ['thumb', 1280, 720, '8d6db5932ac05f64a2748dfa5245e743a98bbc4dfd2962f983be993d33d69c7f'],
  ['medium', 1920, 1080, '8091253aa70b348e2a58d08ebef7a88c09f383261f241a916599552a2f6b37ce'],
  ['detail', 3840, 2160, 'bf0280e33d7dd6261ca14df3a48d021898fe69651cc1c139c59fd03686a36330'],
];
const rowFields = ['id','role','sourceScope','beforeSha256','afterSha256','width','height','mime','file'];
const isRecord = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const hasFields = (v, names) => isRecord(v) && Object.keys(v).length === names.length && names.every(name => Object.hasOwn(v, name));
const mimeExt = (mime) => ({ [png]:'png', [webp]:'webp' })[mime];
const sizeOK = (data, mime, width, height) => {
  const im = imageSize(data);
  return im.width === width && im.height === height && im.type === mimeExt(mime);
};

function publicBaseline(file, mime, width, height, pinnedSha, worktree) {
  const data = readFileSync(join(worktree, 'public', file));
  const sha256 = digest(data);
  if (!sizeOK(data, mime, width, height) || (pinnedSha && pinnedSha !== sha256)) {
    throw Error('Pinned V18 presentation asset changed: ' + file);
  }
  return { file, sha256, width, height, mime };
}
function approvedGrandPoster(worktree) {
  return grand.map(([tier,width,height,sha]) => ({ id:'LUNA-0797', role:'grand-poster-' + tier,
    ...publicBaseline('luna-v16/grand/artwork/hero/LUNA-0797/' + tier + '.webp', webp, width, height, sha, worktree),
    disposition:'keep-approved-v18-presentation',
  }));
}

function scopedRole(id, role) {
  return (cardIds.has(id) && (role === 'card-inspector' || role === 'card-thumb'))
    || (id === 'LUNA-0803' && (role === 'story-cover' || role === 'story-cover-native'));
}

function roleBaseline(id, role, worktree) {
  if (cardIds.has(id) && role === 'card-inspector') {
    if (id === 'LUNA-0658') return { sha256: previous0658, width:1024, height:1536, mime:png, sourceScope:reviewed };
    return { ...exact[id], sourceScope:recovered };
  }
  if (cardIds.has(id) && role === 'card-thumb') {
    return { ...publicBaseline('luna-cinematic/cards/faction/' + id + '/' + (correctionThumb[id] || 'thumb.webp'),
      webp, 320, 480, undefined, worktree), sourceScope:presentation };
  }
  if (id === 'LUNA-0803' && role === 'story-cover-native') return { ...exact[id], sourceScope:recovered };
  if (id === 'LUNA-0803' && role === 'story-cover') {
    return { ...publicBaseline('luna-cinematic/home-story/story/champion-remastered.webp',
      webp, 1536, 1024, storyBefore, worktree), sourceScope:presentation };
  }
  throw Error('Outside V19 ID/role scope (Grand poster is preserve-only): ' + id + '/' + role);
}

function normalizeFile(file, id, mime) {
  if (typeof file !== 'string' || !/^[A-Za-z0-9._/-]{1,360}$/.test(file) || !file.endsWith('.' + mimeExt(mime))
    || file.split('/').some(v => !v || v === '.' || v === '..')) throw Error('Invalid candidate file path: ' + id);
  const ids = file.match(/(?<![A-Za-z0-9])LUNA-\d{4}(?![A-Za-z0-9])/gi) || [];
  if (!ids.length || ids.some(v => v.toUpperCase() !== id)) throw Error('Candidate file path has the wrong ID identity: ' + id);
  return file;
}

function readCandidate(root, row, bytes) {
  const path = resolve(root, normalizeFile(row.file, row.id, row.mime));
  if (!path.startsWith(root + sep) || realpathSync(path) !== path) throw Error('Candidate path escapes approved root or uses a link');
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size <= 0 || stat.size > 32 * 1024 * 1024 || (bytes !== undefined && stat.size !== bytes)) {
    throw Error('Missing candidate or invalid byte count');
  }
  const data = readFileSync(path);
  if (data.length !== stat.size || digest(data) !== row.afterSha256) throw Error('Candidate after hash mismatch');
  if (!sizeOK(data, row.mime, row.width, row.height)) throw Error('Candidate dimensions or media type mismatch');
  return data;
}

function prepareVisualOverlay(data, approvalSha256, candidateRoot, worktree = proofRoot) {
  if (!Buffer.isBuffer(data) || data.length > 64 * 1024 || !isSha(approvalSha256) || digest(data) !== approvalSha256) {
    throw Error('The exact V19 approval ledger SHA-256 is required');
  }
  const ledger = JSON.parse(data.toString('utf8'));
  if (!hasFields(ledger, ['schema','base','rows']) || ledger.schema !== kind || ledger.base !== 'V18'
    || !Array.isArray(ledger.rows) || ledger.rows.length > cardIds.size * 2 + 2) throw Error('Invalid V19 approval ledger schema');
  const entries = {}, hashes = new Set();
  for (const item of ledger.rows) {
    if (!hasFields(item, rowFields)) throw Error('Invalid V19 replacement row fields');
    const { id, role, sourceScope, beforeSha256, afterSha256, height, width, mime } = item;
    const baseline = roleBaseline(id, role, worktree);
    const key = id + '/' + role;
    if (Object.hasOwn(entries, key)) throw Error('Duplicate V19 role: ' + key);
    if (sourceScope !== baseline.sourceScope) throw Error('Wrong V18 source scope: ' + key);
    if (beforeSha256 !== baseline.sha256) throw Error('Incorrect V18 before hash: ' + key);
    if (!isSha(afterSha256) || afterSha256 === beforeSha256 || historicalDigests.has(afterSha256)
      || hashes.has(afterSha256)) throw Error('After hash is not a new unique visual replacement: ' + key);
    const nativeUpgrade = role === 'card-inspector' && upgradedNativeCards.has(id);
    const allowedWidth = nativeUpgrade ? 1024 : baseline.width, allowedHeight = nativeUpgrade ? 1536 : baseline.height;
    if (width !== allowedWidth || height !== allowedHeight || mime !== baseline.mime) throw Error('Locked dimensions or media mismatch: ' + key);
    normalizeFile(item.file, id, mime);
    entries[key] = { ...item };
    hashes.add(afterSha256);
  }
  const preservedGrand = approvedGrandPoster(worktree);
  const root = realpathSync(candidateRoot);
  for (const entry of Object.values(entries)) entry.bytes = readCandidate(root, entry).length;
  return { kind, base:'V18', approvalSha256, entries, preservedGrand };
}

function readOverlayImage(root, manifest, id, role, sha) {
  if (!root || manifest?.kind !== kind || manifest.base !== 'V18' || !isSha(sha)
    || !scopedRole(id, role)
    || !Object.hasOwn(manifest.entries || {}, id + '/' + role)) return;
  const row = manifest.entries[id + '/' + role];
  if (row?.id !== id || row.role !== role || row.afterSha256 !== sha || !Number.isSafeInteger(row.bytes)) return;
  try { return readCandidate(realpathSync(root), row, row.bytes); }
  catch { return; }
}

function missingRequiredInspectors(manifest) {
  return mandatoryInspectors.filter(id => !Object.hasOwn(manifest.entries, id + '/card-inspector'));
}

module.exports = { prepareVisualOverlay, readOverlayImage, missingRequiredInspectors };

function readPinnedStage(path, sha) {
  if (!path || !isSha(sha)) return;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 128 * 1024) return;
    const content = readFileSync(path);
    if (content.length !== stat.size || digest(content) !== sha) return;
    const stage = JSON.parse(content.toString('utf8'));
    if (stage.kind !== kind || stage.base !== 'V18' || !isSha(stage.approvalSha256)
      || !isRecord(stage.entries) || Object.keys(stage.entries).length > cardIds.size * 2 + 2) return;
    return stage;
  } catch { return; }
}

function serveVisualOverlay(request, { id, role, digest: requested }, env) {
  const headers = { 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow, noarchive' };
  const absent = () => new Response(null, { status:404, headers });
  if (env.NODE_ENV !== 'development' || env.LUNA_DEV_V19_VISUAL_FIXES !== '1') return absent();
  const host = new URL(request.url).hostname;
  if (!['127.0.0.1','localhost','[::1]'].includes(host) || !isSha(requested)) return absent();
  const stage = readPinnedStage(env.LUNA_DEV_V19_VISUAL_FIX_MANIFEST, env.LUNA_DEV_V19_VISUAL_FIX_MANIFEST_SHA256);
  const bytes = readOverlayImage(env.LUNA_DEV_V19_VISUAL_FIX_ROOT, stage, id, role, requested);
  if (!bytes) return absent();
  const row = stage.entries[id + '/' + role];
  return new Response(new Uint8Array(bytes), { headers: {
    ...headers, 'Content-Type':row.mime, 'Content-Length':String(bytes.length),
    'X-Content-Type-Options':'nosniff', 'X-Luna-Artwork-Provenance':'v19-visual-correction-not-historical',
  }});
}

module.exports.serveVisualOverlay = serveVisualOverlay;
