import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const exactID='LUNA-0325';
const reviewID='LUNA-0608';
const exactDigest='bef24c2f58ad3eef62e4d1b6f21711ee355fcd75f5b82e79dcb063ac3f648492';
const reviewDigest='f'.repeat(64);
const vars = ['NODE_ENV','NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTORS','NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTOR_SHA256S'] as const;

async function withConfig(mode: string, enabled: string | undefined, mapping: string | undefined, run: () => Promise<void>) {
  const prior = vars.map(name => process.env[name]);
  const values = [mode,enabled,mapping];
  try {
    for (let i=0;i<vars.length;i++) {
      if(values[i]===undefined) delete process.env[vars[i]];
      else Object.assign(process.env,{[vars[i]]:values[i]});
    }
    await run();
  } finally {
    for (let i=0;i<vars.length;i++) {
      if(prior[i]===undefined) delete process.env[vars[i]];
      else Object.assign(process.env,{[vars[i]]:prior[i]});
    }
  }
}
const map=JSON.stringify({[exactID]:reviewDigest,[reviewID]:reviewDigest,'LUNA-0002':'invalid','__proto__':reviewDigest});

test('exact historical inspector source takes priority and missing pins stay on the existing fallback', async () => {
  const { inspectorArtworkViewerSrc } = await import('../src/lib/cinematic/native-art-inspector');
  await withConfig('development','1',map,async () => {
    assert.equal(inspectorArtworkViewerSrc(exactID), '/api/cinematic/native-art/'+exactID+'/'+exactDigest);
    assert.equal(inspectorArtworkViewerSrc(reviewID), '/api/cinematic/reviewed-reconstruction/'+reviewID+'/'+reviewDigest);
    assert.equal(inspectorArtworkViewerSrc('LUNA-0002'),undefined);
    assert.equal(inspectorArtworkViewerSrc('LUNA-9999'),undefined);
    assert.equal(inspectorArtworkViewerSrc('../'+reviewID),undefined);
    assert.equal(inspectorArtworkViewerSrc(undefined),undefined);
  });
});

test('ordinary dev and production inspectors never select reviewed sources by default', async () => {
  const { inspectorArtworkViewerSrc } = await import('../src/lib/cinematic/native-art-inspector');
  for(const [mode,flag,mapping] of [
    ['development',undefined,map],['production','1',map],['development','1','{broken'],['development','1','[]'],
  ] as const) {
    await withConfig(mode,flag,mapping,async () => {
      assert.equal(inspectorArtworkViewerSrc(reviewID),undefined);
      assert.equal(inspectorArtworkViewerSrc(exactID), '/api/cinematic/native-art/'+exactID+'/'+exactDigest);
    });
  }
});

test('real card inspector consumes the opt-in reviewed URL only after open, never its closed markup', async () => {
  const { Lightbox } = await import('../src/components/Lightbox');
  const { inspectorArtworkViewerSrc } = await import('../src/lib/cinematic/native-art-inspector');
  const fallback = '/luna-cinematic/cards/faction/LUNA-0608/medium.webp';
  await withConfig('development','1',map,async () => {
    const preferredImageSrc=inspectorArtworkViewerSrc(reviewID);
    assert.ok(preferredImageSrc);
    const props={preferredImageSrc,imageSrc:fallback,alt:'Card',onClose(){}};
    assert.equal(renderToStaticMarkup(createElement(Lightbox,{...props,isOpen:false})), '');
    const open=renderToStaticMarkup(createElement(Lightbox,{...props,isOpen:true}));
    assert.ok(open.includes('src="'+preferredImageSrc+'"'));
    assert.ok(!open.includes('/_next/image'));
  });
});
