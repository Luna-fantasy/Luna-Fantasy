import { revisedFantasyFace } from './cinematic/revised-fantasy-face';
import fantasyDisplaySources from './cinematic/fantasy-display-sources.json';
import { revisedDragonArtwork } from './cinematic/revised-dragon-art';
import approvedCards from './cinematic/release-card-index.json';
import factionDisplaySources from './cinematic/faction-display-sources.json';
import { reviewedArtwork } from './cinematic/reviewed-artwork';
import { cinematicPresentationEnabled } from './cinematic/presentation-flags';

/** Public presentation only: release IDs never replace official DB, admin or gameplay identities. */
const factionCdn = 'https://assets.lunarian.app/LunaPairs/';
const assetBase = '/luna-cinematic/cards';
type FantasyRecord = { name: { en: string }; rarity: string; imageUrl: string };
type FactionRecord = { name: string; image: string };
type ReleaseId = `LUNA-${string}`;
const fantasyDisplayDigests: Readonly<Partial<Record<ReleaseId, string>>> = fantasyDisplaySources;
export type ReleaseCardArt = Readonly<{
  releaseId: ReleaseId;
  thumb: string;
  detail: string;
  original: string;
  title?: string;
  printedAs?: string;
}>;
type ApprovedRecord = Readonly<{ name: string; group: string; id: ReleaseId }>;
type Face = Readonly<{ thumb: string; detail: string }>;
const approvedMythicalFaces: Readonly<Partial<Record<ReleaseId, Face>>> = {
  'LUNA-0342': { thumb: 'dragon-owner-approved-6e3302ff5c7e-bba965e4e72a-thumb.webp', detail: 'dragon-owner-approved-6e3302ff5c7e-bba965e4e72a.jpeg' },
  'LUNA-0343': { thumb: 'owner-r5-thumb.webp', detail: 'owner-r5.png' },
  'LUNA-0382': { thumb: 'silent-owner-approved-ea4b169dcc31-69bd7ad7c8dd-thumb.webp', detail: 'silent-owner-approved-ea4b169dcc31-69bd7ad7c8dd.jpeg' },
};

function byVersionedSource(rows: readonly string[][]) {
  const result = new Map<string, ApprovedRecord>();
  for (const [source, name, group, id] of rows) result.set(source, { name, group, id: id as ReleaseId });
  return result;
}

const fantasy = byVersionedSource(approvedCards.fantasy);
const faction = byVersionedSource(approvedCards.faction);
const factionRenditionSources: Readonly<Partial<Record<ReleaseId, string>>> = factionDisplaySources;
// These titles were read from the native Faction prints. Two cards have a
// historical spelling that differs from their established character or merchant name.
const factionPrintLabels: Readonly<Partial<Record<ReleaseId, { title?: string; printedAs?: string }>>> = {
  'LUNA-0427': { title: 'Saber Tooth' },
  'LUNA-0431': { title: 'Big Foot' },
  'LUNA-0445': { title: 'The Mercenary' },
  'LUNA-0458': { title: 'Bloodforged Drake' },
  'LUNA-0476': { title: 'Moon Serpent' },
  'LUNA-0493': { title: 'Bloodforged Knight' },
  'LUNA-0496': { title: 'Elite trooper' },
  'LUNA-0513': { printedAs: 'Sabel' },
  'LUNA-0536': { title: 'Corin Avelle' },
  'LUNA-0548': { printedAs: 'Kael Vendar' },
  'LUNA-0578': { title: 'Great Sage' },
  'LUNA-0589': { title: 'Bunny' },
  'LUNA-0596': { title: 'Beach Guardian' },
  'LUNA-0598': { title: 'Umbreon' },
  'LUNA-0630': { title: 'Gate Keeper' },
  'LUNA-0632': { title: 'The Half-Breed' },
  'LUNA-0641': { title: 'Nullbringer' },
  'LUNA-0654': { title: 'Doppelgänger' },
  'LUNA-0690': { title: 'Judge of Death' },
  'LUNA-0691': { title: 'Abyssal Monarch' },
  'LUNA-0698': { title: 'Shape Shifter' },
  'LUNA-0733': { title: 'Zan the Berserker' },
};
// The official seed/API stores a bare PNG filename for legacy records, not a fabricated row ID.
// Accept only those exact filenames. Never strip a mismatching raw ?v or accept a new URL.
const factionLegacy = new Map<string, ApprovedRecord>();
for (const [source] of approvedCards.faction)
  factionLegacy.set(source.slice(factionCdn.length).split('?')[0], faction.get(source)!);

export function releaseEnabled() {
  return cinematicPresentationEnabled();
}

