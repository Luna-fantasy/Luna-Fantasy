import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { linkArtworkFixture } from './helpers/artwork-link';

const imported = '../src/lib/cinematic/v19-visual-overlay.cjs';
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const A = 'LUNA-0547', B = 'LUNA-0576', GRAND = 'LUNA-0797';
const priorA = '15487bfce7ab51f09fb8238a7ee757d8b1664fae8ea6fdef5bf9c4ee81c4ba8f';
const priorB = '9b2fe6722563e8d2e5a99b484f820c562c021f69bb3f86fd47f7df8987b5bdd1';
function chunk(name: string, data: Buffer) {
  const label = Buffer.concat([Buffer.from(name), data]);
  const length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let x = 0xffffffff;
  for (let i=0;i<label.length;i++) {
    const n = label[i];
    x ^= n;
    for (let bit = 0; bit < 8; bit++) x = (x >>> 1) ^ ((x & 1) ? 0xedb88320 : 0);
  }
  crc.writeUInt32BE((x ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, label, crc]);
}
function fixture(gray: number, width = 1024, height = 1536) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4); ihdr[8]=8;
  const rows = Buffer.alloc((width+1)*height,gray);
  for(let y=0;y<height;y++) rows[y*(width+1)] = 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'), chunk('IHDR',ihdr),
    chunk('IDAT',deflateSync(rows)), chunk('IEND',Buffer.alloc(0))]);
}
const donorA = fixture(21), donorB = fixture(49);
const cardA = { id: A, role: 'card-inspector', sourceScope: 'exact-historical', beforeSha256: priorA,
  afterSha256: sha(donorA), width: 1024, height: 1536, mime: 'image/png', file: A + '-test.png' };
const cardB = { ...cardA, id: B, beforeSha256: priorB, afterSha256: sha(donorB), file: B + '-test.png' };
const packet = (rows: unknown[]) => Buffer.from(JSON.stringify({ schema: 'luna-v19-visual-overlay-v1', base: 'V18', rows }));

test('authorized V19 bytes match only their ID, digest and role; corrected Grand responsive assets remain preserved', async (t) => {
  const m = await import(imported);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'luna-v19-green-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, cardA.file), donorA);
  const d = packet([cardA]);
  const staged = m.prepareVisualOverlay(d, sha(d), root);
  assert.deepEqual(Object.keys(staged.entries), [A + '/card-inspector']);
  assert.equal(staged.preservedGrand.length, 3);
  assert.equal(staged.preservedGrand.find((r: { role: string }) => r.role === 'grand-poster-detail').sha256,
    'bf0280e33d7dd6261ca14df3a48d021898fe69651cc1c139c59fd03686a36330');
  assert.deepEqual(m.readOverlayImage(root, staged, A, 'card-inspector', cardA.afterSha256), donorA);
  assert.equal(m.readOverlayImage(root, staged, B, 'card-inspector', cardA.afterSha256), undefined);
  assert.equal(m.readOverlayImage(root, staged, A, 'card-thumb', cardA.afterSha256), undefined);
  assert.equal(m.readOverlayImage(root, staged, A, 'card-inspector', priorA), undefined);
  writeFileSync(join(root, cardA.file), donorB);
  assert.equal(m.readOverlayImage(root, staged, A, 'card-inspector', cardA.afterSha256), undefined);
});

