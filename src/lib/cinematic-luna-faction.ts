import { projectFactionCardArtwork } from './release-card-art';
import { reviewedArtwork } from './cinematic/reviewed-artwork';

/** Exact artwork extracted byte-for-byte from approved release 5aaac7d4. */
export const lunaDealer = {
  "poster": "/luna-cinematic/cards/stages/luna/table.webp",
  "cards": [
    {
      "id": "LUNA-0264",
      "front": "/luna-cinematic/cards/stages/luna/LUNA-0264-face.webp",
      "back": "/luna-cinematic/cards/stages/luna/LUNA-0264-back.webp"
    },
    {
      "id": "LUNA-0335",
      "front": "/luna-cinematic/cards/stages/luna/LUNA-0335-face.webp",
      "back": "/luna-cinematic/cards/stages/luna/LUNA-0335-back.webp"
    },
    {
      "id": "LUNA-0293",
      "front": "/luna-cinematic/cards/stages/luna/LUNA-0293-face.webp",
      "back": "/luna-cinematic/cards/stages/luna/LUNA-0293-back.webp"
    },
    {
      "id": "LUNA-0384",
      "front": "/luna-cinematic/cards/stages/luna/LUNA-0384-face.webp",
      "back": "/luna-cinematic/cards/stages/luna/LUNA-0384-back.webp"
    },
    {
      "id": "LUNA-0305",
      "front": "/luna-cinematic/cards/stages/luna/LUNA-0305-face.webp",
      "back": "/luna-cinematic/cards/stages/luna/LUNA-0305-back.webp"
    }
  ]
} as const;
export const councilHall = {
  "desktop": "/luna-cinematic/cards/stages/faction/war-council-hall.webp",
  "mobile": "/luna-cinematic/cards/stages/faction/war-council-small.webp"
} as const;

type CouncilArt = { id:string; name:string; card:string; seal:string|null };
const representatives: Readonly<Record<string, CouncilArt>> = {
  "beasts": {
    "id": "LUNA-0416",
    "name": "Giant Bear",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0416.webp",
    "seal": "/luna-cinematic/cards/stages/faction/seal-LUNA-0416.webp"
  },
  "colossals": {
    "id": "LUNA-0430",
    "name": "Abyssal Colossus",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0430.webp",
    "seal": "/luna-cinematic/cards/stages/faction/seal-LUNA-0430.webp"
  },
  "dragons": {
    "id": "LUNA-0457",
    "name": "Ancient Dragon",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0457.webp",
    "seal": "/luna-cinematic/cards/stages/faction/seal-LUNA-0457.webp"
  },
  "knights": {
    "id": "LUNA-0494",
    "name": "Bod Aban",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0494.webp",
    "seal": "/luna-cinematic/cards/stages/faction/seal-LUNA-0494.webp"
  },
  "lunarians": {
    "id": "LUNA-0549",
    "name": "King",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0549.webp",
    "seal": null
  },
  "moon_creatures": {
    "id": "LUNA-0572",
    "name": "Alpha Direwolf",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0572.webp",
    "seal": null
  },
  "mythical_creatures": {
    "id": "LUNA-0609",
    "name": "Griffin",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0609.webp",
    "seal": "/luna-cinematic/cards/stages/faction/seal-LUNA-0609.webp"
  },
  "strange_beings": {
    "id": "LUNA-0622",
    "name": "Astral Harbinger",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0622.webp",
    "seal": "/luna-cinematic/cards/stages/faction/seal-LUNA-0622.webp"
  },
  "supernatural": {
    "id": "LUNA-0656",
    "name": "Elder Vampire",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0656.webp",
    "seal": "/luna-cinematic/cards/stages/faction/seal-LUNA-0656.webp"
  },
  "underworld": {
    "id": "LUNA-0676",
    "name": "Banished General",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0676.webp",
    "seal": null
  },
  "warriors": {
    "id": "LUNA-0728",
    "name": "Solar Warrior",
    "card": "/luna-cinematic/cards/stages/faction/LUNA-0728.webp",
    "seal": null
  }
};
export const councilGroupOrder = Object.keys(representatives);

