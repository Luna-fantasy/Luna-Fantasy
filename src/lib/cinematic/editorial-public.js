/* Local motion only: static approved JSX is present before enhancement. */
const C=x=>Math.min(1,Math.max(0,x)), E=(x,a,b)=>{const t=C((x-a)/(b-a));return t*t*(3-2*t)};

function mountTradingQuotes(host, rtl, reduced, listen) {
 const rows = host.closest('[data-luna-editorial="trading"]')?.querySelectorAll('.trading-stat-item');
 if (!rows?.length || !window.IntersectionObserver) return () => {};

 const visible = new Set();
 let frame = 0;
 function paint() {
  frame = 0;
  if (document.hidden || reduced.matches) return;
  for (const item of visible) {
   const box = item.getBoundingClientRect();
   const height = window.innerHeight;
   const span = Math.max(height * .5, Math.min(box.height, height));
   const fraction = C((height - box.top) / (height + span));
   const reveal = E(height - box.top, 0, height * .35);
   item.style.setProperty('--folio-x', (100 * fraction).toFixed(1) + '%');
   item.style.setProperty('--unveil', (1 - reveal).toFixed(3));
  }
 }
 function queue() {
  if (visible.size && !frame && !document.hidden && !reduced.matches) frame = requestAnimationFrame(paint);
 }
 const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
   if (entry.isIntersecting) visible.add(entry.target);
   else visible.delete(entry.target);
  }
  queue();
 }, {rootMargin: '80px 0px'});
 function reset() {
  cancelAnimationFrame(frame);
  frame = 0;
  visible.clear();
  observer.disconnect();
  for (const [index, item] of rows.entries()) {
   delete item.dataset.score;
   for (const name of ['--bias', '--unveil', '--folio-x']) item.style.removeProperty(name);
   if (reduced.matches || document.hidden) continue;
   item.dataset.score = 'exchange';
   item.style.setProperty('--bias', (index % 2 ? -1 : 1) * (rtl ? -1 : 1));
   observer.observe(item);
  }
 }
 listen(window, 'scroll', queue);
 listen(window, 'resize', queue);
 listen(window, 'pageshow', reset);
 listen(reduced, 'change', reset);
 listen(document, 'visibilitychange', reset);
 reset();
 return () => {
  observer.disconnect();
  cancelAnimationFrame(frame);
  for (const item of rows) {
   delete item.dataset.score;
   for (const name of ['--bias', '--unveil', '--folio-x']) item.style.removeProperty(name);
  }
 };
}

