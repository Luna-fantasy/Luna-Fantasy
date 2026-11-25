import { sceneLifecycle } from './scene-lifecycle';

const NS='http://www.w3.org/2000/svg';
const clamp=x=>Math.max(0,Math.min(1,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>(x=clamp(x),x*x*(3-2*x));
const e=(s,a,b)=>smooth((s-a)/(b-a));
const themes={
 hub:['#d7ad72','#ffe2a5','#728ca5'],kael:['#c89b61','#f7dda9','#879ab7'],meluna:['#9dbfdd','#d4efff','#8976a5'],
 zoldar:['#c99455','#ffd391','#799899'],brimor:['#d3a06e','#f2d7a6','#8c788f'],mells:['#c4a273','#f8dfb2','#819fc4'],seluna:['#95abd4','#ddeaff','#9186be']
};
function el(n,a={},p){const x=document.createElementNS(NS,n);for(const [k,v] of Object.entries(a))x.setAttribute(k,v);p?.append(x);return x}
const set=(n,a)=>{for(const [k,v] of Object.entries(a))n.setAttribute(k,v)};
const path=(p,d,a)=>el('path',{d,...a},p);
const rect=(p,x,y,width,height,a)=>el('rect',{x,y,width,height,...a},p);
const ln=(p,x1,y1,x2,y2,a)=>el('line',{x1,y1,x2,y2,...a},p);
const circle=(p,cx,cy,r,a)=>el('circle',{cx,cy,r,...a},p);
const move=(n,x,y,angle=0,s=1)=>n.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${s.toFixed(3)})`);
const ink=(fill='none',sw=1.3)=>({fill,stroke:'currentColor','stroke-width':sw,'stroke-linecap':'round','stroke-linejoin':'round'});
function filigree(p,x,y,w,h){
 path(p,`M${x+20} ${y}h-20v20 M${x+w-20} ${y}h20v20 M${x} ${y+h-20}v20h20 M${x+w} ${y+h-20}v20h-20`,{...ink(),opacity:'.77'});
}
function build(k,s){
 const [gold,light,cold]=themes[k],g=el('g',{color:gold},s);
 const halo=el('defs',{},s),gr=el('linearGradient',{id:'object-fill',x1:'0%',x2:'100%',y1:'0%',y2:'100%'},halo);
 el('stop',{offset:'0%','stop-color':'#222c40'},gr);el('stop',{offset:'100%','stop-color':'#0e121e'},gr);
 const fill='url(#object-fill)',slate='#111825',base=el('g',{},g),objects=el('g',{},g);
 path(base,'M62 238H413M86 246H389',{...ink(),opacity:'.42'});
 filigree(base,46,28,382,235);
 const mark=(p,x,y,r=3)=>path(p,`M${x} ${y-r}l${r} ${r}-${r} ${r}-${r}-${r}Z`,{fill:light});
 const ornament=(p,x,y,r=19)=>{circle(p,x,y,r,{...ink(),opacity:'.6'});mark(p,x,y,r*.54)};
 const palette=[gold,light,cold];
 let render;
 if(k==='hub'){
  const left=el('g',{},objects), right=el('g',{},objects);
  path(base,'M76 230V115Q76 62 115 63Q154 62 154 115V230 M327 230V115Q327 62 365 63Q404 62 404 115V230',{...ink(),opacity:'.44'});
  const pane=(p)=>{path(p,'M0 179V86Q0 10 48 8Q96 10 96 86V179Z',ink(fill,2));for(let j=0;j<4;j++)path(p,`M${12+j*24} 168V${48+j%2*14}`,{...ink(),opacity:'.7'});path(p,'M0 100h96M0 112h96',ink());mark(p,48,124,5)};
  pane(left);pane(right);
  const awning=el('g',{},objects);path(awning,'M-105 4l22-29h166l22 29v15h-210Z',ink(fill,1.7));for(let i=0;i<6;i++)path(awning,`M${-100+i*40} 4l16-29 12 0-10 29v14h-18Z`,{fill:i%2?cold:gold,opacity:'.32'});
  const lanterns=[139,240,341].map((x,i)=>{const p=el('g',{},objects);ln(p,0,0,0,28,ink());path(p,'M-10 28H10L8 57H-8Z',ink(fill,2));rect(p,-5,34,10,17,{fill:light,opacity:'.83'});return p});
  render=(p,t)=>{ const d=e(p,.06,.66),a=e(p,.27,.83);move(left,144-80*d,55,-8*d);move(right,235+91*d,55,8*d);move(awning,240,67+18*a);lanterns.forEach((n,i)=>move(n,[139,240,341][i],40+67*e(p,.36+i*.075,.78+i*.05),Math.sin(t*1.2+i)*5*a));};
 } else if(k==='kael'){
  path(base,'M88 209l23-53h258l23 53-23 25H111Z',ink(fill,1.6));path(base,'M112 168h256 M104 213h272',{...ink(),opacity:'.45'});
  const cards=[0,1,2].map(i=>{const n=el('g',{color:palette[i]},objects);rect(n,-27,-40,54,80,{rx:4,...ink(fill,2)});rect(n,-22,-35,44,70,{rx:3,...ink()});path(n,'M0 -23L15 0 0 23-15 0Z',ink());ornament(n,0,0,8);return n});
  render=(p,t)=>{const drift=Math.sin(t*.82);cards.forEach((n,i)=>{const d=e(p,.06+i*.12,.69+i*.10);move(n,mix(340-i*4,[168,240,312][i],d),mix(75-i*4,[181,151,181][i],d)-38*Math.sin(Math.PI*d)+drift*(i-1)*2,mix(68+8*i,[-17,0,17][i],d),mix(.73,1.10,d))});};
 } else if(k==='meluna'){
  path(base,'M89 201q151-105 302 0l-18 32H107Z',ink(fill,1.5));path(base,'M105 202q135-69 270 0',{...ink(),opacity:'.6'});
  [156,240,324].forEach(x=>{circle(base,x,188,24,ink());circle(base,x,188,19,{...ink(),opacity:'.38'})});
  const gems=[0,1,2].map(i=>{const a=el('g',{color:palette[i]},objects);path(a,'M0 -28 18 -15 24 9 0 29-24 9-18-15Z',ink(fill,2));path(a,'M0 -28L8 -9 24 9 0 14-24 9-8-9ZM0 29V14M-18 -15L0 -9 18 -15',{...ink(),opacity:'.82'});return a});
  render=(p,t)=>{gems.forEach((n,i)=>{const d=e(p,i*.13,.73+i*.07);move(n,mix([106,240,374][i],[156,240,324][i],d),mix(70,171,d)-18*Math.sin(d*Math.PI)+Math.sin(t*1.2+i)*3, (1-d)*[63,-70,60][i],mix(.74,1,d));});};
 } else if(k==='zoldar'){
  for(let i=0;i<3;i++){const x=140+i*100;rect(base,x-36,172,72,55,{rx:6,...ink(fill,1.8)});ln(base,x-23,184,x+23,184,ink(light,2));path(base,`M${x-27} 216h54`,{...ink(),opacity:'.55'});}
  const tickets=[0,1,2].map(i=>{const q=el('g',{color:palette[i]},objects);path(q,'M-28-19h56v12q-13 7 0 14v12h-56v-12q13-7 0-14Z',ink(fill,1.7));path(q,'M-18-13h36M-18 12h36M0-13v26',{...ink(),opacity:'.72'});mark(q,9,0);return q;});
  // The foremost brass lips occlude the lower part of the passing tickets.
  const lip=el('g',{color:gold},s);for(let i=0;i<3;i++){const x=140+i*100;path(lip,`M${x-34} 190h68v21h-68z`,ink(fill,1.6));}
  render=(p,t)=>tickets.forEach((n,i)=>{const d=e(p,.10+i*.13,.72+i*.09);move(n,mix(301+i*19,140+i*100,d),mix(71+i*7,185+(i===1?-9:-13),d)-15*Math.sin(d*Math.PI)+Math.sin(t*1.2+i)*2,mix(53+i*14,i===1?-2:0,d),mix(.79,1,d));});
 } else if(k==='brimor'){
  const rack=el('g',{},base);for(const x of [128,352]){path(rack,`M${x} 228v-139l16-13H${480-x-16}l16 13v139`,{...ink(),opacity:'.55'});}
  path(rack,'M115 224h250M144 106h192',ink(fill,1.5));
  const pieces=[0,1,2].map(i=>{const q=el('g',{color:palette[i]},objects);path(q,'M-32 -60h64l-3 67L0 25-29 7Z',ink(fill,1.7));for(let j=0;j<3;j++)ln(q,-23,-48+j*10,23,-48+j*10,{...ink(),opacity:'.55'});ornament(q,0,-10,12);return q;});
  const pin=el('g',{},objects);path(pin,'M-8 -35h16l5 25-13 38-13-38Z',ink(fill,1.5));mark(pin,0,-3,6);
  render=(p,t)=>{pieces.forEach((n,i)=>{const d=e(p,.02+i*.15,.64+i*.11);move(n,[167,240,313][i],mix(81,168,d),mix([-34,27,38][i],0,d)+Math.sin(t+i)*2,mix(.72,1,d))});move(pin,240,mix(79,84,e(p,.2,.91)),mix(-70,0,e(p,.15,.78)));};
 } else if(k==='mells'){
  const rail=el('g',{},base);path(rail,'M83 194l15-125h284l15 125ZM99 188h282',{...ink(),opacity:'.71'});
  const imgpts=['M-33 19L-13-9 3 8 16-16 37 19Z','M-36 20L-20 10-1-23 15-11 37 20Z','M-35 19L-20-15-2 2 16-7 35 19Z'];
  const frames=[0,1,2].map(i=>{const n=el('g',{color:palette[i]},objects);rect(n,-48,-52,96,104,{rx:4,...ink(fill,2)});rect(n,-41,-45,82,90,{rx:2,...ink()});path(n,imgpts[i],{fill:cold,stroke:light,'stroke-width':1,opacity:'.73'});circle(n,17,-21,6,{fill:light,opacity:'.79'});return n;});
  render=(p,t)=>frames.forEach((n,i)=>{const d=e(p,i*.11,.63+i*.14);move(n,mix([112,235,374][i],[141,240,339][i],d),mix([111,85,112][i],[158,139,158][i],d)+Math.sin(t*.85+i)*2,mix([-45,30,48][i],[-9,0,9][i],d),mix(.56,i===1?1.08:.86,d));});
 } else {
  const door=el('g',{},base);path(door,'M163 228V120Q163 60 240 42Q317 60 317 120V228Z',ink(fill,2));
  const petals=[0,1,2,3,4,5].map((i)=>{const a=el('g',{color:palette[i%3]},objects);path(a,'M0-53Q39-27 25 4Q9 26 0 42Q-9 26-25 4Q-39-27 0-53Z',ink(fill,1.6));path(a,'M0-38V22',{...ink(),opacity:'.65'});return a;});
  const latch=el('g',{},objects);rect(latch,-35,-11,70,22,{rx:4,...ink(fill,2)});ornament(latch,0,0,6);
  render=(p,t)=>{const d=e(p,.08,.88);petals.forEach((n,i)=>{const a=i*Math.PI/3+t*.05*(1-d),r=mix(79,46,d);move(n,240+r*Math.cos(a),139+r*Math.sin(a),i*60+60*(1-d),mix(.61,.53,d));});move(latch,240,mix(183,221,d));};
 }
 return render;
}
export function mountBazaarMotion(host, key) {
  const {listen,observe,dispose}=sceneLifecycle();
  const hero=host.parentElement,wrap=hero.parentElement;
  const svg=el('svg',{viewBox:'0 0 476 280',preserveAspectRatio:'xMidYMid meet',focusable:'false'},host);
  const render=build(key,svg);
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  let frame=0,away=false,inside=!('IntersectionObserver' in window),pin=0,elapsed=0,last=null,scrubbed=false;
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=null;}
  function queue(){if(!frame&&!away&&!document.hidden&&(inside||reduced.matches))frame=requestAnimationFrame(refresh)}
  function refresh(now){
   frame=0;
   if(away||document.hidden||(!inside&&!reduced.matches))return;
   const box=wrap.getBoundingClientRect();
   const travel=Math.max(1,wrap.offsetHeight-hero.offsetHeight);
   const progress=clamp(-box.top/travel);
   // One authored entrance on an untouched landing. Native travel then owns both
   // directions, including the exact frame at 0, independently of elapsed time.
   if(progress>.006)scrubbed=true;
   if(reduced.matches){render(1,0);wrap.dataset.motionProgress='1.000';last=null;return;}
   if(!scrubbed&&last!==null)elapsed+=Math.max(0,now-last)/1000;
   last=now;
   const q=scrubbed?progress:e(elapsed,0,1.95);
   render(q,scrubbed?progress*3.6:elapsed);
   wrap.dataset.motionProgress=q.toFixed(3);
   if(!scrubbed&&(elapsed<3.6||pin>0)){pin=Math.max(0,pin-1);queue();}
   else last=null;
  }
  listen(window,'scroll',queue,{passive:true});
  listen(window,'resize',queue,{passive:true});
  listen(window,'pagehide',()=>{away=true;stop()});
  listen(window,'pageshow',()=>{away=false;queue()});
  listen(document,'visibilitychange',()=>document.hidden?stop():queue());
  listen(reduced,'change',()=>{stop();queue()});
  listen(hero,'pointerenter',event=>{if(event.pointerType==='mouse'&&fine.matches&&!scrubbed){pin=68;queue()}},{passive:true});
  if('IntersectionObserver'in window)observe(([r])=>{inside=r.isIntersecting;if(inside)queue();else stop()}).observe(wrap);
  queue();
  return () => { stop(); dispose(); host.replaceChildren(); };
}