export function councilRepresentative(factionId: string, cards: ReadonlyArray<{name:string;image:string}>): CouncilArt | undefined {
  if (!Object.hasOwn(representatives, factionId)) return;
  const target = representatives[factionId];
  const matches = cards.filter(card =>
    card.name === target.name && projectFactionCardArtwork(factionId, card, true)?.releaseId === target.id
  );
  if (matches.length !== 1) return;
  const reviewed = reviewedArtwork(target.id);
  return reviewed ? { ...target, card: reviewed.medium } : target;
}

export function nextCouncilIndex(current: number, step: number, size: number) {
  return size > 0 ? ((current + step) % size + size) % size : 0;
}
export function councilComposition(groups: readonly string[], selected: number, opening: boolean) {
  if (opening && groups[selected] === 'knights' && groups.includes('colossals') && groups.includes('dragons'))
    return ['colossals','knights','dragons'];
  if (groups.length < 3) return [...groups];
  return [-1,0,1].map(step=>groups[nextCouncilIndex(selected,step,groups.length)]);
}
export function dealerProgress(value: number) { return Math.min(1, Math.max(0,value)); }

export function dealerPose(index: number, scroll: number, portrait = false) {
  const i = Math.min(4,Math.max(0,index)), a = i-2;
  // Authored key beats of the approved deal, adapted to DOM transforms.
  const stops = [
    [0, -.14-.038*i, .72+.025*i, .25, 54, 151-i*8, -57+5*i],
    [.22, (portrait?.46:.49)+a*(portrait?.135:.108), .64+Math.abs(a)*.046, .30, 26, 18+a*11, a*14-6],
    [.43, .5+a*(portrait?.169:.154), .49+Math.abs(a)*.069, .37, -12, a*21, a*16],
    [.65, .49+a*(portrait?.16:.19), .50+Math.abs(a)*.085, .40, -4, a*26, a*17-5],
    [.82, .49+a*.142, .57+Math.abs(a)*.052, .30, 19, a*9, a*7],
    [1, .54+.083*a, .62-.031*i, .19, 58, 162, a*5],
  ];
  const t = dealerProgress((scroll-i*.011)/(1-i*.011));
  let j = 0; while (j < stops.length-2 && t > stops[j+1][0]) j += 1;
  const l = stops[j], r = stops[j+1], u=dealerProgress((t-l[0])/(r[0]-l[0])), eased=u*u*(3-2*u);
  return l.slice(1).map((n,k)=>n+(r[k+1]-n)*eased);
}