test('V19 import rejects unpinned packs, stale or mis-role IDs, swaps, extra fields, forged dimensions, and symlinks', async (t) => {
  const m = await import(imported);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'luna-v19-negative-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, cardA.file), donorA);
  writeFileSync(join(root, cardB.file), donorB);
  const stage = (rows: unknown[]) => { const d = packet(rows); return m.prepareVisualOverlay(d, sha(d), root); };
  assert.throws(() => m.prepareVisualOverlay(packet([cardA]), '0'.repeat(64), root), /approval/i);
  assert.throws(() => stage([{ ...cardA, beforeSha256: '1'.repeat(64) }]), /base|before/i);
  assert.throws(() => stage([{ ...cardA, id: 'LUNA-0548', file: 'LUNA-0548.png' }]), /role|scope/i);
  assert.throws(() => stage([{ ...cardA, id: GRAND, role: 'grand-poster-detail', file: GRAND + '.png' }]), /role|scope|preserve/i);
  assert.throws(() => stage([{ ...cardA, width: 1280, height: 1920 }]), /dimension/i);
  assert.throws(() => stage([{ ...cardA, width:640, height:960 }]), /dimension/i);
  assert.throws(() => stage([{ ...cardA, id:'LUNA-0594', file:'LUNA-0594-test.png', width:640, height:960,
    beforeSha256:'5d9093d91162114d949d3201c8fd5aab0a8a5659f84d513d8161172181234e6d' }]), /dimension/i);
  assert.throws(() => stage([{ ...cardA, sourceScope: 'reviewed-reconstruction' }]), /source|scope/i);
  assert.throws(() => stage([{ ...cardA, displayedTitle: 'out of scope' }]), /field/i);
  assert.throws(() => stage([cardA,cardA]), /duplicate/i);
  assert.throws(() => stage([{ ...cardA, file: cardB.file, afterSha256: cardB.afterSha256 },
    { ...cardB, file: cardA.file, afterSha256: cardA.afterSha256 }]), /path|identity/i);
  assert.throws(() => stage([{ ...cardA, file: '../' + cardA.file }]), /path/i);
  assert.throws(() => stage([{ ...cardA, afterSha256: priorA }]), /after|replacement/i);
  const sourceDir = join(root, 'source');
  mkdirSync(sourceDir);
  const sourceFile = join(sourceDir, cardA.file);
  writeFileSync(sourceFile, donorA);
  const candidate = { ...cardA, file: 'source/' + cardA.file };
  assert.equal(stage([candidate]).entries[A + '/card-inspector'].bytes, donorA.length);

  const linkedFile = linkArtworkFixture(sourceFile, join(root, A + '-link.png'));
  assert.deepEqual(readFileSync(linkedFile), donorA);
  const linkedCandidate = { ...candidate, file: relative(root, linkedFile).split(sep).join('/') };
  assert.throws(() => stage([linkedCandidate]), { message: 'Candidate path escapes approved root or uses a link' });
});

