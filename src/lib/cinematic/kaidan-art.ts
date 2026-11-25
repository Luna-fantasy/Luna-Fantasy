// Kaidan has one collectible Unique, one Faction War card and one gallery portrait.
const poses = {
  "gallery": "/luna-cinematic/kaidan/LUNA-0243/gallery-unarmed-e6900b2e983e",
  "faction": "/luna-cinematic/kaidan/LUNA-0420/faction-unarmed-4f8f912c83ab",
  "luna": "/luna-cinematic/kaidan/LUNA-0392/luna-unarmed-f5b7f0d86b75"
} as const;

type Pose = keyof typeof poses;

function face(pose: Pose) {
  const stem = poses[pose];
  return { thumb: stem + '-thumb.webp', medium: stem + '.webp', detail: stem + '.webp' };
}

export function kaidanForRelease(id: string | null | undefined) {
  if (id === 'LUNA-0243') return { id, ...face('gallery') };
  if (id === 'LUNA-0420') return { id, ...face('faction') };
  if (id === 'LUNA-0392') return { id, ...face('luna') };
}

// Owned cards and market listings can retain an older cache stamp for the same official print.
const collectibleSource = /^https:\/\/assets\.lunarian\.app\/cards\/Unique\/Kaidan\.png(?:\?v=\d+)?$/;

export function collectibleDisplayImage(source: string, size: 'thumb' | 'detail' = 'detail') {
  return collectibleSource.test(source) ? face('luna')[size] : source;
}
