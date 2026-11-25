import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import kaidanPrints from './fixtures/kaidan-prints.json';
import finalPrints from './fixtures/luna-final-art-prints.json';

const reviewedPrints = new Map(Object.entries(finalPrints));

const cdn = 'https://assets.lunarian.app';
const legendary = { name: { en: 'Moon Rider', ar: 'Moon Rider' }, rarity: 'legendary', imageUrl: cdn+'/cards/Legendary/Moon%20Rider.png?v=1777525144019' };
const factionRider = { name: 'Moon Rider', image: 'warriors_moon_rider.png?v=1777515014631', description: 'official' };
const deer = { name: 'Great Dear', image: 'mythical_creatures_great_dear.png?v=1777511745015', description: 'official' };

test('approved Legendary and Faction titles bind independently, without changing source rows', async () => {
  const { projectFantasyCardArtwork, projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const a = projectFantasyCardArtwork(legendary, true);
  const b = projectFactionCardArtwork('warriors', factionRider, true);
  assert.deepEqual(a, {
    releaseId: 'LUNA-0308',
    thumb: '/luna-cinematic/cards/fantasy/LUNA-0308/thumb.webp',
    detail: '/luna-cinematic/cards/fantasy/LUNA-0308/medium.webp',
    original: legendary.imageUrl,
  });
  assert.deepEqual(b, {
    releaseId: 'LUNA-0719',
    thumb: '/luna-cinematic/cards/faction/LUNA-0719/thumb.webp',
    detail: '/luna-cinematic/cards/faction/LUNA-0719/medium.webp',
    original: cdn+'/LunaPairs/'+factionRider.image,
  });
  assert.equal(factionRider.name, 'Moon Rider');
  assert.equal(factionRider.image, 'warriors_moon_rider.png?v=1777515014631');
  assert.equal(legendary.imageUrl, cdn+'/cards/Legendary/Moon%20Rider.png?v=1777525144019');
});

test('Great Deer presentation corrects the display name without changing official documents or Great Sage', async () => {
  const { projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const src = Object.freeze({ ...deer });
  const a = projectFactionCardArtwork('mythical_creatures', src, true);
  assert.equal(a?.title, 'Great Deer');
  assert.equal(a?.releaseId, 'LUNA-0608');
  assert.equal(a?.original, cdn+'/LunaPairs/'+src.image);
  assert.deepEqual(src, deer);
  assert.equal(projectFactionCardArtwork('moon_creatures', { name: 'Greatsage', image: 'moon_creatures_greatsage.png?v=42' }, true), undefined);
});

test('opt-out, unrecognized source, wrong faction/rarity, or changed identity stays on the official path', async () => {
  const { projectFantasyCardArtwork, projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  assert.equal(projectFantasyCardArtwork(legendary, false), undefined);
  assert.equal(projectFactionCardArtwork('warriors', factionRider, false), undefined);
  for (const v of [
    { ...legendary, rarity: 'epic' },
    { ...legendary, name: { en: 'Moon Bender', ar: 'Moon Bender' } },
    { ...legendary, imageUrl: cdn+'/characters/moon-rider.png?v=1' },
    { ...legendary, imageUrl: 'https://example.test/cards/Legendary/Moon%20Rider.png' },
    { ...legendary, imageUrl: cdn+'/cards/Legendary/Moon%20Rider.png?version=41' },
    { ...legendary, imageUrl: cdn+'/cards/Legendary/Moon%20Rider.png?v=1&v=2' },
    { ...legendary, imageUrl: cdn+'/cards/Legendary/Moon%20Rider.png#different' },
    { ...legendary, imageUrl: cdn+'/cards/../cards/Legendary/Moon%20Rider.png' },
  ]) assert.equal(projectFantasyCardArtwork(v, true), undefined);
  assert.equal(projectFactionCardArtwork('moon_creatures', factionRider, true), undefined);
  assert.equal(projectFactionCardArtwork('warriors', { ...factionRider, name: 'Moon Bender' }, true), undefined);
  assert.equal(projectFactionCardArtwork('warriors', { ...factionRider, image: '../../warriors_moon_rider.png' }, true), undefined);
});

test('Luna and Grand project verified common cards, and Faction projects its own approved rows', async () => {
  const { projectLunaCardArtwork, projectFantasyCardArtwork, projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const princess = { name: { en: 'Luna Princess' }, rarity: 'common', imageUrl: cdn + '/cards/Common/Luna_Princess.png?v=1777518487440' };
  assert.equal(projectLunaCardArtwork(princess, true)?.releaseId, 'LUNA-0264');
  assert.equal(projectFantasyCardArtwork(princess, true)?.releaseId, 'LUNA-0264');
  const leech = cdn + '/LunaPairs/beasts_abyssal_leech.png?v=1777513851875';
  for (const [image, original] of [
    [leech, leech],
    ['beasts_abyssal_leech.png?v=1777513851875', leech],
    ['beasts_abyssal_leech.png', cdn + '/LunaPairs/beasts_abyssal_leech.png'],
  ]) {
    const selection = projectFactionCardArtwork('beasts', { name: 'Abyssal Leech', image }, true);
    assert.equal(selection?.releaseId, 'LUNA-0409', image);
    assert.equal(selection?.original, original, image);
  }
  assert.equal(projectFactionCardArtwork('colossals', { name: 'Abyssal Leech', image: leech }, true), undefined);
  assert.equal(projectFantasyCardArtwork({ ...princess, rarity:'forbidden' }, true), undefined);
  assert.equal(projectLunaCardArtwork({ ...princess, name:{ en:'Spawned Luna Princess' } }, true), undefined);
});

test('official image version drift wins over approved art for general and exception records', async () => {
  const { projectLunaCardArtwork, projectFantasyCardArtwork, projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const drift = (image: string) => image.replace(/v=.*/, 'v=9999999999999');
  assert.equal(projectFantasyCardArtwork({ ...legendary, imageUrl: drift(legendary.imageUrl) }, true), undefined);
  assert.equal(projectLunaCardArtwork({ name:{ en:'Luna Princess' }, rarity:'common', imageUrl: cdn+'/cards/Common/Luna_Princess.png?v=9999999999999' }, true), undefined);
  assert.equal(projectFactionCardArtwork('warriors', { ...factionRider, image: drift(factionRider.image) }, true), undefined);
  assert.equal(projectFactionCardArtwork('mythical_creatures', { ...deer, image: drift(deer.image) }, true), undefined);
  assert.equal(projectLunaCardArtwork({
    name: { en:'Dark Mastermind' }, rarity:'secret', imageUrl:cdn+'/cards/Mythical/Dark%20Mastermind.jpeg?v=9999999999999',
  }, true), undefined);
});

test('Luna uses the exact owner-approved Ancient Dragon; Grand omits Luna-only Mythicals', async () => {
  const { projectLunaCardArtwork, projectFantasyCardArtwork } = await import('../src/lib/release-card-art');
  for (const [name, rarity, path, releaseId] of [
    ['Ancient Dragon', 'secret', '/cards/Mythical/Ancient%20Dragon.png?v=1777524999398', 'LUNA-0342'],
    ['Ancient Dragon', 'mythical', '/cards/Mythical/Ancient%20Dragon.png?v=1777524999398', 'LUNA-0342'],
  ]) {
    const card = { name: { en:name }, rarity, imageUrl: cdn + path };
    assert.equal(projectLunaCardArtwork(card, true)?.detail, '/luna-cinematic/cards/fantasy/' + releaseId + '/dragon-owner-approved-6e3302ff5c7e-bba965e4e72a.jpeg');
    assert.equal(projectFantasyCardArtwork(card, true), undefined);
  }
});

test('all delivered overlay variants exactly match the approved release manifest', async () => {
  const { projectFantasyCardArtwork, projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const a = projectFantasyCardArtwork(legendary, true)!;
  const b = projectFactionCardArtwork('warriors', factionRider, true)!;
  const c = projectFactionCardArtwork('mythical_creatures', deer, true)!;
  const expected = [
    [a.thumb,'5ec320afb7c6a4d37ae53330a0e647e0b44b067962a5caff5bd52ea100665434'],
    [a.detail,'11cbe4e9efee03c7c0575b0f5f8480e9c89eba42a64dfc2188e8f709f9591268'],
    [b.thumb,'837d691bbbc57fe65b52c82a7b2be70786cde254e3a5f0ccb1734fc9f8f13f26'],
    [b.detail,'7f009a373afa95c7e2006381825a6afd5c8c41a1d5469e0f763d1dc934d91323'],
    [c.thumb,'b6d9346c4b1848b0644ae8cbcbefc5ee1ece01b272d0dec98aa29d1457cca2c3'],
    [c.detail,'cee65d419f06e3fc5b5bca91219e94ccc41bc2d9a64867ac559a641568af1b85'],
    ['/luna-cinematic/cards/faction/LUNA-0608/thumb.webp','839ceddb2e8f420ab5a9017affb506e24977528b47336d72dcb92aac0121804e'],
    ['/luna-cinematic/cards/faction/LUNA-0608/medium.webp','652e2bb55ff51848880e9eb5032be824d978d1354295dc1f8dec87e87df09825'],
  ];
  for (const [url, sha] of expected)
    assert.equal(createHash('sha256').update(readFileSync('public'+url)).digest('hex'), sha, url);
});

test('Dark Mastermind stays unchanged and the exact Silent Ancient replaces its retired Luna design', async () => {
  const { projectLunaCardArtwork, projectFantasyCardArtwork } = await import('../src/lib/release-card-art');
  const sha = (path: string) => createHash('sha256').update(readFileSync('public' + path)).digest('hex');
  const approved = [
    {
      id: 'LUNA-0343', name: 'Dark Mastermind', ranks: ['secret', 'mythical'],
      detailFile: 'owner-r5.png', thumbFile: 'owner-r5-thumb.webp',
      original: cdn + '/cards/Mythical/Dark%20Mastermind.jpeg?v=1777524996551',
      thumbSha: 'b75f1fd487d44698a66f7a8588be6494a88349aff68f1c53065b17b4a4938f37',
      detailSha: 'cb705885c2a8a56638aaf89581ed94decfab1c8e18f2b6aa03da2142117726ab',
    },
    {
      id: 'LUNA-0382', name: 'The Silent Ancient', ranks: ['secret', 'mythical'],
      detailFile: 'silent-owner-approved-ea4b169dcc31-69bd7ad7c8dd.jpeg', thumbFile: 'silent-owner-approved-ea4b169dcc31-69bd7ad7c8dd-thumb.webp',
      original: cdn + '/cards/Secret/secret_the_silent_ancient.jpg?v=1777524995356',
      thumbSha: '69bd7ad7c8ddfb12e049a896c3c7ba6ea8197dea143a9a8b79034324c3263b9e',
      detailSha: 'ea4b169dcc31e51411c9b33d1ca01696cdbc5b42ac0467ba73c81cea54fffd69',
    },
  ];
  for (const { id, name, ranks, original, thumbSha, detailSha, thumbFile, detailFile } of approved) {
    const folder = '/luna-cinematic/cards/fantasy/' + id + '/';
    for (const rarity of ranks) {
      const source = Object.freeze({ name: Object.freeze({ en: name }), rarity, imageUrl: original });
      const selected = projectLunaCardArtwork(source, true);
      assert.deepEqual(selected, { releaseId: id, original, thumb: folder + thumbFile, detail: folder + detailFile });
      assert.equal(sha(selected!.thumb), thumbSha);
      assert.equal(sha(selected!.detail), detailSha);
      assert.equal(projectLunaCardArtwork(source, false), undefined);
      assert.equal(projectFantasyCardArtwork(source, true), undefined, 'Grand must not receive Luna-only art');
      assert.equal(projectLunaCardArtwork({ ...source, imageUrl: original.replace(/v=.*/, 'v=9999999999999') }, true), undefined);
      assert.equal(projectLunaCardArtwork({ ...source, rarity: 'legendary' }, true), undefined);
      assert.equal(projectLunaCardArtwork({ ...source, name: { en: name + ' (Spawned)' } }, true), undefined);
    }
  }
  assert.equal(sha('/luna-cinematic/cards/fantasy/LUNA-0343/owner-approved.jpeg'), '85917c0d3207adeb7450e5fc16e979c44692b3e953986eb2401b3c7832e10f13');
});

test('the entire 488-card receipt resolves to hashed rasters and the exact 121-card Grand subset', async () => {
  const { projectLunaCardArtwork, projectFantasyCardArtwork, projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const { default: index } = await import('../src/lib/cinematic/release-card-index.json');
  const { default: receipt } = await import('./fixtures/luna-v16-card-art-receipt.json');
  const { default: revisedReceipt } = await import('./fixtures/luna-v19-revised-card-art.json');
  const { default: fantasyRenditionHashes } = await import('./fixtures/luna-fantasy-rendition-sha256.json');
  const fantasyRenditions = new Map(Object.entries(fantasyRenditionHashes));
  const { default: dragonPrints } = await import('./fixtures/luna-v19-dragon-prints.json');
  const { default: factionRenditionHashes } = await import('./fixtures/luna-faction-rendition-sha256.json');
  const factionRenditions = new Map(Object.entries(factionRenditionHashes));
  const dragonRevisions = new Map(Object.entries(dragonPrints));
  const revisions = new Map(Object.entries(revisedReceipt));
  assert.equal(index.fantasy.length, 162);
  assert.equal(index.faction.length, 326);
  assert.equal(receipt.grandIds.length, 121);
  const expected = new Map(Object.entries(receipt.rasterSha256));
  const grandIds = new Set(receipt.grandIds);
  const shownGrand = new Set<string>();
  const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const drift = (url: string) => url.replace(/\?v=\d+$/, '?v=987654321012345678');
  for (const [surface, rows] of Object.entries(index)) {
    for (const [url, name, group, id] of rows) {
      const hashes = expected.get(id);
      assert.ok(hashes, 'No approved receipt or duplicated binding: ' + id);
      expected.delete(id);
      const folder = '/luna-cinematic/cards/' + surface + '/' + id + '/';
      const reviewed = reviewedPrints.get(id);
      if (reviewed) {
        for (const key of ['thumb','medium','detail'] as const)
          assert.equal(sha('public' + reviewed[(key + 'URL') as 'thumbURL' | 'mediumURL' | 'detailURL']), reviewed[key], id + ' ' + key);
      }
      if (id !== 'LUNA-0382') {
        assert.equal(sha('public' + folder + 'thumb.webp'), hashes[0], id + ': thumb');
        assert.equal(sha('public' + folder + 'medium.webp'), hashes[1], id + ': medium');
      }

      if (surface === 'fantasy') {
        const card = { name: { en:name }, rarity:group, imageUrl:url };
        const luna = projectLunaCardArtwork(Object.freeze(card), true);
        const grand = projectFantasyCardArtwork(card, true);
        assert.equal(luna?.releaseId, id);
        assert.equal(luna?.original, url);
        const revision = revisions.get(id);
        if (id === 'LUNA-0392') {
          assert.equal(luna?.detail, kaidanPrints.luna.detail);
          assert.equal(luna?.thumb, kaidanPrints.luna.thumb);
        } else if (reviewed) {
          assert.equal(luna?.detail, reviewed.mediumURL);
          assert.equal(luna?.thumb, reviewed.thumbURL);
        } else if (revision) {
          const path = '/luna-v16/grand/card-revisions-v19/' + id + '/';
          const version = '?v=' + revision.detail.slice(0, 16);
          assert.equal(luna?.detail, path + 'detail.webp' + version);
          assert.equal(luna?.thumb, path + 'thumb.webp' + version);
          assert.equal(sha('public' + path + 'detail.webp'), revision.detail);
          assert.equal(sha('public' + path + 'thumb.webp'), revision.thumb);
        } else if (fantasyRenditions.has(id)) {
          const display = fantasyRenditions.get(id)!;
          const stem = folder + 'display-' + display.native.slice(0, 16);
          assert.equal(luna?.thumb, stem + '-thumb.webp');
          assert.equal(luna?.detail, stem + '-medium.webp');
          assert.equal(sha('public' + luna.thumb), display.thumb);
          assert.equal(sha('public' + luna.detail), display.medium);
        } else if (id === 'LUNA-0342' || id === 'LUNA-0382') {
          assert.match(luna!.detail, /-owner-approved-.*\.jpeg$/);
          assert.match(luna!.thumb, /-owner-approved-.*-thumb\.webp$/);
        } else {
          assert.equal(luna?.detail, folder + (id === 'LUNA-0343' ? 'owner-r5.png' : 'medium.webp'));
          assert.equal(luna?.thumb, folder + (id === 'LUNA-0343' ? 'owner-r5-thumb.webp' : 'thumb.webp'));
        }
        assert.equal(projectLunaCardArtwork({ ...card, imageUrl: drift(url) }, true), undefined, id + ': changed Luna version');
        assert.equal(grand?.releaseId, grandIds.has(id) ? id : undefined, id + ': Grand allowlist');
        if (grand) {
          shownGrand.add(id);
          assert.equal(grand.detail, luna!.detail);
          assert.equal(grand.thumb, luna!.thumb);
          assert.equal(projectFantasyCardArtwork({ ...card, imageUrl: drift(url) }, true), undefined, id + ': changed Grand version');
        }
      } else {
        const card = { image:url, name };
        const legacy = url.slice((cdn + '/LunaPairs/').length);
        const faction = projectFactionCardArtwork(group, Object.freeze(card), true);
        assert.equal(faction?.releaseId, id);
        assert.equal(faction?.original, url);
        const shapeRepair = id === 'LUNA-0513' ? 'hand' : (id === 'LUNA-0576' || id === 'LUNA-0588') ? 'feather' : id === 'LUNA-0487' ? 'shape' : null;
        const exactRepair = id === 'LUNA-0547' ? 'bowstring-v18-15487bfce7ab' : shapeRepair ? shapeRepair + '-qa' : undefined;
        const dragon = dragonRevisions.get(id);
        const display = factionRenditions.get(id);
        if (id === 'LUNA-0420') {
          assert.equal(faction?.detail, kaidanPrints.faction.detail);
          assert.equal(faction?.thumb, kaidanPrints.faction.thumb);
        } else if (reviewed) {
          assert.equal(faction?.detail, reviewed.mediumURL);
          assert.equal(faction?.thumb, reviewed.thumbURL);
        } else if (dragon) {
          assert.equal(faction?.detail, folder + dragon.stem + '-medium.webp');
          assert.equal(faction?.thumb, folder + dragon.stem + '-thumb.webp');
          assert.equal(sha('public' + faction.detail), dragon.medium);
          assert.equal(sha('public' + faction.thumb), dragon.thumb);
        } else if (display) {
          const stem = folder + 'from-' + display.source.slice(0, 16);
          assert.equal(faction?.detail, stem + '-medium.webp');
          assert.equal(faction?.thumb, stem + '-thumb.webp');
          assert.equal(sha('public' + faction.detail), display.medium);
          assert.equal(sha('public' + faction.thumb), display.thumb);
        } else {
          assert.equal(faction?.detail, folder + (exactRepair ? exactRepair + '.png' : 'medium.webp'));
          assert.equal(faction?.thumb, folder + (exactRepair ? exactRepair + '-thumb.webp' : 'thumb.webp'));
        }
        if (shapeRepair) { assert.ok(sha('public' + faction!.detail)); assert.ok(sha('public' + faction!.thumb)); }
        assert.equal(projectFactionCardArtwork(group, { ...card, image: legacy }, true)?.releaseId, id, id + ': same version, relative');
        assert.equal(projectFactionCardArtwork(group, { ...card, image: legacy.split('?')[0] }, true)?.releaseId, id, id + ': exact bare legacy');
        assert.equal(projectFactionCardArtwork(group, { ...card, image: drift(url) }, true), undefined, id + ': changed Faction version');
        assert.equal(projectFactionCardArtwork(group, { ...card, image: drift(legacy) }, true), undefined, id + ': changed Faction relative version');
      }
    }
  }
  assert.equal(expected.size, 0, 'Orphan or missing approved rasters');
  assert.deepEqual(shownGrand, grandIds);
});

test('Sabel hand repair is independent, exact, and does not shadow a new official image version', async () => {
  const { projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const stock = { name: 'Sable', image: 'knights_sable.png?v=1777513006111' };
  const result = projectFactionCardArtwork('knights', stock, true)!;
  assert.equal(result.releaseId, 'LUNA-0513');
  assert.match(result.thumb, /hand-qa-thumb\.webp$/);
  assert.equal(createHash('sha256').update(readFileSync('public'+result.detail)).digest('hex'), '46c535ebd805fe9d12b5dc6d2bccb71451b98f6ca9a89e7f48038f3fee0ebaba');
  assert.equal(projectFactionCardArtwork('knights', {...stock, image:'knights_sable.png?v=different'}, true), undefined);
  assert.equal(projectFactionCardArtwork('warriors', stock, true), undefined);
});

test('confirmed wing fixes stay on their exact Faction card and canonical source revision', async () => {
  const { projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const { default: index } = await import('../src/lib/cinematic/release-card-index.json');
  const hashes = [
    ['LUNA-0576','9b2fe6722563e8d2e5a99b484f820c562c021f69bb3f86fd47f7df8987b5bdd1'],
    ['LUNA-0588','202fe69677ee1f372ce5929b8e7ef10427020f89c2c25eec38fc6819c84cc881'],
    ['LUNA-0487','78a8ebcdb637af3e96eaef97559503acb0e3fd72d89648b96bae2203d6f1536e'],
  ];
  for (const [id, sha] of hashes) {
    const source = index.faction.find(row => row[3] === id);
    assert.ok(source,id);
    const [image,name,group] = source;
    const out = projectFactionCardArtwork(group,{image,name},true)!;
    assert.equal(out.releaseId,id);
    const archived = '/luna-cinematic/cards/faction/' + id + '/' + (id === 'LUNA-0487' ? 'shape' : 'feather') + '-qa.png';
    const revised = reviewedPrints.get(id);
    assert.equal(createHash('sha256').update(readFileSync('public'+archived)).digest('hex'),sha);
    assert.equal(out.detail, revised?.mediumURL ?? archived);
    assert.equal(projectFactionCardArtwork(group,{image:image+'&changed=1',name},true),undefined);
  }
});
test('Faction printed titles retain each record and separate character spelling variants', async () => {
  const { projectFactionCardArtwork } = await import('../src/lib/release-card-art');
  const { archiveCardMatcher } = await import('../src/lib/cinematic/archive-card-search');
  const { default: index } = await import('../src/lib/cinematic/release-card-index.json');
  const cases = [
    ['LUNA-0458', 'Bloodforged Drake', ''],
    ['LUNA-0493', 'Bloodforged Knight', ''],
    ['LUNA-0476', 'Moon Serpent', ''],
    ['LUNA-0513', 'Sable', 'Sabel'],
    ['LUNA-0536', 'Corin Avelle', ''],
    ['LUNA-0548', 'Kael Vandar', 'Kael Vendar'],
    ['LUNA-0598', 'Umbreon', ''],
  ] as const;
  for (const [id, primary, printedAs] of cases) {
    const [image, name, faction] = index.faction.find(row => row[3] === id)!;
    const card = Object.freeze({ name, image });
    const projected = projectFactionCardArtwork(faction, card, true);
    assert.equal(projected?.releaseId, id);
    assert.equal(projected?.title ?? name, primary);
    assert.equal(projected?.printedAs ?? '', printedAs);
    for (const query of [name, primary, printedAs].filter(Boolean)) {
      for (const locale of ['en', 'ar'] as const) {
        assert.ok(archiveCardMatcher('faction-war', locale, query)(id, primary, name, printedAs));
      }
    }
    assert.equal(projectFactionCardArtwork(faction, card, false), undefined);
    assert.equal(projectFactionCardArtwork(faction, { name, image: image + 'x' }, true), undefined);
  }
});