test('the actual Next asset route is private opt-in, verifies the stage manifest again and has no sibling fallback', async (t) => {
  const m = await import(imported);
  const routePath = '../src/app/api/cinematic/v19-visual-fix/[id]/[role]/[digest]/route.ts';
  const { GET } = await import(routePath);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'luna-v19-route-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, cardA.file), donorA);
  const d = packet([cardA]);
  const staged = Buffer.from(JSON.stringify(m.prepareVisualOverlay(d, sha(d), root)));
  const manifest = join(root, 'manifest.json');
  writeFileSync(manifest, staged);
  const setEnv = {
    NODE_ENV: 'development', LUNA_DEV_V19_VISUAL_FIXES: '1',
    LUNA_DEV_V19_VISUAL_FIX_ROOT: root, LUNA_DEV_V19_VISUAL_FIX_MANIFEST: manifest,
    LUNA_DEV_V19_VISUAL_FIX_MANIFEST_SHA256: sha(staged),
  };
  const before = Object.fromEntries(Object.keys(setEnv).map(k => [k, process.env[k]]));
  Object.assign(process.env, setEnv);
  t.after(() => { for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  const request = (id=A, role=cardA.role, digest=cardA.afterSha256, host='127.0.0.1') => GET(
    new Request('http://' + host + '/api/cinematic/v19-visual-fix/' + id + '/' + role + '/' + digest),
    { params: { id, role, digest } },
  );
  const open = await request();
  assert.equal(open.status, 200);
  assert.equal(open.headers.get('Content-Type'), 'image/png');
  assert.equal(open.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(open.headers.get('X-Luna-Artwork-Provenance'), 'v19-visual-correction-not-historical');
  assert.deepEqual(Buffer.from(await open.arrayBuffer()), donorA);
  assert.equal((await request(B)).status, 404);
  assert.equal((await request(A,'card-thumb')).status, 404);
  assert.equal((await request(A,cardA.role,priorA)).status, 404);
  assert.equal((await request(A,cardA.role,cardA.afterSha256,'example.test')).status, 404);
  Reflect.set(process.env, 'NODE_ENV', 'production');
  assert.equal((await request()).status, 404);
  Reflect.set(process.env, 'NODE_ENV', 'development');
  process.env.LUNA_DEV_V19_VISUAL_FIXES = '0';
  assert.equal((await request()).status, 404);
  process.env.LUNA_DEV_V19_VISUAL_FIXES = '1';
  writeFileSync(manifest, Buffer.concat([staged, Buffer.from(' ')]));
  assert.equal((await request()).status, 404);
});

test('the browser selector preserves admitted prints and scopes private story covers by ID, role and host', async (t) => {
  const script = '../src/lib/cinematic/v19-visual-fix-src.ts';
  const { visualFixSrc, storyCoverPresentationSrc } = await import(script);
  const pins = JSON.stringify({ [A + '/card-inspector']: cardA.afterSha256, 'LUNA-0797/story-cover': cardA.afterSha256 });
  const env = process.env as Record<string, string | undefined>;
  const original = [env.NODE_ENV, env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIXES, env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIX_PINS];
  const win = globalThis.window;
  t.after(() => {
    [env.NODE_ENV, env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIXES, env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIX_PINS] = original;
    if (win === undefined) delete (globalThis as {window?: unknown}).window; else globalThis.window = win;
  });
  env.NODE_ENV = 'development';
  env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIXES = '1';
  env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIX_PINS = pins;
  assert.equal(visualFixSrc(A, 'card-inspector'), undefined, 'the reviewed Hunter print takes precedence over a staging pin');
  assert.equal(visualFixSrc(A, 'card-thumb'), undefined);
  assert.equal(visualFixSrc(B, 'card-inspector'), undefined);
  assert.equal(storyCoverPresentationSrc(), undefined);
  assert.equal(visualFixSrc(GRAND, 'story-cover'), undefined);
  const story = 'LUNA-0803';
  env.NEXT_PUBLIC_LUNA_DEV_V19_VISUAL_FIX_PINS = JSON.stringify({ [story + '/story-cover']: cardA.afterSha256 });
  assert.equal(storyCoverPresentationSrc(), '/api/cinematic/v19-visual-fix/' + story + '/story-cover/' + cardA.afterSha256);
  assert.equal(visualFixSrc(story, 'card-inspector'), undefined);
  globalThis.window = { location: { hostname:'www.lunarian.app' } } as Window & typeof globalThis;
  assert.equal(storyCoverPresentationSrc(), undefined);
  env.NODE_ENV = 'production';
  delete (globalThis as {window?: unknown}).window;
  assert.equal(storyCoverPresentationSrc(), undefined);
});

test('a corrected card inspector chooses the private full-size role after open only and retains ordinary V18 artwork without it', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Lightbox } = await import('../src/components/Lightbox');
  const overlay = '/api/cinematic/v19-visual-fix/' + A + '/card-inspector/' + cardA.afterSha256;
  const native = '/api/cinematic/native-art/' + A + '/' + priorA;
  const props = { alt:'Fixture card', imageSrc:'/luna-cinematic/cards/faction/' + A + '/thumb.webp',
    preferredImageSrc:native, onClose(){} };
  assert.equal(renderToStaticMarkup(createElement(Lightbox,{ ...props, visualFixImageSrc:overlay, isOpen:false })), '');
  const staged = renderToStaticMarkup(createElement(Lightbox,{ ...props, visualFixImageSrc:overlay, isOpen:true }));
  assert.ok(staged.includes('src="' + overlay + '"'));
  assert.ok(!staged.includes('src="' + native + '"'));
  const ordinary = renderToStaticMarkup(createElement(Lightbox,{ ...props, isOpen:true }));
  assert.ok(ordinary.includes('src="' + native + '"'));
  assert.ok(!ordinary.includes(overlay));
});
