import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const base = 'src/app/[locale]';
const read = (file: string) => readFileSync(file, 'utf8');
const imageHash = (path: string) => createHash('sha256').update(readFileSync('public' + path)).digest('hex');

test('approved gallery matching accepts exact official identity URL only and preserves changed DB URLs', async () => {
  const { approvedPortraitFor } = await import('../src/lib/cinematic/people-art');
  const exact = 'https://assets.lunarian.app/characters/mastermind.png?v=1777532918932';
  const match = approvedPortraitFor(exact);
  assert.equal(match?.id, 'LUNA-0136');
  assert.ok(match && existsSync('public' + match.thumb) && existsSync('public' + match.medium));
  for (const bad of [
    exact.replace('1777532918932', '1777532918933'),
    exact.replace('?v=1777532918932', ''),
    exact + '&unknown=1', exact + '#extra',
    exact.replace('assets.lunarian.app', 'example.com'),
    exact.replace('https://', 'http://'),
    'https://assets.lunarian.app/inline-edits/char-img-a.png?v=123',
    'constructor', '__proto__',
  ]) assert.equal(approvedPortraitFor(bad), null, bad);
});

test('portrait lookup is bounded to compiled original URL asset map and wraps real list selection', async () => {
  const { CHARACTER_TEXTURES, wrapPeopleIndex } = await import('../src/lib/cinematic/people-art');
  assert.equal(Object.keys(CHARACTER_TEXTURES).length, 245);
  for (const id of Object.values(CHARACTER_TEXTURES)) {
    assert.ok(/^LUNA-\d{4}$/.test(id));
    for (const tier of ['thumb', 'medium']) assert.ok(existsSync('public/luna-cinematic/people/gallery/' + id + '/' + tier + '.webp'));
  }
  assert.equal(wrapPeopleIndex(-1, 7), 6);
  assert.equal(wrapPeopleIndex(7, 7), 0);
  assert.equal(wrapPeopleIndex(99, 0), 0);
});

test('People routes retain official identity/data and select independently approved local hero artwork', async () => {
  const { PEOPLE_HERO } = await import('../src/lib/cinematic/people-art');
  assert.equal(imageHash(PEOPLE_HERO.members), 'f49b9ab406163b8e836bf45836159df18a4cde509e9f11b054169e20898afea8');
  assert.match(PEOPLE_HERO.partners, /LUNA-0800/);
  assert.match(PEOPLE_HERO.characters, /LUNA-0802/);
  assert.ok(existsSync('public' + PEOPLE_HERO.partners));
  assert.ok(existsSync('public' + PEOPLE_HERO.characters));
  const charPage = read(base + '/characters/page.tsx');
  const chars = read(base + '/characters/CharactersContent.tsx');
  const members = read(base + '/members/MembersContent.tsx');
  const partners = read(base + '/partners/PartnersContent.tsx');
  for (const route of ['characters', 'members', 'partners']) {
    assert.match(read(base + '/' + route + '/page.tsx'), new RegExp('TabGuard tabKey="' + route + '"'));
  }
  assert.match(charPage, /getCharacters\(\), getCardCatalog\(\)/);
  const reader=read(base+'/characters/CharacterLinkedCards.tsx');
  assert.ok(chars.includes('linkedCardsFor(visibleRecords,cards,cinematic)'));
  assert.ok(reader.includes('approved={item.artwork?.thumb}') && reader.includes('approved={item.artwork?.detail}'));
  assert.ok(reader.includes('original={item.card.imageUrl}') && reader.includes('inspectorArtworkViewerSrc(item.artwork?.releaseId)'));
  assert.match(chars, /<CastArchive records=\{visibleRecords\}/);
  assert.match(chars, /dbCollection="characters"/);
  assert.ok(members.includes('/api/members?') && members.includes('/profile?discordId='));
  assert.match(members, /encodeURIComponent\(m.discordId\)/);
  assert.ok(partners.includes('/api/partners') && partners.includes('.website'));
  for(const [world,source] of [['characters',chars],['members',members],['partners',partners]]) {
    assert.ok(source.includes('<WorldStage world="'+world+'"'));
  }
});

