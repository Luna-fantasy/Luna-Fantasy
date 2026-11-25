import type { ArchiveKind } from './archive-carousel-model';

export const approvedOnly = new Set(["LUNA-0382"]);
export const reversePrints: Record<string, number> = {"LUNA-0264":0,"LUNA-0293":2,"LUNA-0305":4,"LUNA-0384":3,"LUNA-0335":1};

function xf(x: number, y: number, scale: number, rx: number, ry: number, rz: number, z = 0) {
  return 'translate3d('+x+'px,'+y+'px,'+z+'px) rotateX('+rx+'deg) rotateY('+ry+'deg) rotateZ('+rz+'deg) scale('+scale+')';
}

export function archiveInspectionMotion(kind: ArchiveKind, x: number, y: number, k: number, dir: number, closing = false, current = 'none'): Keyframe[]{
  const neutral=xf(0,0,1,0,0,0),origin=xf(x,y,k,0,0,0);
  const showing=current==='none'?neutral:current;
  if (kind === 'luna'){
   const handed=x<0?-1:1;
   return closing?[
    {transform:showing,offset:0},
    {transform:xf(x*.17,-25,.88,30,14*handed,-11*handed,55),offset:.39},
    {transform:origin,offset:1}
   ]:[
    {transform:xf(x,y,k,45,-15*handed,8*handed),offset:0},
    {transform:xf(x*.27,-23,.78,24,13*handed,-13*handed,60),offset:.47},
    {transform:xf(0,-7,1.032,-4,0,3*handed,14),offset:.83},
    {transform:neutral,offset:1}
   ];
  }
  if (kind === 'grand'){
   const hinge=dir>0?'left center':'right center';
   return closing?[
    {transform:showing,transformOrigin:hinge,opacity:1,offset:0},
    {transform:xf(x*.09,y*.04,.95,2,67*dir,0,22),transformOrigin:hinge,opacity:.92,offset:.64},
    {transform:origin,transformOrigin:hinge,opacity:1,offset:1}
   ]:[
    {transform:xf(x,y,k,1,67*dir,0),transformOrigin:hinge,opacity:.5,offset:0},
    {transform:xf(x*.05,y*.07,.96,0,64*dir,0,20),transformOrigin:hinge,opacity:.91,offset:.39},
    {transform:xf(0,0,1.005,0,-4*dir,0,4),transformOrigin:hinge,opacity:1,offset:.92},
    {transform:neutral,transformOrigin:hinge,opacity:1,offset:1}
   ];
  }
  // Faction: a crest comes up on the centerline, then its banner opens top to bottom.
  const open='inset(0 0 0 0 round 7px)',shut='inset(0 0 84% 0 round 7px)';
  return closing?[
   {transform:showing,clipPath:open,offset:0},
   {transform:xf(0,27,.91,0,0,0),clipPath:shut,offset:.55},
   {transform:origin,clipPath:shut,offset:.90},
   {transform:origin,clipPath:open,offset:1}
  ]:[
   {transform:xf(x,y,k,0,0,0),clipPath:shut,offset:0},
   {transform:xf(0,27,.91,0,0,0),clipPath:shut,offset:.42},
   {transform:xf(0,5,1.014,0,0,0),clipPath:open,offset:.89},
   {transform:neutral,clipPath:open,offset:1}
  ];
 }