export function mountEditorialMotif(stage,route,rtl=false){
 const host=stage.parentElement;
 if(!host)return () => {};
 const owner=new AbortController(), signal=owner.signal;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const listen=(node,evt,fn)=>node.addEventListener(evt,fn,{passive:true,signal});
 const stopQuotes=route==='trading' ? mountTradingQuotes(host,rtl,reduced,listen) : null;
 let observe=null,requestId=0,away=false,isVisible=true,elapsed=0,last=null,scrubbed=false;
 const stop=()=>{if(requestId)cancelAnimationFrame(requestId);requestId=0;last=null;};
 const legal=stage.querySelector('.live-layer');
 const el=(name)=>stage.querySelector(`[data-e="${name}"]`);
 const attr=(name,key,val)=>el(name)?.setAttribute(key,typeof val==='number'?val.toFixed(3):val);
 const slide=(name,x,y)=>attr(name,'transform',`translate(${x} ${y})`);
 const fade=(name,v)=>attr(name,'opacity',C(v));
 const trace=(name,v)=>attr(name,'stroke-dashoffset',(1-C(v))*100);
 const durations={about:2050,faq:1730,contact:1880,trading:2180};
 const queue=()=>{if(!signal.aborted&&!requestId&&!away&&isVisible&&!reduced.matches&&!document.hidden)requestId=requestAnimationFrame(tick)};
 function paint(p){
  const rise=(a,b)=>E(p,a,b);
  if(route==='about'){
   trace('draw',rise(0,.27));
   for(let i=0;i<5;i++){
    const v=rise(i*.073+.08,i*.062+.55);
    slide('build'+i,(i-2)*36*(1-v),52*(1-v));
    fade('build'+i,.26+.74*v);
   }
   fade('wash',rise(.22,.67)*(1-.35*rise(.8,1)));
   trace('bridge',rise(.47,.92));
   fade('settle',rise(.77,1));
  }else if(route==='faq'){
   const flip=rise(.02,.64);
   attr('cover','transform',`translate(${282+flip*98} 0) scale(${1-flip*.94} 1) translate(-282 0)`);
   fade('cover',1-rise(.48,.76));
   fade('book',.32+.68*rise(.12,.72));
   for(let i=0;i<4;i++)trace('ink'+i,rise(.19+i*.12,.52+i*.14));
   for(let i=0;i<3;i++){
     const v=rise(.43+i*.12,.76+i*.115);
     slide('tab'+i,34*(v-1),0);fade('tab'+i,v);
   }
  }else if(route==='contact'){
   const v=rise(.05,.5), pull=rise(.26,.83), rest=rise(.79,1);
   attr('flap','transform',`translate(0 139) scale(1 ${1-1.83*v}) translate(0 -139)`);
   slide('paper',0,-45*pull);
   fade('seal',1-rise(.13,.38));
   fade('wash',.25+.64*pull-.23*rest);
   trace('light',rise(.47,.96));
  }else{
   const tilt=(12*rise(0,.24)-21*rise(.28,.61)+9*rise(.67,1));
   attr('beam','transform',`rotate(${tilt} 290 108)`);
   const dy=Math.sin(tilt*Math.PI/180)*154;
   slide('panA',0,-dy);slide('panB',0,dy);
   fade('wash',.2+.54*rise(.32,.76));trace('level',rise(.65,1));
  }
  stage.dataset.motion=p.toFixed(3);
 }
 function clearLegal(){
  stage.removeAttribute('data-started');
  legal?.style.removeProperty('--v3-legal-distance');
  legal?.style.removeProperty('--v3-legal-angle');
 }
 function tick(now){
  requestId=0;
  if(signal.aborted||away||!isVisible||reduced.matches||document.hidden)return;
  if(legal){
   stage.setAttribute('data-started','');
   const v=stage.getBoundingClientRect();
   const k=C(1-(v.top+v.height*.25)/Math.max(window.innerHeight*.7,250));
   const travel=route==='refund'?-9:route==='privacy'?3:5;
   const turn=route==='terms'?5:route==='privacy'?-5:1;
   legal.style.setProperty('--v3-legal-distance',((k-.62)*travel).toFixed(2)+'px');
   legal.style.setProperty('--v3-legal-angle',((k-.62)*turn*(rtl?-1:1)).toFixed(2)+'deg');
   return;
  }
  const h=window.innerHeight, box=stage.getBoundingClientRect(), board=host.getBoundingClientRect();
  const progress=C(-board.top/Math.max(260,h*.65));
  if(route==='trading'&&progress>.006)scrubbed=true;
  const inFrame=box.top<h&&box.bottom>0;
  if(!scrubbed&&inFrame&&last!==null)elapsed+=Math.max(0,now-last);
  const intro=C(elapsed/durations[route]),playing=!scrubbed&&inFrame&&intro<1;
  last=playing?now:null;
  const lead=C((h*.19-board.top)/Math.max(260,h*.65));
  paint(scrubbed?progress:C(lead+.64*E(intro,0,1)*(1-lead)));
  if(playing)queue();
 }
 function setup(){
  observe?.disconnect();observe=null;isVisible=true;stop();clearLegal();
  elapsed=0;scrubbed=false;
  if(reduced.matches||!window.IntersectionObserver){if(!legal)paint(1);return;}
  if(!legal)paint(0);
  observe=new IntersectionObserver(([entry])=>{
   isVisible=entry.isIntersecting;
   if(isVisible)queue();else stop();
  },{rootMargin:'72px 0px'});
  observe.observe(stage);
 }
 // Native controls supply the pose; the animation never reads field values or mutates a transaction.
 const page=host.closest('[data-luna-editorial]') || host.parentElement;
 if(page && (route==='contact'||route==='trading'||route==='faq'||route==='about')){
  const targetSelector={contact:'input,select,textarea,button[type="submit"]',trading:'.trading-stat,.trading-signed-out,.trading-stats-bar',faq:'details.faq-item summary',about:'.about-stat,.about-quote'}[route];
  const poseFor=(event)=>{
   const target=event.target instanceof Element?event.target.closest(targetSelector):null;
   if(!target||reduced.matches||document.hidden)return;
   const targets=Array.from(page.querySelectorAll(targetSelector)),i=targets.indexOf(target);
   if(i<0)return;
   if(route==='contact')paint(.23+.56*(i+1)/Math.max(1,targets.length));
   if(route==='faq')paint(target.parentElement?.open ? .89 : .35);
   if(route==='trading')paint((i%2)? .55 : .26);
   if(route==='about')paint(.35+.55*(i+1)/Math.max(1,targets.length));
  };
  listen(page,'focusin',poseFor);listen(page,'pointerdown',poseFor);
 }
 listen(reduced,'change',setup);listen(window,'scroll',queue);listen(window,'resize',queue);
 listen(window,'pagehide',()=>{away=true;stop()});
 listen(window,'pageshow',()=>{away=false;queue()});
 listen(document,'visibilitychange',()=>document.hidden?stop():queue());
 setup();
 return ()=>{
  owner.abort();stop();observe?.disconnect();stopQuotes?.();clearLegal();
  if(!legal){paint(1);delete stage.dataset.motion}
 };
}
