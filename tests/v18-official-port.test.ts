import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { inspectorArtworkViewerSrc } from '../src/lib/cinematic/native-art-inspector';
import finalPrints from './fixtures/luna-final-art-prints.json';
import { approvedPortraitFor } from '../src/lib/cinematic/people-art';
import { projectLunaCardArtwork, projectFantasyCardArtwork, projectFactionCardArtwork } from '../src/lib/release-card-art';

const CDN='https://assets.lunarian.app';
const hash = (url: string) => createHash('sha256').update(readFileSync('public'+url)).digest('hex');
const mythicals = [
  ['LUNA-0342','Ancient Dragon','/cards/Mythical/Ancient%20Dragon.png?v=1777524999398','6e3302ff5c7e2dae8f3f2192885aaad4ce4c2af70707e2fe6c89d9eca65a196e','bba965e4e72a744c14564189f8f85b3d1de52519bc2bfa43f50fb6ca8a7196a4'],
  ['LUNA-0343','Dark Mastermind','/cards/Mythical/Dark%20Mastermind.jpeg?v=1777524996551','cb705885c2a8a56638aaf89581ed94decfab1c8e18f2b6aa03da2142117726ab','b75f1fd487d44698a66f7a8588be6494a88349aff68f1c53065b17b4a4938f37'],
  ['LUNA-0382','The Silent Ancient','/cards/Secret/secret_the_silent_ancient.jpg?v=1777524995356','ea4b169dcc31e51411c9b33d1ca01696cdbc5b42ac0467ba73c81cea54fffd69','69bd7ad7c8ddfb12e049a896c3c7ba6ea8197dea143a9a8b79034324c3263b9e'],
] as const;

test('all three exact approved Mythical faces are Luna-only and keep their original record identities',()=>{
  for(const [id,name,path,full,thumb] of mythicals){
    const imageUrl=CDN+path;
    for(const rarity of ['secret','mythical']){
      const row=Object.freeze({ name:Object.freeze({en:name}),rarity,imageUrl });
      const art=projectLunaCardArtwork(row,true);
      assert.equal(art?.releaseId,id);
      assert.equal(art?.original,imageUrl);
      assert.equal(hash(art!.thumb),thumb);
      assert.equal(hash(art!.detail),full);
      assert.equal(projectFantasyCardArtwork(row,true),undefined);
      assert.equal(projectLunaCardArtwork({...row,imageUrl:row.imageUrl+'0'},true),undefined);
      assert.equal(projectLunaCardArtwork({...row,rarity:'legendary'},true),undefined);
      assert.equal(projectLunaCardArtwork(row,false),undefined);
    }
  }
  const retired='public/luna-cinematic/cards/fantasy/LUNA-0382/';
  for(const path of ['owner-r5.png','owner-r5-thumb.webp','thumb.webp','medium.webp','full.webp'])
    assert.equal(existsSync(retired+path),false,path);
});

test('Hunter native Faction binds its exact edited artwork, not Gallery Grim to Faction Grim',()=>{
  const image='lunarians_hunter.png?v=1777517863891';
  const card={name:'Hunter',image};
  const hunter=projectFactionCardArtwork('lunarians',card,true)!;
  assert.equal(hunter.releaseId,'LUNA-0547');
  const archived = '/luna-cinematic/cards/faction/LUNA-0547/bowstring-v18-15487bfce7ab';
  assert.equal(hash(archived + '.png'),'15487bfce7ab51f09fb8238a7ee757d8b1664fae8ea6fdef5bf9c4ee81c4ba8f');
  assert.equal(hash(archived + '-thumb.webp'),'8adc301452f370d4c7ab92773ec739f802e11a23b58802933651d40000b7af0b');
  const current = finalPrints['LUNA-0547'];
  assert.equal(hunter.detail, current.mediumURL);
  assert.equal(hunter.thumb, current.thumbURL);
  assert.equal(hash(hunter.detail), current.medium);
  assert.equal(hash(hunter.thumb), current.thumb);
  assert.equal(inspectorArtworkViewerSrc(hunter.releaseId), current.detailURL);
  assert.equal(hash(current.detailURL),'29e2007db9d00a1628ab40b213020f6e7614916f6a412fa95d5d57e726b2c8f9');
  assert.equal(projectFactionCardArtwork('lunarians',{...card,image:image+'0'},true),undefined);
  assert.equal(projectFactionCardArtwork('warriors',card,true),undefined);
  const grim=projectFactionCardArtwork('underworld',{name:'Grim Reaper',image:'underworld_grim_reaper.png?v=1777510400658'},true);
  assert.equal(grim?.releaseId,'LUNA-0688');
  assert.match(grim!.detail,/\/faction\/LUNA-0688\/medium\.webp$/);
});

test('three exact Gallery portraits feed the shared grid, motion theater and modal projection',()=>{
  const expected=[
    ['LUNA-0102','grim-reaper.png?v=1777533087164','d2e36ece222f51d8d8528a45f7e71560c529ac27579356917276ab7db122fe22','49f0b89e809c45cb7fb69ee9548edb07773165fd9bfb54f211068dd0a2dfab4e'],
    ['LUNA-0212','talon-warden.png?v=1777533401130','6f450b8c8233d93ca3838599602931fac5429f63edbddd8920f32dbe435ccc7c','1dd5f4a06ee1c983e94e0c772a0b57a7d256ee33b8157a0b479b76a60703ac1a'],
    ['LUNA-0224','twins.png?v=1777541120839','b407c5496b5de1cfea8d106289361ca6585c7317196d6dd7aa511db1ef2623cc','d4309ba32dfacd681f3f2f1c0f412f424f3ae3e543c7e9b7105c1f1e17af5d53'],
  ];
  for(const [id,name,full,thumb] of expected){
    const url=CDN+'/characters/'+name;
    const art=approvedPortraitFor(url);
    assert.equal(art?.id,id);
    assert.equal(hash(art!.thumb),thumb);
    assert.equal(hash(art!.medium),full);
    assert.equal(approvedPortraitFor(url+'0'),null);
  }
  assert.equal(existsSync('public/luna-cinematic/people/gallery/LUNA-0212/visual-qa.png'),false);
});

