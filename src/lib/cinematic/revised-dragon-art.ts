// The portrait and faction face have independent compositions and versioned local files.
const revisions: Readonly<Record<string, string>> = {
  'LUNA-0037': '/luna-cinematic/people/gallery/LUNA-0037/blood-marsh-wading-b161c14891781b57',
  'LUNA-0093': '/luna-cinematic/people/gallery/LUNA-0093/glacial-river-4210e283dc5e7047',
  'LUNA-0458': '/luna-cinematic/cards/faction/LUNA-0458/blood-marsh-folded-wing-08b7119055704786',
  'LUNA-0470': '/luna-cinematic/cards/faction/LUNA-0470/glacial-pass-553d80eeb132fd48',
};

export function revisedDragonArtwork(id: string | null | undefined) {
  if (!id || !Object.hasOwn(revisions, id)) return;
  const base = revisions[id];
  return { id, thumb: base + '-thumb.webp', medium: base + '-medium.webp', detail: base + '.png' };
}
