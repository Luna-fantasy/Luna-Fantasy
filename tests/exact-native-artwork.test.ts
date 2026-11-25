import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const require = createRequire(import.meta.url);
const galleryDigest = '668a55a2e979d9e4d2e1e47e06ac3a3f9abe97bf942762d42f0fac77865b1ca7';

async function withTemporaryNativeRoot(run: (path: string) => Promise<void>) {
  const original = process.env.LUNA_NATIVE_ART_ROOT;
  const root = await mkdtemp(join(tmpdir(), 'luna-native-art-test-'));
  process.env.LUNA_NATIVE_ART_ROOT = root;
  try {
    await run(root);
  } finally {
    if (original === undefined) delete process.env.LUNA_NATIVE_ART_ROOT;
    else process.env.LUNA_NATIVE_ART_ROOT = original;
    await rm(root, { recursive: true, force: true });
  }
}

test('Next build and ordinary production startup reject an incomplete exact-native release', async () => {
  const config = require('../next.config.js');
  assert.equal(typeof config, 'function');
  await withTemporaryNativeRoot(async () => {
    for (const phase of ['phase-production-build', 'phase-production-server']) {
      assert.throws(() => config(phase, { defaultConfig: {} }), /exact-native artwork release incomplete: verified 0\/796/i);
    }
    assert.doesNotThrow(() => config('phase-development-server', { defaultConfig: {} }));
  });
});

test('only verified IDs select an exact native viewer URL; a prior revision is not substituted', async () => {
  const api = await import('../src/lib/cinematic/native-art-url');
  assert.equal(api.nativeArtworkViewerSrc('LUNA-0003'), '/api/cinematic/native-art/LUNA-0003/' + galleryDigest);
  assert.equal(api.nativeArtworkViewerSrc('LUNA-9999'), undefined);
  assert.equal(api.nativeArtworkViewerSrc('../../LUNA-0003'), undefined);
  assert.equal(api.nativeArtworkViewerSrc(null), undefined);
});

test('real card lightbox markup only uses exact image content when opened; derivative fallback remains', async () => {
  const { Lightbox } = await import('../src/components/Lightbox');
  const { nativeArtworkViewerSrc } = await import('../src/lib/cinematic/native-art-url');
  const fallback = '/luna-cinematic/cards/fantasy/LUNA-0325/medium.webp';
  const native = nativeArtworkViewerSrc('LUNA-0325');
  assert.ok(native);
  const props = { preferredImageSrc: native, imageSrc: fallback, alt: 'Luna Goblin', onClose() {} };
  assert.equal(renderToStaticMarkup(createElement(Lightbox, { ...props, isOpen: false })), '');
  const opened = renderToStaticMarkup(createElement(Lightbox, { ...props, isOpen: true }));
  assert.ok(opened.includes('src="' + native + '"'));
  assert.ok(!opened.includes('/_next/image'));
  assert.ok(!opened.includes('src="' + fallback + '"'));
});

test('exact-native route fails closed if an expected file is missing or has modified bytes', async () => {
  const { GET } = await import('../src/app/api/cinematic/native-art/[id]/[digest]/route');
  const { knownNativeArtwork } = await import('../src/lib/cinematic/native-art-url');
  const id = 'LUNA-0003';
  const available = knownNativeArtwork(id);
  assert.ok(available);
  const request = new Request('http://127.0.0.1/api/cinematic/native-art/' + id + '/' + galleryDigest);
  async function unavailable() {
    const response = await GET(request, { params: { id, digest: galleryDigest } });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  await withTemporaryNativeRoot(async (root) => {
    await unavailable();
    await mkdir(join(root, 'gallery'));
    await writeFile(join(root, 'gallery', id + '.png'), Buffer.alloc(available.bytes, 0x76));
    await unavailable();
  });
});
