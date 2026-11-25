export const pillars = [
  {key:'story',href:'/story',art:'/luna-cinematic/night-worlds/story-960.webp'},
  {key:'cards',href:'/luna-fantasy',art:'/luna-cinematic/cards/stages/luna/table.webp'},
  {key:'economy',href:'/bazaar',art:'/luna-cinematic/night-worlds/bazaar-960.webp'},
  {key:'community',href:'/members',art:'/luna-cinematic/night-worlds/members-960.webp'},
] as const;

export function nextPillar(current: number, key: string, rtl: boolean) {
  if (key==='Home') return 0;
  if (key==='End') return pillars.length-1;
  if (key!=='ArrowRight' && key!=='ArrowLeft') return;
  const step=(key==='ArrowRight')!==rtl?1:-1;
  return (current+step+pillars.length)%pillars.length;
}