export const cinematicAssetReceipts = [
  [
    "/luna-cinematic/cards/stages/luna/table.webp",
    "04369e97e4d1c786cf8768b84d881fc1b88f2ac33960bde47e220df1d2fd6d7d"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0264-face.webp",
    "19330c90a440d8c9b3d04593dc4b14fe54898fe6d7d17d951657cbe5a71c2185"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0264-back.webp",
    "3a8c746c464d0d843d22143dfca1464308c4c171845a30ead194a70bc31fa06d"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0335-face.webp",
    "16f07f2c6a46831e5d9c0a783ff80e3b78838e28d24eb2a2d871a3d9e08e3b7b"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0335-back.webp",
    "63b3ec31b271ecf0b755ebe6c575dae01e2f486c44f0b51304f6fd12791af219"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0293-face.webp",
    "01c585dcc6363bcec16deeb5f32f67d1add85c146032e708532d4f9f18f23b42"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0293-back.webp",
    "f8890b122b4f53957c17981e406897e7822f14b90a043d183282f242f8a807b1"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0384-face.webp",
    "43d26bf04d69618faeea786aedfbd2a566974cf0b26507db3293ed2041a2e17e"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0384-back.webp",
    "208b0810cb95c92e023f87c8ef52d4c20213cb62ce2239edb58b62a864f44c1a"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0305-face.webp",
    "dba91681547b54f869d6504f2c67d474a8657e672291f9fe383fe11c3499ec05"
  ],
  [
    "/luna-cinematic/cards/stages/luna/LUNA-0305-back.webp",
    "7973c355677c4a288c3f07c3b245b168a1db75eab4694967fa0d799129a35577"
  ],
  [
    "/luna-cinematic/cards/stages/faction/war-council-hall.webp",
    "6171ef84052c24e0a956e840fbf281cb79e0363cc688f4c2edc3ed4d802ce5b8"
  ],
  [
    "/luna-cinematic/cards/stages/faction/war-council-small.webp",
    "7bee28f5a3c6f447aee3017b585fe5d9298ac7e31c16b03225f169ea9ed73f38"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0416.webp",
    "acf42dd3b5991f0aa7b5e0e718282f62a38e3cebd964a33035f55f3b5e6031c1"
  ],
  [
    "/luna-cinematic/cards/stages/faction/seal-LUNA-0416.webp",
    "0239c4a1b0c981103ca0b098ad57e309d20d8ce91b760bb9735084e747b4fffa"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0430.webp",
    "b76028a439c688affba68f630fac9ec2626dcead757e763f1d8e21d24d08c20e"
  ],
  [
    "/luna-cinematic/cards/stages/faction/seal-LUNA-0430.webp",
    "58a304a4a215d6a460fa3a511d3c32fc02629dd17bfeed48fedda7c141507332"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0457.webp",
    "a7f279aefba292313e22a33a43bb68880a878139f4d5be5025e576329076f11f"
  ],
  [
    "/luna-cinematic/cards/stages/faction/seal-LUNA-0457.webp",
    "0cc3fbcc524f86c4506fa81c482a1f94e42b4660b18a7faf4f7c799ef8730a00"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0494.webp",
    "e4ab1ab6662259b16c9768898f6d6090dc6b1cc687d1343c0865c1d745058dbe"
  ],
  [
    "/luna-cinematic/cards/stages/faction/seal-LUNA-0494.webp",
    "6563b5d3c57ab8a04d12b54e7618fb2129a7a908bcce9b89b1044f9306bb03e5"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0549.webp",
    "5972c477e64d7c814bb38e04454299c4f9a6e67cf6078e11fc53ecc0dc7e0f43"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0572.webp",
    "090fc34e404d5935434f7a18dd35c6be9a940020bb757fd95486ede8cee99a54"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0609.webp",
    "2710817110c211efe9308c76fbf446d998afd6a79ef48f555662595a3e7921fa"
  ],
  [
    "/luna-cinematic/cards/stages/faction/seal-LUNA-0609.webp",
    "bed40253243f8dbc3ff65c5397299828f3969ff4cebbf82dff7e4601e4579fb3"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0622.webp",
    "cd0a726db9cddd71e34594b4e5ce3b9e012a91d7be2597dd57a6889dbce03dcc"
  ],
  [
    "/luna-cinematic/cards/stages/faction/seal-LUNA-0622.webp",
    "6ecbd76f0c37788dea390da168ad2f7b8b2f83583b4ba9183aa4893becd0ce0b"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0656.webp",
    "d5a063bae405e1d6f547739fc504d2209f5e066859271dc013ee1d81f88adbbc"
  ],
  [
    "/luna-cinematic/cards/stages/faction/seal-LUNA-0656.webp",
    "1a80775d1667e7226f8367870068589f39d1550121e2f90c4c8d6643349835e9"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0676.webp",
    "2c44efdd17f938830ca6a6519beec460c29274ad488ec7a94bc0ee8107213eff"
  ],
  [
    "/luna-cinematic/cards/stages/faction/LUNA-0728.webp",
    "692c8526fa9335be41c57936cdab7927e00bb74b48be32777a5d675f7a2ad497"
  ]
] as const;
