export type HarbourFilmName = 'quayside' | 'night-market' | 'treasury';

export type SectionWindowScene = {
  film?: HarbourFilmName;
  id: string;
  profile: string;
  art: string;
  material: string;
  x: number;
  y: number;
  seconds: number;
  travel: number;
};

const sections: Record<string, SectionWindowScene> = {
  '': {id:'home', profile:'quay-wake', film:'quayside', art:'/luna-cinematic/harbour-films/quayside/wide-3840.webp', material:'tide', x:50, y:68, seconds:8, travel:0},
  'story': {id:'story', profile:'after-the-battle', art:'/luna-cinematic/home-story/story/champion-remastered.webp', material:'shaft', x:72, y:33, seconds:19, travel:-16},
  'characters': {id:'cast', profile:'archive-lantern', art:'/luna-cinematic/people/hero/archive-intro.webp', material:'lamp', x:79, y:52, seconds:12, travel:6},
  'luna-fantasy': {id:'dealer', profile:'foil-across-felt', art:'/luna-cinematic/cards/stages/luna/table.webp', material:'foil', x:67, y:67, seconds:13, travel:15},
  'grand-fantasy': {id:'grand', profile:'casting-hand-turn', art:'/luna-v16/grand/art/game-motion/r4/casting-hand.webp', material:'aperture', x:62, y:62, seconds:18, travel:-8},
  'faction-war': {id:'council', profile:'brazier-updraft', art:'/luna-cinematic/cards/stages/faction/war-council-hall.webp', material:'ember', x:81, y:65, seconds:11, travel:-10},
  'members': {id:'members', profile:'hall-window', art:'/luna-cinematic/section-windows/members.webp', material:'waterlight', x:72, y:76, seconds:15, travel:-5},
  'partners': {id:'partners', profile:'two-lamps', art:'/luna-cinematic/home-story/highlights/partners.webp', material:'lamps', x:66, y:47, seconds:11, travel:14},
  'bank': {id:'bank', profile:'coin-edge', art:'/luna-cinematic/economy/bank-salary.webp', material:'specular', x:74, y:69, seconds:15, travel:12},
  'bazaar': {id:'bazaar', profile:'bazaar-canopy', art:'/luna-cinematic/economy/bazaar.webp', material:'canopy', x:76, y:38, seconds:16, travel:-9},
  'bazaar/kael': {id:'kael', profile:'forge-bellows', art:'/luna-cinematic/section-windows/kael.webp', material:'ember', x:70, y:63, seconds:8, travel:13},
  'bazaar/meluna': {id:'meluna', profile:'glass-refraction', art:'/luna-cinematic/economy/meluna-specimens.webp', material:'glass', x:61, y:56, seconds:12, travel:-12},
  'bazaar/zoldar': {id:'zoldar', profile:'gearwright-shutter', art:'/luna-cinematic/section-windows/zoldar.webp', material:'shutter', x:76, y:48, seconds:15, travel:8},
  'bazaar/seluna': {id:'seluna', profile:'moon-garden', art:'/luna-cinematic/section-windows/seluna.webp', material:'petals', x:72, y:44, seconds:20, travel:-17},
  'bazaar/brimor': {id:'brimor', profile:'loom-shuttle', art:'/luna-cinematic/economy/brimor-loom.webp', material:'warp', x:66, y:59, seconds:14, travel:17},
  'bazaar/mells': {id:'mells', profile:'gallery-oculus', art:'/luna-cinematic/section-windows/mells.webp', material:'aperture', x:72, y:39, seconds:22, travel:9},
  'trading': {id:'trading', profile:'exchange-lantern', art:'/luna-cinematic/editorial-public/trading-room.webp', material:'lamp', x:73, y:49, seconds:10, travel:-8},
  'marketplace': {id:'marketplace', profile:'market-awning', art:'/luna-cinematic/section-windows/marketplace.webp', material:'canopy', x:65, y:36, seconds:19, travel:13},
  'about': {id:'about', profile:'sundial-shadow', art:'/luna-cinematic/section-windows/about.webp', material:'shutter', x:69, y:68, seconds:26, travel:-14},
  'faq': {id:'faq', profile:'library-skylight', art:'/luna-cinematic/section-windows/faq.webp', material:'shaft', x:76, y:35, seconds:18, travel:9},
  'contact': {id:'contact', profile:'signal-at-the-quay', art:'/luna-cinematic/section-windows/contact.webp', material:'signal', x:83, y:55, seconds:12, travel:-9},
  'privacy': {id:'privacy', profile:'vault-slit', art:'/luna-cinematic/section-windows/privacy.webp', material:'slit', x:68, y:47, seconds:21, travel:-7},
  'terms': {id:'terms', profile:'royal-hall-seal', art:'/luna-cinematic/section-windows/terms.webp', material:'specular', x:72, y:41, seconds:18, travel:-11},
  'refund': {id:'refund', profile:'canal-return', art:'/luna-cinematic/section-windows/refund.webp', material:'tide', x:68, y:71, seconds:23, travel:-12},
  'profile': {id:'profile', profile:'atrium-leaves', art:'/luna-cinematic/section-windows/profile.webp', material:'canopy', x:82, y:36, seconds:18, travel:7},
  'auth/signin': {id:'signin', profile:'gate-lantern', art:'/luna-cinematic/section-windows/signin.webp', material:'lamp', x:75, y:59, seconds:11, travel:7},
};

export const additionalWindows = {
  'home-market': {id:'home-market', profile:'lanterns-and-kettle', film:'night-market', art:'/luna-cinematic/harbour-films/night-market/scene-1942.webp', material:'canopy', x:77, y:44, seconds:8, travel:0},
  'home-bank': {id:'home-bank', profile:'mechanical-vault', film:'treasury', art:'/luna-cinematic/harbour-films/treasury/scene-1942.webp', material:'specular', x:65, y:46, seconds:8, travel:0},
  'signin-top': {id:'signin-entry', profile:'approach-the-city', art:'/luna-cinematic/section-windows/signin-entry.webp', material:'waterlight', x:70, y:73, seconds:19, travel:-11},
  'marketplace-top': {id:'market-entry', profile:'merchant-arcade', art:'/luna-cinematic/section-windows/market-entry.webp', material:'foil', x:71, y:60, seconds:16, travel:8},
  'missing': {id:'unlisted', profile:'dusk-atlas', art:'/luna-cinematic/home-story/observatory/atlas-dusk-960.webp', material:'aperture', x:75, y:40, seconds:23, travel:-5},
} satisfies Record<string, SectionWindowScene>;

export function sectionWindowFor(pathname: string): SectionWindowScene {
  const path = pathname.split(/[?#]/, 1)[0].split('/').filter(Boolean);
  if (path[0] === 'ar' || path[0] === 'en') path.shift();
  const key=path.join('/');
  return Object.prototype.hasOwnProperty.call(sections,key) ? sections[key] : additionalWindows.missing;
}
