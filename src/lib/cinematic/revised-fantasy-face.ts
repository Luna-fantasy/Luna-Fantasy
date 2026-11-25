// Owner-requested card faces, used by their respective catalogs and inspectors.
const revisions: Readonly<Record<string, string | undefined>> = {
  'LUNA-0281': 'b65851995b3cc8c4',
  'LUNA-0290': 'c5e009c5d499ec97',
  'LUNA-0302': 'd32676a102204e00',
  'LUNA-0316': '9e204b1a23fef44f',
  'LUNA-0323': '79155f620b0be934',
  'LUNA-0341': '5346ba946a0cf93f',
  'LUNA-0347': 'df267afae4252e10',
};

export function revisedFantasyFace(id: string | null | undefined) {
  const version = id && Object.hasOwn(revisions, id) ? revisions[id] : undefined;
  if (!version) return;
  const directory = '/luna-v16/grand/card-revisions-v19/' + id;
  return {
    thumb: directory + '/thumb.webp?v=' + version,
    detail: directory + '/detail.webp?v=' + version,
  };
}