function select(surface: 'fantasy' | 'faction', releaseId: ReleaseId, original: string, title?: string): ReleaseCardArt {
  const reviewed = surface === 'fantasy' ? reviewedArtwork(releaseId) : undefined;
  if (reviewed) return { releaseId, thumb: reviewed.thumb, detail: reviewed.medium, original, ...(title ? { title } : {}) };
  const revision = surface === 'fantasy' ? revisedFantasyFace(releaseId) : undefined;
  if (revision) return { releaseId, ...revision, original };
  const folder = `${assetBase}/${surface}/${releaseId}`;
  const digest = surface === 'fantasy' ? fantasyDisplayDigests[releaseId] : undefined;
  if (digest) {
    const print = folder + '/display-' + digest.slice(0, 16);
    return { releaseId, thumb: print + '-thumb.webp', detail: print + '-medium.webp', original, ...(title ? { title } : {}) };
  }
  return { releaseId, thumb: folder + '/thumb.webp', detail: folder + '/medium.webp', original, ...(title ? { title } : {}) };
}

/** Grand reuses the 121 exact published non-Secret cards, not other official or spawned cards. */
export function projectFantasyCardArtwork(card: FantasyRecord, enabled = releaseEnabled()): ReleaseCardArt | undefined {
  if (!enabled) return;
  const row = fantasy.get(card.imageUrl);
  if (row && row.group !== 'secret' && row.group === card.rarity && row.name === card.name.en)
    return select('fantasy', row.id, card.imageUrl);
}

export function projectLunaCardArtwork(card: FantasyRecord, enabled = releaseEnabled()): ReleaseCardArt | undefined {
  if (!enabled) return;
  const row = fantasy.get(card.imageUrl);
  if (!row || row.name !== card.name.en) return;

  // Native metadata may name one of these exact three Luna-only cards Secret or Mythical.
  // This permits their authored display, not a classification or gameplay mutation.
  const approved = approvedMythicalFaces[row.id];
  if (row.group !== card.rarity && !(approved && card.rarity === 'mythical')) return;

  if (approved) {
    const folder = `${assetBase}/fantasy/${row.id}`;
    return { releaseId: row.id, thumb: folder + '/' + approved.thumb, detail: folder + '/' + approved.detail, original: card.imageUrl };
  }
  return select('fantasy', row.id, card.imageUrl);
}

/** Character records refer to Luna's native cards by database identity, never by display name. */
export function projectRelatedLunaCard<T extends FantasyRecord & { characterId?: string | null }>(
  cards: readonly T[], characterId: string | null | undefined, enabled = releaseEnabled(),
): { card: T; artwork: ReleaseCardArt | undefined } | undefined {
  if (!characterId?.trim()) return;
  const card = cards.find(candidate => candidate.characterId === characterId);
  if (card) return { card, artwork: projectLunaCardArtwork(card, enabled) };
}

export function projectFactionCardArtwork(factionId: string, card: FactionRecord, enabled = releaseEnabled()): ReleaseCardArt | undefined {
  if (!enabled) return;
  const absolute = card.image.startsWith(factionCdn);
  const original = absolute ? card.image : factionCdn + card.image;
  const row = faction.get(original) ?? (!absolute ? factionLegacy.get(card.image) : undefined);
  if (!row || row.group !== factionId) return;
  const renamedDeer = row.id === 'LUNA-0608';
  if (row.name !== card.name && !(renamedDeer && card.name === 'Great Dear')) return;
  const labels = factionPrintLabels[row.id] ?? (renamedDeer ? { title: row.name } : {});
  const reviewed = reviewedArtwork(row.id) ?? revisedDragonArtwork(row.id);
  if (reviewed) return { releaseId: row.id, thumb: reviewed.thumb, detail: reviewed.medium, original, ...labels };
  const source = factionRenditionSources[row.id];
  if (source) {
    const stem = `${assetBase}/faction/${row.id}/from-${source.slice(0, 16)}`;
    return { releaseId: row.id, thumb: stem + '-thumb.webp', detail: stem + '-medium.webp', original, ...labels };
  }
  if (row.id === 'LUNA-0547') {
    const folder = `${assetBase}/faction/${row.id}/bowstring-v18-15487bfce7ab`;
    return { releaseId: row.id, thumb: folder + '-thumb.webp', detail: folder + '.png', original, ...labels };
  }
  const repair = row.id === 'LUNA-0513' ? 'hand'
    : (row.id === 'LUNA-0576' || row.id === 'LUNA-0588') ? 'feather'
    : row.id === 'LUNA-0487' ? 'shape' : null;
  if (repair) {
    const folder = `${assetBase}/faction/${row.id}`;
    return { releaseId: row.id, thumb: folder + '/' + repair + '-qa-thumb.webp', detail: folder + '/' + repair + '-qa.png', original, ...labels };
  }
  return { ...select('faction', row.id, original), ...labels };
}