test('card navigation resolves the selected edition for its displayed character', async () => {
  const { linkedCardsFor, selectedLinkedCardIndex } = await import('../src/app/[locale]/characters/linked-card-records');
  const name = { en: 'Fixture', ar: 'شخصية' };
  const first = { id: 'first', name, faction: 'knights', imageUrl: '/first.png', cardId: 'shared' };
  const second = { ...first, id: 'second', imageUrl: '/second.png' };
  const shared = { id: 'shared', characterId: second.id, name, imageUrl: '/card.png', rarity: 'unique' as const };
  const secondEdition = { ...shared, id: 'second-edition' };
  const entries = linkedCardsFor([first, second], [shared, secondEdition], false);

  assert.equal(selectedLinkedCardIndex(entries, first.id, shared.id), 0);
  assert.equal(selectedLinkedCardIndex(entries, second.id, shared.id), 1);
  assert.equal(selectedLinkedCardIndex(entries, second.id, secondEdition.id), 2);
  assert.equal(selectedLinkedCardIndex(entries, first.id, secondEdition.id), 0);
  assert.equal(selectedLinkedCardIndex(entries, second.id), 1);
  assert.equal(selectedLinkedCardIndex(entries, 'unlinked', shared.id), -1);
});

test('linked cards stay within the filtered cast and preserve official, declared and fallback artwork',async()=>{
  const {linkedCardsFor}=await import('../src/app/[locale]/characters/linked-card-records');
  const rows=JSON.parse(read('src/lib/cinematic/release-card-index.json')).fantasy as string[][];
  const [imageUrl]=rows.find(row=>row[3]==='LUNA-0342')!;
  const person={id:'ancient-dragon',name:{en:'Ancient Dragon',ar:'التنين العتيق'},faction:'dragons',imageUrl:'/portrait.webp'};
  const official={id:'Ancient Dragon',name:person.name,rarity:'secret' as const,imageUrl,characterId:person.id};
  const fallback={...official,id:'alternate-official-record',imageUrl:'/original-only.png'};
  const outsider={...official,id:'elsewhere',characterId:'another-person'};
  const result=linkedCardsFor([person],[official,outsider,fallback],true);
  assert.deepEqual(result.map(entry=>entry.card.id),[official.id,fallback.id]);
  assert.equal(result[0].character.id,person.id);
  assert.equal(result[0].artwork?.releaseId,'LUNA-0342');
  assert.equal(result[1].artwork,undefined);
  assert.equal(result[1].card.imageUrl,'/original-only.png');
  assert.deepEqual(linkedCardsFor([{...person,cardId:fallback.id}],[official,fallback],true).map(entry=>entry.card.id),[fallback.id,official.id]);
  assert.deepEqual(linkedCardsFor([], [official], true),[]);
});

test('hero art preserves approved responsive bitmap sizes while keeping the editable original fallback', async () => {
  const { PEOPLE_HERO, peopleHeroSources } = await import('../src/lib/cinematic/people-art');
  for (const image of Object.values(PEOPLE_HERO)) {
    const urls = peopleHeroSources(image);
    assert.ok(existsSync('public' + urls.thumb));
    assert.ok(existsSync('public' + urls.detail));
    assert.equal(urls.srcSet, urls.thumb + ' 1280w, ' + image + ' 1920w, ' + urls.detail + ' 3840w');
  }
  assert.match(read(base + '/cinematic-people/CinematicArtwork.tsx'), /<source srcSet=\{hero\.srcSet\} sizes="100vw"/);
});

test('responsive hero marks the browser-selected image eager without preloading the medium variant', () => {
  const component = read(base + '/cinematic-people/CinematicArtwork.tsx');
  assert.match(component, /priority=\{!isResponsive && image\.priority\}/);
  assert.match(component, /loading=\{isResponsive \? 'eager' : image\.loading\}/);
});

test('visually confirmed portrait repairs use exact reviewed originals and fail closed on official version changes', async () => {
  const { CHARACTER_TEXTURES, approvedPortraitFor } = await import('../src/lib/cinematic/people-art');
  const fixes = [
    ['LUNA-0074','384009d005dec38306ea87454abfd007e0ab80399a439e93d61243daf6acb856'],
    ['LUNA-0130','408717c16ee8293a770a54e0a28de240b05ec3bb54c8704f3e9a23b4ad2d91de'],
    ['LUNA-0185','5801e76fa97d34e9785e2a462f0117d0136c0fddb8e4fedc34fc40a2ca8f1918'],
  ];
  for (const [id, sha] of fixes) {
    const url = Object.entries(CHARACTER_TEXTURES).find(([, ref]) => ref === id)?.[0];
    assert.ok(url);
    const repair = approvedPortraitFor(url);
    assert.equal(repair?.id,id);
    assert.match(repair!.thumb,/visual-qa-thumb\.webp$/);
    assert.ok(existsSync('public' + repair!.thumb));
    assert.equal(imageHash(repair!.medium),sha);
    assert.equal(approvedPortraitFor(url + '&changed=1'),null);
  }
});
