import {surfaces,loadApprovedTexture} from './textures.mjs?art=final-comparison-3';
import {folioSpreadAt} from './folio-timing.mjs';
const load=url=>new Promise((ok,bad)=>{const im=new Image();im.decoding='async';im.onload=()=>ok(im);im.onerror=bad;im.src=url;});
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)), mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>x*x*(3-2*x);
const xy=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const point=(g,u,v)=>xy(xy(g[0],g[1],u),xy(g[3],g[2],u),v);
function path(c,p){c.beginPath();c.moveTo(...p[0]);for(const q of p.slice(1))c.lineTo(...q);c.closePath();}
function fill(c,p,color){path(c,p);c.fillStyle=color;c.fill();}
function triangle(c,img,s,d){
 const [a,b,o]=s,[p,q,r]=d,den=(b[0]-a[0])*(o[1]-a[1])-(o[0]-a[0])*(b[1]-a[1]);if(!den)return;
 const A=((q[0]-p[0])*(o[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/den;
 const B=((q[1]-p[1])*(o[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/den;
 const C=(-(q[0]-p[0])*(o[0]-a[0])+(r[0]-p[0])*(b[0]-a[0]))/den;
 const D=(-(q[1]-p[1])*(o[0]-a[0])+(r[1]-p[1])*(b[0]-a[0]))/den;
 const center=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3];
 c.save();path(c,d.map(v=>{const k=.62/Math.max(.1,Math.hypot(v[0]-center[0],v[1]-center[1]));return [v[0]+(v[0]-center[0])*k,v[1]+(v[1]-center[1])*k]}));c.clip();
 c.transform(A,B,C,D,p[0]-A*a[0]-C*a[1],p[1]-B*a[0]-D*a[1]);c.drawImage(img,0,0);c.restore();
}
function card(c,img,map,tiles){
 const w=img.naturalWidth,h=img.naturalHeight;
 c.save();path(c,[map(0,0),map(1,0),map(1,1),map(0,1)]);c.clip();
 for(let i=0;i<tiles;i++)for(let j=0;j<4;j++){
  const pts=[[i/tiles,j/4],[(i+1)/tiles,j/4],[(i+1)/tiles,(j+1)/4],[i/tiles,(j+1)/4]];
  const src=pts.map(([u,v])=>[u*w,v*h]),dest=pts.map(([u,v])=>map(u,v));
  for(const k of [[0,1,2],[0,2,3]])triangle(c,img,k.map(x=>src[x]),k.map(x=>dest[x]));
 }c.restore();
}
export async function createCpuFolio(plate){
 const maps=Object.fromEntries(await Promise.all(Object.entries(surfaces).map(async ([key,source])=>{
  const {width,height}=source;
  const im=await loadApprovedTexture(source,load);if(im.naturalWidth!==width||im.naturalHeight!==height)throw new Error('Folio source dimensions: '+key);
  return [key,im];
 })));
 // Hold the real closed book only for the initial beat. Its photo is transparent in the settle;
 // the open cover below supplies its own contact shadow over the unchanged Grand environment.
 const paperNoise=document.createElement('canvas');paperNoise.width=paperNoise.height=64;
 const pc=paperNoise.getContext('2d'),noise=pc.createImageData(64,64);let s=4231;
 for(let i=0;i<noise.data.length;i+=4){s=(Math.imul(1664525,s)+1013904223)>>>0;noise.data[i]=75;noise.data[i+1]=48;noise.data[i+2]=20;noise.data[i+3]=((s>>>24)&31);}
 pc.putImageData(noise,0,0);
 return {draw(c,t,yaw,{x,y,w,h}){
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  const closedAlpha=1-smooth(clamp((t-.032)/.105));
  if(closedAlpha>0){c.save();c.globalAlpha*=closedAlpha;c.drawImage(plate,x,y,w,h);c.restore();}
  if(t<.028){c.restore();return true;}
  const shown=smooth(clamp((t-.028)/.16));
  const {spread:ix,fraction}=folioSpreadAt(t),f=smooth(fraction);
  const X=.0012*yaw, P=([u,v])=>[x+(u+X*(v-.5))*w,y+v*h], q=a=>a.map(P),
    left=[[.185,.215],[.512,.234],[.502,.867],[.085,.797]],right=[[.512,.234],[.793,.267],[.943,.837],[.502,.867]];
  c.globalAlpha=shown;
  const cover=q([[.155,.191],[.808,.236],[.975,.869],[.495,.923],[.049,.832]]);
  c.save();c.shadowColor='#100804';c.shadowBlur=Math.max(3,w*.018);c.shadowOffsetY=h*.022;fill(c,cover,'#2a1712');c.restore();
  path(c,cover);c.lineWidth=Math.max(1,w*.005);c.strokeStyle='#795a42';c.stroke();
  const pagesUnder=q([[.167,.205],[.798,.255],[.948,.851],[.499,.902],[.071,.824]]);
  fill(c,pagesUnder,'#a98560');
  c.save();path(c,pagesUnder);c.clip();for(let j=0;j<6;j++){c.strokeStyle=j%2?'rgba(46,30,13,.40)':'rgba(221,195,131,.48)';c.lineWidth=Math.max(.65,w*.0014);const z=j*.005;path(c,q([[.167,.205+z],[.798,.255+z],[.942,.827+z],[.499,.868+z],[.071,.803+z]]));c.stroke()}c.restore();
  const page=(g,im,reverse=false,curve=0)=>{
   const m=(u,v)=>{const po=point(g,u,v);po[1]-=Math.sin(u*Math.PI)*curve*(.72+v*.28);return P(po)};
   const outline=[...Array.from({length:17},(_,i)=>m(i/16,0)),...Array.from({length:17},(_,i)=>m(1-i/16,1))];
   let a=m(0,.5),b=m(1,.5);
   const grad=c.createLinearGradient(...a,...b);if(reverse){grad.addColorStop(0,'#b1946d');grad.addColorStop(.18,'#ead8b1');grad.addColorStop(.73,'#eedfbd');grad.addColorStop(1,'#d3ba92');}
   else{grad.addColorStop(0,'#e8d4ac');grad.addColorStop(.78,'#e4d4b0');grad.addColorStop(1,'#ae8e6b');}
   fill(c,outline,grad);
   path(c,outline);c.lineWidth=Math.max(.7,w*.0017);c.strokeStyle='#c7aa83';c.stroke();
   c.save();path(c,outline);c.clip();c.fillStyle=c.createPattern(paperNoise,'repeat');c.fillRect(x,y,w,h);c.restore();
   if(im) card(c,im,(u,v)=>m(.115+u*.755,.105+v*.79),curve?10:6);
   if(curve){const fold=c.createLinearGradient(...a,...b);fold.addColorStop(0,'#26160928');fold.addColorStop(.27,'#ffe6a22e');fold.addColorStop(.70,'#fff5d200');fold.addColorStop(1,'#2113064a');fill(c,outline,fold);}
  };
  // Four spreads, eight one-time faces. During a turn expose only opposite sides of the
  // rotating leaf and only the NEXT static recto; the preceding recto never appears twice.
  const turning=ix<3&&f>.035&&f<.965;
  page(left,maps['Printed verso '+ix],false);
  page(right,maps['Printed recto '+(turning||f>=.965?ix+1:ix)],true);
  const spine=q([[.501,.236],[.512,.235],[.506,.868],[.490,.867]]);
  fill(c,spine,'#3d231743');
  if(turning){
   const cosine=Math.cos(Math.PI*f),arch=Math.sin(Math.PI*f);
   const head=xy([.512,.234],cosine>0?[.793,.267]:[.185,.215],Math.abs(cosine)),
         foot=xy([.502,.867],cosine>0?[.943,.837]:[.085,.797],Math.abs(cosine));
   head[1]-=.151*arch;foot[1]-=.074*arch;
   const shadow=q([[.512,.234],[.544+.13*arch,.318],[.648+.095*arch,.850],[.502,.866]]);
   const shadowColor=c.createLinearGradient(...P([.51,.55]),...P([.72,.55]));shadowColor.addColorStop(0,'#2512076b');shadowColor.addColorStop(1,'#25120700');fill(c,shadow,shadowColor);
   const g=cosine>0?[[.512,.234],head,foot,[.502,.867]]:[head,[.512,.234],[.502,.867],foot];
   page(g,maps[(cosine>0?'Printed recto '+ix:'Printed verso '+(ix+1))],cosine>0,.038*arch);
  }else if(f>=.965){page(left,maps['Printed verso '+(ix+1)],false);}
  c.restore();return true;
 }};
}
