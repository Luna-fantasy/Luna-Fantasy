import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const store = '/luna-cinematic/cards/stages';

test('Luna dealer starts with its pinned approved poster and five exact card identities', async () => {
  const { lunaDealer, dealerProgress, dealerPose } = await import('../src/lib/cinematic-luna-faction');
  assert.equal(lunaDealer.poster, store+'/luna/table.webp');
  assert.deepEqual(lunaDealer.cards.map(c=>c.id), ['LUNA-0264','LUNA-0335','LUNA-0293','LUNA-0384','LUNA-0305']);
  assert.equal(dealerProgress(-1),0);
  assert.equal(dealerProgress(2),1);
  const cold = dealerPose(2, dealerProgress(0));
  const mid = dealerPose(2, dealerProgress(.55));
  assert.notDeepEqual(cold,mid);
  assert.deepEqual(dealerPose(2, dealerProgress(0)),cold);
});

test('Faction council wraps official groups, and does not give an unrelated card the approved hero face', async () => {
  const { councilGroupOrder, nextCouncilIndex, councilComposition, councilRepresentative } = await import('../src/lib/cinematic-luna-faction');
  assert.equal(councilGroupOrder.length,11);
  assert.deepEqual(councilComposition(councilGroupOrder,3,true),['colossals','knights','dragons']);
  assert.deepEqual(councilComposition(councilGroupOrder,3,false),['dragons','knights','lunarians']);
  assert.equal(nextCouncilIndex(0,-1,11),10);
  assert.equal(nextCouncilIndex(10,1,11),0);
  const valid = { name:'Bod Aban', image:'knights_bod_aban.png?v=1777512817411' };
  assert.equal(councilRepresentative('knights',[valid])?.id,'LUNA-0494');
  assert.equal(councilRepresentative('knights',[{...valid,image:'knights_sable.png'}]),undefined);
  assert.equal(councilRepresentative('knights',[{...valid,image:'knights_bod_aban.png?v=9999999999999'}]),undefined);
  assert.equal(councilRepresentative('knights',[valid,valid]),undefined);
  assert.equal(councilRepresentative('warriors',[valid]),undefined);
});

test('all Luna/Faction visual asset bytes match the pinned last approved release', async () => {
  const { cinematicAssetReceipts } = await import('../src/lib/cinematic-luna-faction');
  assert.equal(cinematicAssetReceipts.length,31);
  for (const [url,expected] of cinematicAssetReceipts)
    assert.equal(createHash('sha256').update(readFileSync('public'+url)).digest('hex'),expected,url);
});

test('each route attaches its native scene locally without changing existing catalog providers', () => {
  const get = (p:string)=>readFileSync(p,'utf8');
  const luna = get('src/app/[locale]/luna-fantasy/CardsContent.tsx');
  const faction = get('src/app/[locale]/faction-war/FactionWarContent.tsx');
  assert.match(luna,/<LunaDealerScene/);
  assert.match(faction,/<FactionCouncilScene/);
  assert.match(faction,/onOpenFaction=\{openFactionFromCouncil\}/);
  assert.match(faction,/setActiveFilter\(factionId\)/);
  assert.match(get('src/app/[locale]/luna-fantasy/page.tsx'),/getCardCatalog\(\)/);
  assert.match(get('src/app/[locale]/faction-war/page.tsx'),/getFactionWarFactions\(\)/);
});

test('official authorized editing retains each editable hero and bypasses card-art projection', () => {
  const get = (p:string) => readFileSync(p,'utf8');
  for (const [route, component, scene, selector] of [
    ['luna-fantasy', 'CardsContent', 'LunaDealerScene', 'projectLunaCardArtwork\\(card, cinematic\\)'],
    ['faction-war', 'FactionWarContent', 'FactionCouncilScene', 'projectFactionCardArtwork\\(faction.id, card, cinematic\\)'],
  ]) {
    const page = get('src/app/[locale]/' + route + '/page.tsx');
    const view = get('src/app/[locale]/' + route + '/' + component + '.tsx');
    assert.match(page, /cinematicPresentation=\{cinematicPresentationEnabled\(\) && searchParams\?\.editMode !== '1'\}/, route + ': first render avoids an edit-mode cinematic flash');
    assert.match(view, /const \{ editMode \} = useEditMode\(\)/);
    assert.match(view, /const cinematic = cinematicPresentation && !editMode/);
    assert.match(view, new RegExp('\\{cinematic \\? <' + scene));
    assert.match(view, new RegExp('editId="' + route + '-hero-bg"'));
    assert.match(view, new RegExp(selector), route + ': bypass local card art in edit mode');
  }
  assert.match(get('middleware.ts'), /req\.nextUrl\.searchParams\.get\('editMode'\) === '1'[\s\S]*?!isMastermind\(discordId\)[\s\S]*?cleanUrl\.searchParams\.delete\('editMode'\)/);
});
