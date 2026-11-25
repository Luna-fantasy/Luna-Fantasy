// Passive scroll scrubbing of three photographic plates and scene-specific editorial geometry.
// No independent playback clock, Canvas, media player, or intercepted scrolling.
export function mountStoryScene(root) {
 if(!root)return () => {};
 const owner=new AbortController(), signal=owner.signal;
 const listen=(node,event,fn)=>node.addEventListener(event,fn,{passive:true,signal});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'), compact=matchMedia('(max-width: 720px)');
 const pinned=root.querySelector('.chron-pinned'), planes=[...root.querySelectorAll('.chron-plane')], markers=[...root.querySelectorAll('[data-chron-anchor]')];
 if(!pinned||planes.length!==3||markers.length!==3)return () => owner.abort();
 const plates=planes.map(x=>x.querySelector('img'));
 if(plates.some(im=>!im))return () => owner.abort();
 const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,x)=>a+(b-a)*x,ease=x=>{x=clamp(x);return x*x*(3-2*x)},gate=(p,a,b)=>ease((p-a)/(b-a));
 let raf=0,beat=-1,ready=false,visible=true,suspended=false,ticket=0,retryOnLoad=false;
 function cancelFrame(){if(raf)cancelAnimationFrame(raf);raf=0;}
 function paint(){
  raf=0;
  if(signal.aborted||!ready||reduced.matches||!visible||suspended||document.hidden)return;
  const b=root.getBoundingClientRect(), runway=Math.max(1,root.offsetHeight-pinned.offsetHeight);
  const p=clamp(-b.top/runway), phone=compact.matches, width=phone ? .4 : 1;
  const opening=gate(p,0,.30), night=gate(p,.265,.48), rebirth=gate(p,.662,.91);
  const storm=gate(p,.36,.51)*(1-gate(p,.64,.78)), hit=gate(p,.66,.727)*(1-gate(p,.757,.835)), last=gate(p,.81,1);
  const set=(el,k,v)=>el.style.setProperty('--'+k,v), pct=x=>x.toFixed(3)+'%', unit=x=>x.toFixed(4);
  set(root,'chron-progress',unit(p));set(root,'chron-intro',unit(1-gate(p,.235,.43)));set(root,'gate',pct(9+100*opening));
  set(root,'night-top',pct(mix(-14,115,night)));set(root,'night-mid',pct(mix(-30,108,night)));set(root,'night-end',pct(mix(-8,112,night)));
  set(root,'renew',pct(rebirth*54));set(root,'relief',pct(Math.sin(rebirth*Math.PI)*7));
  set(root,'ash',unit(storm*.75));set(root,'ash-x',mix(-36,52,gate(p,.33,.76))+'px');set(root,'ash-y',mix(24,-70,gate(p,.33,.76))+'px');
  set(root,'turn',unit(hit*.82));set(root,'cut-x',pct(mix(-36,68,gate(p,.66,.85))));
  const cam=[
   [mix(-1,2.4,opening),mix(1,-1,opening),mix(1.018,1.10,opening)],
   [mix(3.4,-2.2,gate(p,.31,.73)),mix(-.2,1.7,night),mix(1.08,1.14,gate(p,.36,.72))],
   [mix(1.5,0,last),phone?0:mix(1,0,last),phone?1:mix(1.056,1,last)]
  ];
  planes.forEach((plane,i)=>{const [x,y,z]=cam[i];set(plane,'cam-x',pct(x*width));set(plane,'cam-y',pct(y*width));set(plane,'cam-z',unit(phone?1+(z-1)*.55:z));
   set(plane,'fg-x',pct(x*1.8*width));set(plane,'fg-y',pct(y*1.4*width));set(plane,'fg-z',unit(Math.max(1,z+.043)));set(plane,'fg-a',unit(i===2 ? .28 : .35));});
  const titles=[1-gate(p,.28,.439),gate(p,.38,.52)*(1-gate(p,.69,.80)),gate(p,.747,.896)];
  const at=p<.43?0:p<.79?1:2;
  for(let i=0;i<3;i++){set(root,'title-'+i,unit(titles[i]));set(root,'tit-shift-'+i,((1-titles[i])*14).toFixed(2)+'px');}
  root.dataset.chronProgress=unit(p);root.dataset.chronBeat=String(at);
  if(at!==beat){beat=at;markers.forEach((el,i)=>i===at?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current'))}
 }
 function schedule(){if(!signal.aborted&&!raf&&ready&&visible&&!suspended&&!document.hidden)raf=requestAnimationFrame(paint);}
 function fallback(){
  ready=false;
  delete root.dataset.chronReady;delete root.dataset.chronProgress;delete root.dataset.chronBeat;
  for(const k of ['chron-progress','chron-intro','gate','night-top','night-mid','night-end','renew','relief','ash','ash-x','ash-y','turn','cut-x','title-0','title-1','title-2','tit-shift-0','tit-shift-1','tit-shift-2'])root.style.removeProperty('--'+k);
  for(const plane of planes)for(const k of ['cam-x','cam-y','cam-z','fg-x','fg-y','fg-z','fg-a'])plane.style.removeProperty('--'+k);
  markers.forEach((el,i)=>i===0?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current'));
 }
 async function setup(){
  if(signal.aborted)return;
  const id=++ticket;
  retryOnLoad=false;
  if(reduced.matches){cancelFrame();fallback();return;}
  for(const im of plates)im.loading='eager';
  try{
   await Promise.all(plates.map(im=>im.decode?im.decode():im.complete?(im.naturalWidth?Promise.resolve():Promise.reject(Error('Unavailable story plate'))):new Promise((ok,no)=>{im.addEventListener('load',ok,{once:true,signal});im.addEventListener('error',no,{once:true,signal});signal.addEventListener('abort',no,{once:true})})));
   if(id!==ticket||signal.aborted||reduced.matches)return;
   ready=true;root.dataset.chronReady='true';beat=-1;schedule();
  }catch{if(id===ticket){fallback();retryOnLoad=true}}
 }
 // React can replace a failed cover's src without remounting the story scene.
 // Keep the static layout until that replacement and the other plates decode.
 for(const im of plates)listen(im,'load',()=>{if(retryOnLoad&&!reduced.matches)setup()});
 const observe='IntersectionObserver' in window?new IntersectionObserver(list=>{
  visible=list[0].isIntersecting;
  if(visible)schedule();else cancelFrame();
 },{rootMargin:'80px'}):null;
 observe?.observe(root);
 for(const e of ['scroll','resize'])listen(window,e,schedule);
 listen(window,'pagehide',()=>{suspended=true;cancelFrame();observe?.disconnect()});
 listen(window,'pageshow',e=>{
  suspended=false;
  if(e.persisted){
   const b=root.getBoundingClientRect();visible=b.bottom>=-80&&b.top<=innerHeight+80;
   observe?.observe(root);
  }
  schedule();
 });
 listen(document,'visibilitychange',()=>document.hidden?cancelFrame():schedule());
 listen(reduced,'change',setup);
 setup();
 return ()=>{ticket++;owner.abort();observe?.disconnect();cancelFrame();fallback()};
}