test('six merchant portrait crops adapt only the native photo layer at the reviewed breakpoints',()=>{
  const style=readFileSync('src/styles/luna-cinematic-economy.css','utf8');
  const phone=style.split('@media (max-width: 620px) and (orientation: portrait)')[1]?.split('@media')[0];
  const tablet=style.split('@media (min-width: 621px) and (max-width: 768px) and (orientation: portrait)')[1]?.split('@media')[0];
  const mast=style.split('@media (max-width: 620px) and (min-height: 500px) and (orientation: portrait)')[1]?.split('@media')[0];
  assert.ok(phone && tablet && mast);
  for(const [slug,x,y] of [['kael',62,67],['meluna',54,56],['zoldar',63,64],['seluna',86,56],['brimor',28,25],['mells',62,64]]){
    assert.match(phone,new RegExp('data-cinematic-merchant="'+slug+'"\\] \\{ --economy-hero-x: '+x+'%'));
    assert.match(tablet,new RegExp('data-cinematic-merchant="'+slug+'"\\] \\{ --economy-hero-x: '+y+'%'));
  }
  assert.match(phone,/min\(45svh,\s*68vw\)/);
  assert.match(mast,/inset-block-start:\s*var\(--merchant-photo-nav-clearance\)/);
  assert.match(mast,/height:\s*calc\(var\(--merchant-mobile-height\) - var\(--merchant-photo-nav-clearance\)\)/);
});

test('native Gallery related collectible uses only the official character relationship and Luna artwork version',async()=>{
  const { projectRelatedLunaCard }=await import('../src/lib/release-card-art');
  const row={id:'official-card-38',characterId:'official-character-id',name:{en:'The Silent Ancient'},
    rarity:'secret',imageUrl:CDN+'/cards/Secret/secret_the_silent_ancient.jpg?v=1777524995356'};
  const others=[{...row,id:'same-name-other',characterId:'unrelated-id'}];
  const selected=projectRelatedLunaCard([...others,row],row.characterId,true);
  assert.equal(selected?.card,row);
  assert.equal(hash(selected!.artwork!.thumb),'69bd7ad7c8ddfb12e049a896c3c7ba6ea8197dea143a9a8b79034324c3263b9e');
  assert.equal(projectRelatedLunaCard([row],row.characterId,false)?.artwork,undefined);
  assert.equal(projectRelatedLunaCard([{...row,imageUrl:row.imageUrl+'0'}],row.characterId,true)?.artwork,undefined);
  assert.equal(projectRelatedLunaCard([{...row,characterId:''}],'',true),undefined);
  assert.equal(projectRelatedLunaCard([row],undefined,true),undefined);
  assert.equal(projectRelatedLunaCard(others,row.characterId,true),undefined);
});

test('a settings-free deployment enables presentation while zero and Grand-specific overrides retain rollback controls',async()=>{
  const { cinematicPresentationEnabled, grandBookPresentationEnabled }=await import('../src/lib/cinematic/presentation-flags');
  const { releaseEnabled }=await import('../src/lib/release-card-art');
  const env=process.env;
  const cinematic=env.NEXT_PUBLIC_LUNA_CINEMATIC;
  const grand=env.LUNA_GRAND_BOOK_V16;
  try {
    delete env.NEXT_PUBLIC_LUNA_CINEMATIC;
    delete env.LUNA_GRAND_BOOK_V16;
    assert.equal(cinematicPresentationEnabled(),true);
    assert.equal(grandBookPresentationEnabled(),true);
    assert.equal(releaseEnabled(),true);
    const card={name:{en:'The Silent Ancient'},rarity:'secret',imageUrl:CDN+'/cards/Secret/secret_the_silent_ancient.jpg?v=1777524995356'};
    assert.equal(projectLunaCardArtwork(card)?.releaseId,'LUNA-0382');
    env.NEXT_PUBLIC_LUNA_CINEMATIC='0';
    assert.equal(cinematicPresentationEnabled(),false);
    assert.equal(grandBookPresentationEnabled(),false);
    assert.equal(releaseEnabled(),false);
    assert.equal(projectLunaCardArtwork(card),undefined);
    env.LUNA_GRAND_BOOK_V16='1';
    assert.equal(grandBookPresentationEnabled(),true);
    env.NEXT_PUBLIC_LUNA_CINEMATIC='1';
    env.LUNA_GRAND_BOOK_V16='0';
    assert.equal(cinematicPresentationEnabled(),true);
    assert.equal(grandBookPresentationEnabled(),false);
  } finally {
    for (const [key,value] of [['NEXT_PUBLIC_LUNA_CINEMATIC',cinematic],['LUNA_GRAND_BOOK_V16',grand]] as const)
      if(value===undefined) delete env[key]; else env[key]=value;
  }
});
